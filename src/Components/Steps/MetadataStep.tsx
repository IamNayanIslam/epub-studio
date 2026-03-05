import { useEpub } from "../../Store/EpubContext";
import { useTheme, tokens } from "../../Store/ThemeContext";
import { BookOpen, User, Tag, Building2, Globe, AlertCircle, CheckCircle2 } from "lucide-react";
import React from "react";

// ── OPF Metadata update ───────────────────────────────────────────────────
export const updateMetadataInBlob = async (
  epubBlob: Blob,
  metadata: { title: string; authorBengali: string; authorFileAs: string; subjects: string; publisher: string; language: string },
): Promise<Blob> => {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const content = await zip.loadAsync(await epubBlob.arrayBuffer());
  for (const [fp, file] of Object.entries(content.files)) {
    if (file.dir) continue;
    zip.file(fp, await file.async("uint8array"));
  }
  const opfPath = Object.keys(content.files).find((p) => p.endsWith(".opf"));
  if (!opfPath) throw new Error("OPF not found!");
  let opf = await content.file(opfPath)!.async("string");
  if (metadata.title) opf = opf.replace(/<dc:title>.*?<\/dc:title>/, `<dc:title>${metadata.title}</dc:title>`);
  const creatorTag = `<dc:creator opf:file-as="${metadata.authorFileAs}" opf:role="aut">${metadata.authorBengali}</dc:creator>`;
  opf = opf.includes("<dc:creator")
    ? opf.replace(/<dc:creator[^>]*>.*?<\/dc:creator>/, creatorTag)
    : opf.replace("</metadata>", `  ${creatorTag}\n  </metadata>`);
  opf = opf.replace(/<dc:subject>.*?<\/dc:subject>\n?/g, "");
  if (metadata.subjects.trim()) {
    const tags = metadata.subjects.split(",").map((s) => s.trim()).filter(Boolean).map((s) => `    <dc:subject>${s}</dc:subject>`).join("\n");
    opf = opf.replace("</metadata>", `${tags}\n  </metadata>`);
  }
  opf = opf.replace(/<dc:publisher>.*?<\/dc:publisher>\n?/g, "");
  opf = opf.replace("</metadata>", `    <dc:publisher>${metadata.publisher}</dc:publisher>\n  </metadata>`);
  opf = opf.includes("<dc:language>")
    ? opf.replace(/<dc:language>.*?<\/dc:language>/, `<dc:language>${metadata.language}</dc:language>`)
    : opf.replace("</metadata>", `    <dc:language>${metadata.language}</dc:language>\n  </metadata>`);
  const today = new Date().toISOString().split("T")[0];
  const dateTag = `<dc:date opf:event="modification" xmlns:opf="http://www.idpf.org/2007/opf">${today}</dc:date>`;
  opf = opf.includes('opf:event="modification"')
    ? opf.replace(/<dc:date opf:event="modification"[^>]*>.*?<\/dc:date>/, dateTag)
    : opf.replace("</metadata>", `    ${dateTag}\n  </metadata>`);
  zip.file(opfPath, opf);
  return await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip", compression: "DEFLATE", compressionOptions: { level: 6 } });
};

// ── Validation ────────────────────────────────────────────────────────────
export const validateMetadata = (metadata: { title: string; authorBengali: string; authorFileAs: string; subjects: string; publisher: string }): string[] => {
  const e: string[] = [];
  if (!metadata.title?.trim()) e.push("বইয়ের নাম");
  if (!metadata.authorBengali?.trim()) e.push("লেখকের নাম (বাংলা)");
  if (!metadata.authorFileAs?.trim()) e.push("লেখকের নাম (ইংরেজি)");
  if (!metadata.subjects?.trim()) e.push("Genre / Subject");
  if (!metadata.publisher?.trim()) e.push("Publisher");
  return e;
};

