import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileWarning, Loader2, CheckCircle2, FileText } from "lucide-react";
import { processEpubFile } from "../../Utils/EpubProcessor";
import { processAndSplitEpub } from "../../Utils/EpubSplit";
import { useEpub } from "../../Store/EpubContext";
import { useTheme, tokens } from "../../Store/ThemeContext";
import mammoth from "mammoth";
import JSZip from "jszip";

interface ModalState {
  type: "missing-points" | "no-points";
  data: { wordCount: number; missingPoints?: number[]; totalSplits?: number };
}

// ── DOCX → EPUB helpers ──────────────────────────────────────────────────

function splitIntoChapters(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;
  const chapters: { title: string; content: string; index: number }[] = [];
  let currentTitle = "Content";
  let currentNodes: Node[] = [];

  const flush = () => {
    const div = document.createElement("div");
    currentNodes.forEach((n) => div.appendChild(n.cloneNode(true)));
    const content = div.innerHTML.trim();
    if (content) chapters.push({ title: currentTitle, content, index: chapters.length });
    currentNodes = [];
  };

  for (const node of Array.from(body.childNodes)) {
    const el = node as Element;
    const tag = el.tagName?.toLowerCase();
    if (tag === "h1" || tag === "h2") {
      flush();
      currentTitle = el.textContent?.trim() || `Chapter ${chapters.length + 1}`;
    } else {
      currentNodes.push(node);
    }
  }
  flush();

  if (chapters.length === 0) chapters.push({ title: "Content", content: body.innerHTML, index: 0 });
  return chapters;
}

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

