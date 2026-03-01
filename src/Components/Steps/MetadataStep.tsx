// import { useEpub } from "../Store/EpubContext";
// import { useTheme, tokens } from "../Store/ThemeContext";
import {
  BookOpen,
  User,
  Tag,
  Building2,
  Globe,
  AlertCircle,
} from "lucide-react";
import React from "react";
import { useEpub } from "../../Store/EpubContext";
import { tokens, useTheme } from "../../Store/ThemeContext";

// ── OPF এ metadata update করা ────────────────────────────────────────────
export const updateMetadataInBlob = async (
  epubBlob: Blob,
  metadata: {
    title: string;
    authorBengali: string;
    authorFileAs: string;
    subjects: string;
    publisher: string;
    language: string;
  },
): Promise<Blob> => {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const content = await zip.loadAsync(await epubBlob.arrayBuffer());

  for (const [filePath, file] of Object.entries(content.files)) {
    if (file.dir) continue;
    zip.file(filePath, await file.async("uint8array"));
  }

  const opfPath = Object.keys(content.files).find((p) => p.endsWith(".opf"));
  if (!opfPath) throw new Error("OPF not found!");

  let opf = await content.file(opfPath)!.async("string");

  if (metadata.title) {
    opf = opf.replace(
      /<dc:title>.*?<\/dc:title>/,
      `<dc:title>${metadata.title}</dc:title>`,
    );
  }

  const creatorTag = `<dc:creator opf:file-as="${metadata.authorFileAs}" opf:role="aut">${metadata.authorBengali}</dc:creator>`;
  if (opf.includes("<dc:creator")) {
    opf = opf.replace(/<dc:creator[^>]*>.*?<\/dc:creator>/, creatorTag);
  } else {
    opf = opf.replace("</metadata>", `  ${creatorTag}\n  </metadata>`);
  }

  opf = opf.replace(/<dc:subject>.*?<\/dc:subject>\n?/g, "");
  if (metadata.subjects.trim()) {
    const subjectTags = metadata.subjects
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `    <dc:subject>${s}</dc:subject>`)
      .join("\n");
    opf = opf.replace("</metadata>", `${subjectTags}\n  </metadata>`);
  }

  opf = opf.replace(/<dc:publisher>.*?<\/dc:publisher>\n?/g, "");
  opf = opf.replace(
    "</metadata>",
    `    <dc:publisher>${metadata.publisher}</dc:publisher>\n  </metadata>`,
  );

  if (opf.includes("<dc:language>")) {
    opf = opf.replace(
      /<dc:language>.*?<\/dc:language>/,
      `<dc:language>${metadata.language}</dc:language>`,
    );
  } else {
    opf = opf.replace(
      "</metadata>",
      `    <dc:language>${metadata.language}</dc:language>\n  </metadata>`,
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const dateTag = `<dc:date opf:event="modification" xmlns:opf="http://www.idpf.org/2007/opf">${today}</dc:date>`;
  if (opf.includes('opf:event="modification"')) {
    opf = opf.replace(
      /<dc:date opf:event="modification"[^>]*>.*?<\/dc:date>/,
      dateTag,
    );
  } else {
    opf = opf.replace("</metadata>", `    ${dateTag}\n  </metadata>`);
  }

  zip.file(opfPath, opf);

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
};

// ── Validation helper — MainContainer থেকে call করা যাবে ─────────────────
export const validateMetadata = (metadata: {
  title: string;
  authorBengali: string;
  authorFileAs: string;
  subjects: string;
  publisher: string;
}): string[] => {
  const errors: string[] = [];
  if (!metadata.title?.trim()) errors.push("বইয়ের নাম");
  if (!metadata.authorBengali?.trim()) errors.push("লেখকের নাম (বাংলা)");
  if (!metadata.authorFileAs?.trim()) errors.push("লেখকের নাম (ইংরেজি)");
  if (!metadata.subjects?.trim()) errors.push("Genre / Subject");
  if (!metadata.publisher?.trim()) errors.push("Publisher");
  return errors;
};

// ── Field wrapper ─────────────────────────────────────────────────────────
const Field = ({
  icon,
  label,
  hint,
  error,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => {
  const { isDark } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;
  return (
    <div className="space-y-1.5">
      <label
        className={`flex items-center gap-2 text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}
      >
        {icon} {label}
        {error && (
          <span className="ml-auto text-red-500 normal-case tracking-normal font-bold text-[10px] flex items-center gap-1">
            <AlertCircle size={10} /> {error}
          </span>
        )}
      </label>
      {children}
      {!error && hint && (
        <p className={`text-[10px] ${t.textMuted} italic`}>{hint}</p>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────
const MetadataStep = () => {
  const { state, dispatch } = useEpub();
  const { isDark } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;
  const { metadata } = state;
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const update = (field: string, value: string) =>
    dispatch({ type: "UPDATE_METADATA", payload: { [field]: value } });

  const touch = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const err = (field: string, value: string) =>
    touched[field] && !value?.trim() ? "খালি রাখা যাবে না" : undefined;

  const inputClass = (hasError: boolean) =>
    `w-full border-2 rounded-xl px-4 py-3 font-medium text-sm outline-none transition-all ${
      hasError
        ? `border-red-400 focus:border-red-500 ${isDark ? "bg-red-900/10" : "bg-red-50/60"}`
        : t.input
    }`;

  const requiredFields = [
    { key: "title", value: metadata.title },
    { key: "authorBengali", value: metadata.authorBengali },
    { key: "authorFileAs", value: metadata.authorFileAs },
    { key: "subjects", value: metadata.subjects },
    { key: "publisher", value: metadata.publisher },
  ];

  const touchedCount = Object.keys(touched).length;
  const emptyCount = requiredFields.filter((f) => !f.value?.trim()).length;

  return (
    <div className="max-w-xl mx-auto space-y-5 p-1">
      <div className="mb-4">
        <h2 className={`text-xl font-black ${t.textPrimary}`}>Book Metadata</h2>
        <p className={`text-xs ${t.textMuted} mt-1`}>
          এই তথ্যগুলো EPUB এর OPF ফাইলে সংরক্ষিত হবে।
        </p>
      </div>

      {touchedCount > 0 && emptyCount > 0 && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
            isDark
              ? "bg-red-900/20 border-red-800/30"
              : "bg-red-50 border-red-200"
          }`}
        >
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-red-500 text-xs font-bold leading-relaxed">
            {emptyCount}টি field খালি আছে। Download করার আগে সব তথ্য পূরণ করুন।
          </p>
        </div>
      )}

      <Field
        icon={<BookOpen size={11} />}
        label="বইয়ের নাম"
        error={err("title", metadata.title)}
      >
        <input
          type="text"
          value={metadata.title}
          onChange={(e) => update("title", e.target.value)}
          onBlur={() => touch("title")}
          placeholder="যেমন: চোখের আরশিতে সমুদ্দুর"
          className={inputClass(!!err("title", metadata.title))}
        />
      </Field>

      <Field
        icon={<User size={11} />}
        label="লেখকের নাম"
        hint="বাংলায় লিখুন"
        error={err("authorBengali", metadata.authorBengali)}
      >
        <input
          type="text"
          value={metadata.authorBengali}
          onChange={(e) => update("authorBengali", e.target.value)}
          onBlur={() => touch("authorBengali")}
          placeholder="যেমন: মাহমুদা সুলতানা একা"
          className={inputClass(!!err("authorBengali", metadata.authorBengali))}
        />
      </Field>

      <Field
        icon={<User size={11} />}
        label="লেখকের নাম (ইংরেজিতে)"
        hint="Sort করার জন্য — File As"
        error={err("authorFileAs", metadata.authorFileAs)}
      >
        <input
          type="text"
          value={metadata.authorFileAs}
          onChange={(e) => update("authorFileAs", e.target.value)}
          onBlur={() => touch("authorFileAs")}
          placeholder="যেমন: Mahmuda Sultana Eka"
          className={inputClass(!!err("authorFileAs", metadata.authorFileAs))}
        />
      </Field>

      <Field
        icon={<Tag size={11} />}
        label="Genre / Subject"
        hint="একাধিক হলে comma দিয়ে লিখুন — Romance, Drama"
        error={err("subjects", metadata.subjects)}
      >
        <input
          type="text"
          value={metadata.subjects}
          onChange={(e) => update("subjects", e.target.value)}
          onBlur={() => touch("subjects")}
          placeholder="যেমন: Romance, Drama"
          className={inputClass(!!err("subjects", metadata.subjects))}
        />
      </Field>

      <Field
        icon={<Building2 size={11} />}
        label="Publisher"
        error={err("publisher", metadata.publisher)}
      >
        <input
          type="text"
          value={metadata.publisher}
          onChange={(e) => update("publisher", e.target.value)}
          onBlur={() => touch("publisher")}
          placeholder="Boitoi"
          className={inputClass(!!err("publisher", metadata.publisher))}
        />
      </Field>

      <Field icon={<Globe size={11} />} label="Language">
        <select
          value={metadata.language}
          onChange={(e) => update("language", e.target.value)}
          className={inputClass(false)}
        >
          <option value="bn">Bengali (bn)</option>
          <option value="en">English (en)</option>
        </select>
      </Field>
    </div>
  );
};

export default MetadataStep;