// ── SectionLabel ──────────────────────────────────────────────────────────
const SectionLabel = ({ label, isDark }: { label: string; isDark: boolean }) => (
  <div className="flex items-center gap-3 mb-4">
    <span className={`text-[10px] font-black uppercase tracking-[0.18em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>{label}</span>
    <div className={`flex-1 h-px ${isDark ? "bg-[#222538]" : "bg-slate-100"}`} />
  </div>
);

// ── Field ─────────────────────────────────────────────────────────────────
const Field = ({ icon, label, sublabel, hint, error, filled, children }: {
  icon: React.ReactNode; label: string; sublabel?: string;
  hint?: string; error?: string; filled?: boolean; children: React.ReactNode;
}) => {
  const { isDark } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between min-h-[20px]">
        <label className="flex items-center gap-2">
          <span className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 transition-all duration-300 ${
            filled
              ? isDark ? "text-emerald-400" : "text-emerald-500"
              : isDark ? "text-slate-500" : "text-slate-400"
          }`}>
            {filled ? <CheckCircle2 size={14} /> : icon}
          </span>
          <span className={`text-xs font-semibold ${t.textSecondary}`}>{label}</span>
          {sublabel && <span className={`text-[10px] ${t.textMuted}`}>— {sublabel}</span>}
        </label>
        {error && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500">
            <AlertCircle size={9} /> {error}
          </span>
        )}
      </div>
      {children}
      {!error && hint && <p className={`text-[10px] ${t.textMuted} pl-6`}>{hint}</p>}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────