function makeSectionXhtml(bookTitle: string, content: string): string {
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

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function convertDocxToEpubFile(docxFile: File): Promise<File> {
  const arrayBuffer = await docxFile.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const chapters = splitIntoChapters(result.value);
  const bookTitle = docxFile.name.replace(/\.docx$/i, "").replace(/[-_]/g, " ");
  const uid = generateUUID();
  const today = new Date().toISOString().split("T")[0];
  const zip = new JSZip();

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  const fname = (c: { index: number }) =>
    chapters.length === 1 ? "main.xhtml" : `main${String(c.index).padStart(4, "0")}.xhtml`;

  const manifestItems = chapters.map((c) =>
    `    <item id="section${String(c.index).padStart(4, "0")}" href="Text/${fname(c)}" media-type="application/xhtml+xml"/>`
  ).join("\n");

  const spineItems = chapters.map((c) =>
    `    <itemref idref="section${String(c.index).padStart(4, "0")}"/>`
  ).join("\n");

  zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${bookTitle}</dc:title>
    <dc:language>bn</dc:language>
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
</package>`);

  const navPoints = chapters.map((c, i) =>
    `  <navPoint id="navPoint-${i + 1}" playOrder="${i + 1}">
    <navLabel><text>${c.title}</text></navLabel>
    <content src="Text/${fname(c)}"/>
  </navPoint>`
  ).join("\n");

  zip.file("OEBPS/toc.ncx", `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN"
  "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${bookTitle}</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>`);

  for (const chapter of chapters) {
    zip.file(`OEBPS/Text/${fname(chapter)}`, makeSectionXhtml(bookTitle, chapter.content));
  }

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return new File([blob], docxFile.name.replace(/\.docx$/i, ".epub"), {
    type: "application/epub+zip",
  });
}

// ════════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════════
const UploadStep = () => {
  const { dispatch } = useEpub();
  const { isDark } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;

  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [detectedSplits, setDetectedSplits] = useState<number | null>(null);
  const [showModal, setShowModal] = useState<ModalState | null>(null);
  const [customSplitCount, setCustomSplitCount] = useState<number>(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<"count" | "heading">("count");
  const [isDocx, setIsDocx] = useState(false);

  const runSplitAndDispatch = async (
    file: File,
    splitConfig: { isManual: boolean; count: number; mode?: "auto" | "manual" | "heading" },
  ) => {
    const blob = await processAndSplitEpub(file, splitConfig);
    dispatch({ type: "SET_PROCESSED_BLOB", payload: blob });
  };

  const processEpub = useCallback(async (file: File) => {
    setIsProcessing(true);
    setIsSuccess(false);
    setDetectedSplits(null);
    setUploadedFile(file);

    try {
      const result = await processEpubFile(file);
      setIsProcessing(false);

      if (result.status === "success") {
        const totalSplits: number = result.data.totalSplits ?? 0;
        setIsSuccess(true);
        setDetectedSplits(totalSplits);
        dispatch({ type: "SET_FILE", payload: { file, wordCount: result.data.wordCount, missing: [] } });
        dispatch({ type: "UPDATE_SPLIT_CONFIG", payload: { isManual: true, splitCount: totalSplits } });
        await runSplitAndDispatch(file, { isManual: true, count: totalSplits });
      } else if (result.status === "error") {
        const errorType = result.errorType as "missing-points" | "no-points";
        const suggestion = Math.ceil(result.data.wordCount / 1500);
        setCustomSplitCount(suggestion);
        setShowModal({ type: errorType, data: result.data });
        dispatch({ type: "SET_FILE", payload: { file, wordCount: result.data.wordCount, missing: result.data.missingPoints || [] } });
      }
    } catch (err) {
      setIsProcessing(false);
      console.error("Processing Error:", err);
      alert("ফাইলটি প্রসেস করা যাচ্ছে না। সঠিক ফাইল দিন।");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const isDocxFile = file.name.toLowerCase().endsWith(".docx");
    setIsDocx(isDocxFile);

    if (isDocxFile) {
      setIsConverting(true);
      setIsSuccess(false);
      try {
        const epubFile = await convertDocxToEpubFile(file);
        setIsConverting(false);
        await processEpub(epubFile);
      } catch (err) {
        setIsConverting(false);
        console.error("DOCX conversion failed:", err);
        alert("DOCX ফাইলটি convert করা যাচ্ছে না।");
      }
    } else {
      await processEpub(file);
    }
  }, [processEpub]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/epub+zip": [".epub"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    multiple: false,
  });

  const handleModalAction = async () => {
    if (!showModal || !uploadedFile) return;
    let splitConfig: { isManual: boolean; count: number; mode?: "auto" | "manual" | "heading" };

    if (showModal.type === "no-points" && splitMode === "heading") {
      splitConfig = { isManual: false, count: 0, mode: "heading" };
      dispatch({ type: "UPDATE_SPLIT_CONFIG", payload: { isManual: false, splitCount: 0 } });
    } else if (showModal.type === "no-points") {
      splitConfig = { isManual: false, count: customSplitCount, mode: "manual" };
      dispatch({ type: "UPDATE_SPLIT_CONFIG", payload: { isManual: false, splitCount: customSplitCount } });
    } else {
      const totalSplits: number = showModal.data.totalSplits ?? 0;
      splitConfig = { isManual: true, count: totalSplits, mode: "auto" };
      dispatch({ type: "UPDATE_SPLIT_CONFIG", payload: { isManual: true, splitCount: totalSplits } });
    }

    await runSplitAndDispatch(uploadedFile, splitConfig);
    setShowModal(null);
    dispatch({ type: "SET_STEP", payload: 1 });
  };

  const busy = isConverting || isProcessing;

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-10">
      <div
        {...getRootProps()}
        className={`w-full max-w-xl p-10 sm:p-14 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
          ${isSuccess ? t.dropzoneSuccess : isDragActive ? t.dropzoneActive : t.dropzone}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-5 text-center">

          {/* Icon */}
          {busy ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-12 h-12 text-green-500 animate-bounce" />
          ) : (
            <div className={`w-16 h-16 rounded-2xl ${isDark ? "bg-[#252836]" : "bg-gray-100"} flex items-center justify-center relative`}>
              <Upload className={`w-7 h-7 ${t.textMuted}`} />
              <FileText className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 ${isDark ? "text-purple-400" : "text-purple-500"}`} />
            </div>
          )}

          {/* Text */}
          <div className={`text-base font-semibold ${isSuccess ? "text-green-500" : t.textSecondary}`}>
            {isConverting ? (
              <span className={t.textMuted}>DOCX থেকে EPUB এ রূপান্তর হচ্ছে...</span>
            ) : isProcessing ? (
              <span className={t.textMuted}>ফাইলটি বিশ্লেষণ করা হচ্ছে...</span>
            ) : isSuccess ? (
              <div className="flex flex-col gap-2">
                <span className="text-lg font-bold text-green-500">সফলভাবে প্রসেস হয়েছে!</span>
                {isDocx && (
                  <span className={`text-xs px-3 py-1 rounded-full font-bold inline-block mx-auto ${isDark ? "bg-purple-900/30 text-purple-400" : "bg-purple-100 text-purple-700"}`}>
                    DOCX → EPUB রূপান্তর সম্পন্ন
                  </span>
                )}
                <span className={`text-sm px-4 py-1 rounded-full font-bold inline-block mx-auto ${isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"}`}>
                  মোট {detectedSplits} টি স্প্লিট পয়েন্ট পাওয়া গেছে
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <p className={`font-bold ${t.textPrimary}`}>Drag & drop EPUB or DOCX file</p>
                <p className={`text-sm ${t.textMuted}`}>or click to select</p>
              </div>
            )}
          </div>

          {isSuccess && (
            <div className={`w-full ${isDark ? "bg-[#2A2D3E]" : "bg-gray-200"} h-1 rounded-full overflow-hidden mt-2`}>
              <div className="bg-green-500 h-full w-full origin-left animate-[progress_3s_linear]" />
            </div>
          )}
        </div>
      </div>

      {/* Format badges */}
      {!busy && !isSuccess && (
        <div className="flex gap-2 mt-4">
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${isDark ? "border-blue-800/50 text-blue-400 bg-blue-900/20" : "border-blue-200 text-blue-600 bg-blue-50"}`}>
            .epub
          </span>
          <span className={`text-[10px] font-bold px-3 py-1 rounded-full border ${isDark ? "border-purple-800/50 text-purple-400 bg-purple-900/20" : "border-purple-200 text-purple-600 bg-purple-50"}`}>
            .docx → epub
          </span>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className={`fixed inset-0 ${t.overlay} backdrop-blur-sm flex items-center justify-center p-4 z-50`}>
          <div className={`${t.modal} border ${t.cardBorder} p-7 rounded-2xl max-w-md w-full shadow-2xl`}>
            <h3 className={`text-lg font-black flex items-center gap-2 mb-4 ${t.textPrimary} uppercase tracking-tight`}>
              <FileWarning className="text-amber-500" size={20} />
              {showModal.type === "missing-points" ? "Split Points Missing" : "No Split Points Found"}
            </h3>

            <div className={`${t.textSecondary} mb-6 leading-relaxed text-sm`}>
              {showModal.type === "missing-points" ? (
                <div className="space-y-3">
                  <p>বইটিতে নিচের পয়েন্টগুলো পাওয়া যায়নি:</p>
                  <div className="flex flex-wrap gap-2">
                    {showModal.data.missingPoints?.map((p) => (
                      <span key={p} className={`${t.tagBg} px-2 py-1 rounded-md font-bold text-xs border`}>{p}</span>
                    ))}
                  </div>
                  <p className={`text-xs ${t.textMuted}`}>আপনি কি এই অবস্থাতেই স্প্লিট করতে চান?</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p>
                    কোনো নির্ধারিত স্প্লিট প্যাটার্ন পাওয়া যায়নি। মোট শব্দ:{" "}
                    <span className={`font-bold ${t.textPrimary}`}>{showModal.data.wordCount}</span>
                  </p>

                  {/* Mode selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSplitMode("count")}
                      className={`py-2.5 rounded-xl font-bold text-xs border-2 transition-all ${
                        splitMode === "count"
                          ? "border-blue-600 bg-blue-600 text-white"
                          : isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400" : "border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      Word Count দিয়ে
                    </button>
                    <button
                      onClick={() => setSplitMode("heading")}
                      className={`py-2.5 rounded-xl font-bold text-xs border-2 transition-all ${
                        splitMode === "heading"
                          ? "border-purple-600 bg-purple-600 text-white"
                          : isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400" : "border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      ## Heading দিয়ে
                    </button>
                  </div>

                  {splitMode === "count" ? (
                    <div className={`${isDark ? "bg-blue-900/20 border-blue-800" : "bg-blue-50 border-blue-100"} p-4 rounded-xl border`}>
                      <label className="block text-xs font-bold text-blue-500 mb-2 uppercase tracking-widest">
                        How many splits?
                      </label>
                      <input
                        type="number"
                        value={customSplitCount}
                        onChange={(e) => setCustomSplitCount(parseInt(e.target.value) || 1)}
                        className={`w-full border-2 rounded-lg px-3 py-2 font-bold outline-none transition-all text-sm ${isDark ? "bg-[#252836] border-blue-800 text-gray-100 focus:border-blue-500" : "bg-white border-blue-200 text-blue-800 focus:border-blue-500"}`}
                      />
                      <p className="text-[10px] text-blue-400 mt-2 italic">
                        *১৫০০ শব্দে ১টি হিসেবে {Math.ceil(showModal.data.wordCount / 1500)}টি সাজেস্ট করছি।
                      </p>
                    </div>
                  ) : (
                    <div className={`${isDark ? "bg-purple-900/20 border-purple-800" : "bg-purple-50 border-purple-100"} p-4 rounded-xl border space-y-2`}>
                      <p className={`text-xs font-bold ${isDark ? "text-purple-400" : "text-purple-700"}`}>
                        EPUB এর xhtml ফাইলে অধ্যায়ের নামের আগে <code className="bg-black/20 px-1 rounded">##</code> যোগ করুন:
                      </p>
                      <div className={`text-xs font-mono p-2 rounded-lg ${isDark ? "bg-black/30 text-purple-300" : "bg-white text-purple-800"}`}>
                        <div>&lt;p&gt;##এইটা একটা অধ্যায়&lt;/p&gt;</div>
                        <div>&lt;p&gt;##এইটা আরো একটা অধ্যায়&lt;/p&gt;</div>
                      </div>
                      <p className={`text-[10px] ${isDark ? "text-purple-400" : "text-purple-600"}`}>
                        ## চিহ্নটা output এ দেখাবে না — শুধু heading হিসেবে কাজ করবে।
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(null)}
                className={`flex-1 py-2.5 rounded-xl font-bold ${t.textMuted} ${t.surfaceHover} transition-all text-sm`}
              >
                Cancel
              </button>
              <button
                onClick={handleModalAction}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all text-sm"
              >
                {showModal.type === "missing-points" ? "Continue Anyway" : splitMode === "heading" ? "## দিয়ে Split করুন" : "Start Splitting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadStep;
