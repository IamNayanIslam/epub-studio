import { useEpub } from "../../Store/EpubContext";

import { BookOpen, User, Tag, Building2, Globe } from "lucide-react";
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

// ── Field wrapper ─────────────────────────────────────────────────────────
const Field = ({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
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
      </label>
      {children}
      {hint && <p className={`text-[10px] ${t.textMuted} italic`}>{hint}</p>}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────
const MetadataStep = () => {
  const { state, dispatch } = useEpub();
  const { isDark } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;
  const { metadata } = state;

  const update = (field: string, value: string) => {
    dispatch({ type: "UPDATE_METADATA", payload: { [field]: value } });
  };

  const inputClass = `w-full border-2 rounded-xl px-4 py-3 font-medium text-sm outline-none transition-all ${t.input}`;

  return (
    <div className="max-w-xl mx-auto space-y-5 p-1">
      <div className="mb-4">
        <h2 className={`text-xl font-black ${t.textPrimary}`}>Book Metadata</h2>
        <p className={`text-xs ${t.textMuted} mt-1`}>
          এই তথ্যগুলো EPUB এর OPF ফাইলে সংরক্ষিত হবে।
        </p>
      </div>

      <Field icon={<BookOpen size={11} />} label="বইয়ের নাম">
        <input
          type="text"
          value={metadata.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="যেমন: চোখের আরশিতে সমুদ্দুর"
          className={inputClass}
        />
      </Field>

      <Field icon={<User size={11} />} label="লেখকের নাম" hint="বাংলায় লিখুন">
        <input
          type="text"
          value={metadata.authorBengali}
          onChange={(e) => update("authorBengali", e.target.value)}
          placeholder="যেমন: মাহমুদা সুলতানা একা"
          className={inputClass}
        />
      </Field>

      <Field
        icon={<User size={11} />}
        label="লেখকের নাম (ইংরেজিতে)"
        hint="Sort করার জন্য — File As"
      >
        <input
          type="text"
          value={metadata.authorFileAs}
          onChange={(e) => update("authorFileAs", e.target.value)}
          placeholder="যেমন: Mahmuda Sultana Eka"
          className={inputClass}
        />
      </Field>

      <Field
        icon={<Tag size={11} />}
        label="Genre / Subject"
        hint="একাধিক হলে comma দিয়ে লিখুন — Romance, Drama"
      >
        <input
          type="text"
          value={metadata.subjects}
          onChange={(e) => update("subjects", e.target.value)}
          placeholder="যেমন: Romance, Drama"
          className={inputClass}
        />
      </Field>

      <Field icon={<Building2 size={11} />} label="Publisher">
        <input
          type="text"
          value={metadata.publisher}
          onChange={(e) => update("publisher", e.target.value)}
          placeholder="Boitoi"
          className={inputClass}
        />
      </Field>

      <Field icon={<Globe size={11} />} label="Language">
        <select
          value={metadata.language}
          onChange={(e) => update("language", e.target.value)}
          className={inputClass}
        >
          <option value="bn">Bengali (bn)</option>
          <option value="en">English (en)</option>
        </select>
      </Field>
    </div>
  );
};

export default MetadataStep;
