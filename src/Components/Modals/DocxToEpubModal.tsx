import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  X, FileText, Loader2, Download, CheckCircle2,
  AlertCircle, BookOpen, ArrowRight, RefreshCw,
} from "lucide-react";
import mammoth from "mammoth";
import JSZip from "jszip";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
  isDark: boolean;
}

interface EpubMeta {
  title: string;
  author: string;
  language: string;
  publisher: string;
}

interface Chapter {
  title: string;
  content: string;
  index: number;
}

// ── HTML থেকে chapters আলাদা করা ────────────────────────────────────────
function splitIntoChapters(html: string): Chapter[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  const chapters: Chapter[] = [];
  let currentTitle = "Introduction";
  let currentNodes: Node[] = [];

  const flushChapter = () => {
    if (currentNodes.length === 0) return;
    const div = document.createElement("div");
    currentNodes.forEach((n) => div.appendChild(n.cloneNode(true)));
    const content = div.innerHTML.trim();
    if (content) {
      chapters.push({
        title: currentTitle,
        content,
        index: chapters.length,
      });
    }
    currentNodes = [];
  };

  for (const node of Array.from(body.childNodes)) {
    const el = node as Element;
    const tag = el.tagName?.toLowerCase();

    if (tag === "h1" || tag === "h2") {
      flushChapter();
      currentTitle = el.textContent?.trim() || `Chapter ${chapters.length + 1}`;
      currentNodes = [];
    } else {
      currentNodes.push(node);
    }
  }
  flushChapter();

  // কোনো chapter না থাকলে পুরোটা একটা chapter
  if (chapters.length === 0) {
    chapters.push({ title: "Content", content: body.innerHTML, index: 0 });
  }

  return chapters;
}

// ── Clean HTML for XHTML ─────────────────────────────────────────────────
function toXhtmlContent(html: string): string {
  return html
    .replace(/<br>/gi, "<br/>")
    .replace(/<img([^>]*)>/gi, "<img$1/>")
    .replace(/<hr([^>]*)>/gi, "<hr$1/>")
    .replace(/<input([^>]*)>/gi, "<input$1/>")
    .replace(/&nbsp;/g, "&#160;")
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi, "&amp;")
    .replace(/<\/p>\s*<p/gi, "</p>\n\n<p");
}

// ── Section XHTML template ───────────────────────────────────────────────
function makeSectionXhtml(content: string, bookTitle: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"
  "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${bookTitle}</title>
  <meta http-equiv="Content-Type" content="application/xhtml+xml; charset=utf-8"/>
  <style type="text/css">p { margin-top: 0.8em; margin-bottom: 0; }</style>
</head>
<body>
  ${toXhtmlContent(content)}
</body>
</html>`;
}

// ── OPF (content.opf) ────────────────────────────────────────────────────
function makeOpf(meta: EpubMeta, chapters: Chapter[], uid: string): string {
  const manifestItems = chapters
    .map((c) => {
      const fname = chapters.length === 1 ? "main.xhtml" : `main${String(c.index).padStart(4, "0")}.xhtml`;
      return `    <item id="section${String(c.index).padStart(4, "0")}" href="Text/${fname}" media-type="application/xhtml+xml"/>`;
    })
    .join("\n");

  const spineItems = chapters
    .map((c) => `    <itemref idref="section${String(c.index).padStart(4, "0")}"/>`)
    .join("\n");

  const today = new Date().toISOString().split("T")[0];

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${meta.title}</dc:title>
    <dc:creator opf:role="aut">${meta.author}</dc:creator>
    <dc:publisher>${meta.publisher}</dc:publisher>
    <dc:language>${meta.language}</dc:language>
    <dc:identifier id="BookId">urn:uuid:${uid}</dc:identifier>
    <dc:date opf:event="modification">${today}</dc:date>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
}

// ── NCX (toc.ncx) ────────────────────────────────────────────────────────
function makeNcx(meta: EpubMeta, chapters: Chapter[], uid: string): string {
  const navPoints = chapters
    .map((c, i) => {
      const fname = chapters.length === 1 ? "main.xhtml" : `main${String(c.index).padStart(4, "0")}.xhtml`;
      return `  <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
    <navLabel><text>${c.title}</text></navLabel>
    <content src="Text/${fname}"/>
  </navPoint>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN"
  "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${meta.title}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`;
}