const MetadataStep = () => {
  const { state, dispatch } = useEpub();
  const { isDark } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;
  const { metadata } = state;
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const update = (field: string, value: string) => dispatch({ type: "UPDATE_METADATA", payload: { [field]: value } });
  const touch = (field: string) => setTouched((p) => ({ ...p, [field]: true }));
  const err = (field: string, value: string) => touched[field] && !value?.trim() ? "খালি রাখবেন না" : undefined;
  const filled = (v: string) => !!v?.trim();

  const required = [
    { key: "title", value: metadata.title },
    { key: "authorBengali", value: metadata.authorBengali },
    { key: "authorFileAs", value: metadata.authorFileAs },
    { key: "subjects", value: metadata.subjects },
    { key: "publisher", value: metadata.publisher },
  ];
  const filledCount = required.filter((f) => filled(f.value)).length;
  const allDone = filledCount === required.length;
  const anyTouched = Object.keys(touched).length > 0;

  // Bengali fields — larger, readable font size
  const bnInput = (hasErr: boolean) =>
    `w-full border-2 rounded-xl px-4 py-3 text-[1.05rem] leading-relaxed outline-none transition-all duration-200 ${
      hasErr
        ? `border-red-400 focus:border-red-500 ${isDark ? "bg-red-900/10 text-slate-100" : "bg-red-50 text-slate-800"}`
        : t.input
    }`;

  const enInput = (hasErr: boolean) =>
    `w-full border-2 rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 ${
      hasErr
        ? `border-red-400 focus:border-red-500 ${isDark ? "bg-red-900/10 text-slate-100" : "bg-red-50 text-slate-800"}`
        : t.input
    }`;

  return (
    <div className="max-w-xl mx-auto px-1 py-2">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className={`text-xl font-black tracking-tight ${t.textPrimary}`}>Book Metadata</h2>
          <p className={`text-xs mt-0.5 ${t.textMuted}`}>EPUB এর OPF ফাইলে সংরক্ষিত হবে</p>
        </div>
        {/* Completion badge */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold shrink-0 transition-all duration-500 ${
          allDone
            ? isDark ? "bg-emerald-900/30 border-emerald-700/40 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600"
            : isDark ? "bg-[#1C1F30] border-[#222538] text-slate-500" : "bg-slate-50 border-slate-200 text-slate-400"
        }`}>
          {allDone ? <><CheckCircle2 size={11} /> সম্পূর্ণ</> : <>{filledCount}/{required.length}</>}
        </div>
      </div>

      {/* Progress bar */}
      <div className={`h-[3px] rounded-full mb-5 overflow-hidden ${isDark ? "bg-[#1C1F30]" : "bg-slate-100"}`}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${(filledCount / required.length) * 100}%`,
            background: allDone ? "linear-gradient(90deg,#10b981,#059669)" : "linear-gradient(90deg,#3b82f6,#818cf8)",
          }}
        />
      </div>

      {/* Error banner */}
      {anyTouched && !allDone && (
        <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border mb-5 ${
          isDark ? "bg-red-900/15 border-red-900/30 text-red-400" : "bg-red-50 border-red-100 text-red-500"
        }`}>
          <AlertCircle size={13} className="shrink-0" />
          <p className="text-xs font-semibold">{required.length - filledCount}টি field এখনও খালি আছে</p>
        </div>
      )}

      {/* ── বই সম্পর্কে ── */}
      <SectionLabel label="বই সম্পর্কে" isDark={isDark} />
      <div className="space-y-4 mb-6">
        <Field icon={<BookOpen size={12} />} label="বইয়ের নাম" error={err("title", metadata.title)} filled={filled(metadata.title)}>
          <input
            type="text" value={metadata.title}
            onChange={(e) => update("title", e.target.value)}
            onBlur={() => touch("title")}
            placeholder="যেমন: চোখের আরশিতে সমুদ্দুর"
            className={bnInput(!!err("title", metadata.title))}
            lang="bn"
            style={{ fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', 'Kalpurush', system-ui, sans-serif" }}
          />
        </Field>

        <Field icon={<Tag size={12} />} label="Genre / Subject" hint="একাধিক হলে comma দিয়ে আলাদা করুন" error={err("subjects", metadata.subjects)} filled={filled(metadata.subjects)}>
          <input
            type="text" value={metadata.subjects}
            onChange={(e) => update("subjects", e.target.value)}
            onBlur={() => touch("subjects")}
            placeholder="Romance, Drama, Thriller"
            className={enInput(!!err("subjects", metadata.subjects))}
          />
        </Field>
      </div>

      {/* ── লেখক ── */}
      <SectionLabel label="লেখক" isDark={isDark} />
      <div className="space-y-4 mb-6">
        <Field icon={<User size={12} />} label="লেখকের নাম" sublabel="বাংলায়" error={err("authorBengali", metadata.authorBengali)} filled={filled(metadata.authorBengali)}>
          <input
            type="text" value={metadata.authorBengali}
            onChange={(e) => update("authorBengali", e.target.value)}
            onBlur={() => touch("authorBengali")}
            placeholder="যেমন: মাহমুদা সুলতানা একা"
            className={bnInput(!!err("authorBengali", metadata.authorBengali))}
            lang="bn"
            style={{ fontFamily: "'Noto Sans Bengali', 'Hind Siliguri', 'Kalpurush', system-ui, sans-serif" }}
          />
        </Field>

        <Field icon={<User size={12} />} label="লেখকের নাম" sublabel="ইংরেজিতে, sort এর জন্য" error={err("authorFileAs", metadata.authorFileAs)} filled={filled(metadata.authorFileAs)}>
          <input
            type="text" value={metadata.authorFileAs}
            onChange={(e) => update("authorFileAs", e.target.value)}
            onBlur={() => touch("authorFileAs")}
            placeholder="Mahmuda Sultana Eka"
            className={enInput(!!err("authorFileAs", metadata.authorFileAs))}
          />
        </Field>
      </div>

      {/* ── প্রকাশনা ── */}
      <SectionLabel label="প্রকাশনা" isDark={isDark} />
      <div className="grid grid-cols-2 gap-4">
        <Field icon={<Building2 size={12} />} label="Publisher" error={err("publisher", metadata.publisher)} filled={filled(metadata.publisher)}>
          <input
            type="text" value={metadata.publisher}
            onChange={(e) => update("publisher", e.target.value)}
            onBlur={() => touch("publisher")}
            placeholder="Boitoi"
            className={enInput(!!err("publisher", metadata.publisher))}
          />
        </Field>

        <Field icon={<Globe size={12} />} label="Language" filled={true}>
          <select
            value={metadata.language}
            onChange={(e) => update("language", e.target.value)}
            className={`${enInput(false)} cursor-pointer`}
          >
            <option value="bn">Bengali (bn)</option>
            <option value="en">English (en)</option>
          </select>
        </Field>
      </div>

    </div>
  );
};

export default MetadataStep;