// ── UUID generate ─────────────────────────────────────────────────────────
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── EPUB blob বানানো ─────────────────────────────────────────────────────
async function buildEpub(meta: EpubMeta, chapters: Chapter[]): Promise<Blob> {
  const zip = new JSZip();
  const uid = generateUUID();

  // mimetype — must be first, uncompressed
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // META-INF
  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // OEBPS
  zip.file("OEBPS/content.opf", makeOpf(meta, chapters, uid));
  zip.file("OEBPS/toc.ncx", makeNcx(meta, chapters, uid));

  // Sections
  for (const chapter of chapters) {
    const filename = chapters.length === 1
      ? "main.xhtml"
      : `main${String(chapter.index).padStart(4, "0")}.xhtml`;
    zip.file(`OEBPS/Text/${filename}`, makeSectionXhtml(chapter.title, chapter.content, meta.title));
  }

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

// ── Format size ───────────────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ══════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════
export const DocxToEpubModal = ({ isOpen, onClose, theme: t, isDark }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<EpubMeta>({
    title: "", author: "", language: "bn", publisher: "Boitoi",
  });
  const [processing, setProcessing] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [chapterCount, setChapterCount] = useState(0);
  const [error, setError] = useState("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setOutputBlob(null);
    setError("");
    setChapterCount(0);
    // ফাইলের নাম থেকে title guess
    const guessed = f.name.replace(/\.docx$/i, "").replace(/[-_]/g, " ");
    setMeta((prev) => ({ ...prev, title: prev.title || guessed }));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    multiple: false,
  });

  const handleConvert = async () => {
    if (!file) return;
    if (!meta.title.trim() || !meta.author.trim()) {
      setError("Title এবং Author দেওয়া বাধ্যতামূলক।");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;
      const chapters = splitIntoChapters(html);
      setChapterCount(chapters.length);
      const epub = await buildEpub(meta, chapters);
      setOutputBlob(epub);
    } catch (err: any) {
      setError("Conversion failed: " + (err.message || "Unknown error"));
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob) return;
    const url = URL.createObjectURL(outputBlob);
    const link = document.createElement("a");
    link.download = `${meta.title.replace(/\s+/g, "_") || "book"}.epub`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleClose = () => {
    setFile(null);
    setMeta({ title: "", author: "", language: "bn", publisher: "Boitoi" });
    setOutputBlob(null);
    setError("");
    setChapterCount(0);
    onClose();
  };

  const inputClass = `w-full border-2 rounded-xl px-4 py-2.5 text-sm font-medium outline-none transition-all ${t.input}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={handleClose} />

      <div className={`${t.card} border ${t.cardBorder} w-full max-w-lg rounded-[32px] shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]`}>

        {/* Header */}
        <div className="relative p-8 pb-5 shrink-0">
          <button onClick={handleClose} className={`absolute right-6 top-6 p-2 rounded-full ${t.stepInactive} ${t.surfaceHover} ${t.textMuted} transition-all`}>
            <X size={18} />
          </button>
          <div className="flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center mb-4 ${isDark ? "bg-purple-900/30" : "bg-purple-50"} text-purple-500`}>
              <BookOpen size={30} />
            </div>
            <h2 className={`text-2xl font-black tracking-tight ${t.textPrimary}`}>DOCX → EPUB</h2>
            <p className={`text-xs font-bold mt-1 uppercase tracking-widest ${t.textMuted}`}>
              Word Document to EPUB Converter
            </p>
          </div>
        </div>

        <div className="px-8 pb-8 space-y-4 overflow-y-auto flex-1">

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`w-full p-5 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center ${
              file
                ? `${isDark ? "border-purple-500/50 bg-purple-900/10" : "border-purple-400/50 bg-purple-50"}`
                : isDragActive ? t.dropzoneActive : t.dropzone
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? "bg-purple-900/30" : "bg-purple-100"} text-purple-500`}>
                  <FileText size={20} />
                </div>
                <div className="text-left min-w-0">
                  <p className={`text-sm font-black truncate ${t.textPrimary}`}>{file.name}</p>
                  <p className={`text-xs ${t.textMuted}`}>{formatSize(file.size)}</p>
                </div>
                <p className={`ml-auto text-xs font-bold ${t.textMuted} shrink-0`}>Change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileText size={26} className={isDark ? "text-gray-600" : "text-gray-400"} />
                <p className={`text-sm font-bold ${t.textPrimary}`}>
                  {isDragActive ? "Drop DOCX here!" : "Click or Drag .docx file"}
                </p>
                <p className={`text-xs ${t.textMuted}`}>.docx files only</p>
              </div>
            )}
          </div>

          {/* Metadata form */}
          <div className={`p-4 rounded-2xl border ${t.cardBorder} space-y-3`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Book Info</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[10px] font-black ${t.textMuted} mb-1.5 uppercase tracking-wider`}>
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text" value={meta.title}
                  onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                  placeholder="বইয়ের নাম"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={`block text-[10px] font-black ${t.textMuted} mb-1.5 uppercase tracking-wider`}>
                  Author <span className="text-red-400">*</span>
                </label>
                <input
                  type="text" value={meta.author}
                  onChange={(e) => setMeta({ ...meta, author: e.target.value })}
                  placeholder="লেখকের নাম"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`block text-[10px] font-black ${t.textMuted} mb-1.5 uppercase tracking-wider`}>Publisher</label>
                <input
                  type="text" value={meta.publisher}
                  onChange={(e) => setMeta({ ...meta, publisher: e.target.value })}
                  placeholder="Boitoi"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={`block text-[10px] font-black ${t.textMuted} mb-1.5 uppercase tracking-wider`}>Language</label>
                <select
                  value={meta.language}
                  onChange={(e) => setMeta({ ...meta, language: e.target.value })}
                  className={inputClass}
                >
                  <option value="bn">Bengali (bn)</option>
                  <option value="en">English (en)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className={`p-3 rounded-xl flex gap-2 ${isDark ? "bg-purple-900/20 border border-purple-800/30" : "bg-purple-50 border border-purple-100"}`}>
            <BookOpen size={13} className="text-purple-500 shrink-0 mt-0.5" />
            <p className={`text-[10px] font-bold ${isDark ? "text-purple-400" : "text-purple-600"} leading-relaxed`}>
              DOCX এর <strong>H1/H2 headings</strong> দেখে chapters আলাদা হবে।
              Heading না থাকলে পুরোটা একটা chapter হবে।
              Bold, italic, paragraph formatting বজায় থাকবে।
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-400">{error}</p>
            </div>
          )}

          {/* Success result */}
          {outputBlob && (
            <div className={`p-4 rounded-2xl border ${isDark ? "border-green-800/30 bg-green-900/10" : "border-green-200 bg-green-50"}`}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={18} className="text-green-500" />
                <p className={`font-black text-sm ${isDark ? "text-green-400" : "text-green-700"}`}>EPUB Ready!</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`p-2.5 rounded-xl ${isDark ? "bg-black/20" : "bg-white"}`}>
                  <p className={`text-[10px] font-black uppercase ${t.textMuted}`}>Chapters</p>
                  <p className={`text-xl font-black ${isDark ? "text-green-400" : "text-green-600"}`}>{chapterCount}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${isDark ? "bg-black/20" : "bg-white"}`}>
                  <p className={`text-[10px] font-black uppercase ${t.textMuted}`}>Format</p>
                  <p className={`text-xl font-black ${isDark ? "text-purple-400" : "text-purple-600"}`}>EPUB</p>
                </div>
                <div className={`p-2.5 rounded-xl ${isDark ? "bg-black/20" : "bg-white"}`}>
                  <p className={`text-[10px] font-black uppercase ${t.textMuted}`}>Size</p>
                  <p className={`text-xl font-black ${isDark ? "text-blue-400" : "text-blue-600"}`}>{formatSize(outputBlob.size)}</p>
                </div>
              </div>
              <div className={`mt-3 flex items-center justify-center gap-2 text-xs font-bold ${t.textMuted}`}>
                <FileText size={12} />
                <span>{file?.name}</span>
                <ArrowRight size={12} />
                <span className={isDark ? "text-green-400" : "text-green-600"}>{meta.title}.epub</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!outputBlob ? (
              <button
                onClick={handleConvert}
                disabled={!file || processing}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {processing ? (
                  <><Loader2 size={18} className="animate-spin" /> Converting...</>
                ) : (
                  <><RefreshCw size={18} /> Convert to EPUB</>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setOutputBlob(null); setChapterCount(0); }}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-sm border-2 ${t.cardBorder} ${t.surfaceHover} ${t.textSecondary} transition-all`}
                >
                  New File
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 transition-all active:scale-[0.98]"
                >
                  <Download size={18} /> Download EPUB
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
