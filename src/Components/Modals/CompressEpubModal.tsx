import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  X, FileArchive, Loader2, Download, CheckCircle2,
  Image as ImageIcon, ArrowRight, AlertCircle,
} from "lucide-react";
import JSZip from "jszip";
import * as jpeg from "@jsquash/jpeg";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
  isDark: boolean;
}

interface ProcessResult {
  converted: number;
  skipped: number;
  originalSize: number;
  compressedSize: number;
}

const JPEG_QUALITY = 82;

async function pngToJpeg(pngData: ArrayBuffer): Promise<Uint8Array> {
  // PNG → ImageData via canvas
  const blob = new Blob([pngData], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      // White background for transparent PNGs
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        const jpegBuffer = await jpeg.encode(imageData, { quality: JPEG_QUALITY });
        resolve(new Uint8Array(jpegBuffer));
      } catch {
        // fallback
        canvas.toBlob((b) => {
          if (!b) return reject("Blob failed");
          b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
        }, "image/jpeg", JPEG_QUALITY / 100);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject("Image load failed"); };
    img.src = url;
  });
}

async function compressEpub(file: File): Promise<{ blob: Blob; result: ProcessResult }> {
  const zip = new JSZip();
  const content = await zip.loadAsync(await file.arrayBuffer());
  const newZip = new JSZip();

  const originalSize = file.size;
  let converted = 0;
  let skipped = 0;

  // 100KB threshold — এর বড় image গুলো compress হবে
  const SIZE_THRESHOLD = 100 * 1024;

  // Build a rename map: old path → new path (only for PNGs that need renaming)
  const renameMap: Record<string, string> = {};
  // Set of all image paths to compress (PNG + large JPG/WEBP)
  const toCompress = new Set<string>();

  // First pass: identify images to process
  for (const filePath of Object.keys(content.files)) {
    const f = content.files[filePath];
    if (f.dir) continue;
    const lp = filePath.toLowerCase();
    const isCover = lp.includes("cover");

    if (lp.endsWith(".png") && !isCover) {
      // All PNGs → convert to JPG (rename)
      const newPath = filePath.replace(/\.png$/i, ".jpg");
      renameMap[filePath] = newPath;
      toCompress.add(filePath);
    } else if ((lp.endsWith(".jpg") || lp.endsWith(".jpeg") || lp.endsWith(".webp")) && !isCover) {
      // Large JPG/WEBP → recompress in place (actual size checked during processing)
      toCompress.add(filePath);
    }
  }

  // Second pass: process all files
  for (const [filePath, zipFile] of Object.entries(content.files)) {
    if (zipFile.dir) continue;

    const lp = filePath.toLowerCase();

    // Image to process
    if (toCompress.has(filePath)) {
      try {
        const imgData = await zipFile.async("arraybuffer");

        // Size check for JPG/WEBP — skip small ones
        const isPng = lp.endsWith(".png");
        if (!isPng && imgData.byteLength < SIZE_THRESHOLD) {
          // Small JPG — keep as-is, no rename
          toCompress.delete(filePath); // don't update text refs
          newZip.file(filePath, new Uint8Array(imgData));
          skipped++;
          continue;
        }

        const jpegData = await pngToJpeg(imgData); // works for any image format

        const outPath = renameMap[filePath] ?? filePath.replace(/\.(webp)$/i, ".jpg");
        if (outPath !== filePath) renameMap[filePath] = outPath;

        newZip.file(outPath, jpegData);
        converted++;
        continue;
      } catch {
        const data = await zipFile.async("uint8array");
        newZip.file(filePath, data);
        skipped++;
        if (renameMap[filePath]) delete renameMap[filePath];
        continue;
      }
    }

    // Text files — update all renamed references
    if (
      lp.endsWith(".xhtml") || lp.endsWith(".html") ||
      lp.endsWith(".htm") || lp.endsWith(".opf") ||
      lp.endsWith(".ncx") || lp.endsWith(".css")
    ) {
      let text = await zipFile.async("string");
      for (const [oldPath, newPath] of Object.entries(renameMap)) {
        const oldName = oldPath.split("/").pop()!;
        const newName = newPath.split("/").pop()!;
        if (oldName !== newName) {
          text = text.split(oldName).join(newName);
        }
      }
      newZip.file(filePath, text);
      continue;
    }

    // All other files — copy as-is
    const data = await zipFile.async("uint8array");
    newZip.file(filePath, data);
  }

  const compressedBlob = await newZip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return {
    blob: compressedBlob,
    result: {
      converted,
      skipped,
      originalSize,
      compressedSize: compressedBlob.size,
    },
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const CompressEpubModal = ({ isOpen, onClose, theme: t, isDark }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setOutputBlob(null);
    setError("");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/epub+zip": [".epub"] },
    multiple: false,
  });

  const handleCompress = async () => {
    if (!file) return;
    setProcessing(true);
    setError("");
    try {
      const { blob, result } = await compressEpub(file);
      setOutputBlob(blob);
      setResult(result);
    } catch (err: any) {
      setError("Processing failed: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!outputBlob || !file) return;
    const url = URL.createObjectURL(outputBlob);
    const link = document.createElement("a");
    link.download = file.name.replace(/\.epub$/i, "_compressed.epub");
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setOutputBlob(null);
    setError("");
    onClose();
  };

  const saved = result ? result.originalSize - result.compressedSize : 0;
  const savedPercent = result ? Math.round((saved / result.originalSize) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={handleClose} />

      <div className={`${t.card} border ${t.cardBorder} w-full max-w-lg rounded-t-3xl sm:rounded-[28px] shadow-2xl z-10 overflow-hidden max-h-[92vh] overflow-y-auto`}>

        {/* Header */}
        <div className="relative p-6 sm:p-8 pb-4 sm:pb-5">
          {/* Mobile drag handle */}
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-4 sm:hidden" />
          <button onClick={handleClose} className={`absolute right-5 top-5 sm:right-6 sm:top-6 p-2 rounded-full ${t.stepInactive} ${t.surfaceHover} ${t.textMuted} transition-all`}>
            <X size={18} />
          </button>
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[20px] flex items-center justify-center mb-4 bg-orange-500/10 text-orange-500">
              <FileArchive size={28} />
            </div>
            <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${t.textPrimary}`}>Compress EPUB</h2>
            <p className={`text-xs font-bold mt-1 uppercase tracking-widest ${t.textMuted}`}>
              PNG → JPG · Smaller File Size
            </p>
          </div>
        </div>

        <div className="px-5 sm:px-8 pb-6 sm:pb-8 space-y-4">

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`w-full p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center ${
              file
                ? `${isDark ? "border-orange-500/50 bg-orange-900/10" : "border-orange-400/50 bg-orange-50"}`
                : isDragActive ? t.dropzoneActive : t.dropzone
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-orange-900/30" : "bg-orange-100"} text-orange-500 shrink-0`}>
                  <FileArchive size={20} />
                </div>
                <div className="text-left min-w-0">
                  <p className={`text-sm font-black truncate ${t.textPrimary}`}>{file.name}</p>
                  <p className={`text-xs ${t.textMuted}`}>{formatSize(file.size)}</p>
                </div>
                <p className={`ml-auto text-xs font-bold ${t.textMuted} shrink-0`}>Change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileArchive size={28} className={`${isDark ? "text-gray-600" : "text-gray-400"}`} />
                <p className={`text-sm font-bold ${t.textPrimary}`}>
                  {isDragActive ? "Drop EPUB here!" : "Click or Drag EPUB file"}
                </p>
                <p className={`text-xs ${t.textMuted}`}>.epub files only</p>
              </div>
            )}
          </div>

          {/* Info box */}
          {!result && (
            <div className={`p-3 rounded-xl flex gap-2 ${isDark ? "bg-blue-900/20 border border-blue-800/30" : "bg-blue-50 border border-blue-100"}`}>
              <ImageIcon size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <p className={`text-[10px] font-bold ${isDark ? "text-blue-400" : "text-blue-600"} leading-relaxed`}>
                সব <strong>.png</strong> এবং <strong>100KB+ বড়</strong> JPG/WEBP images কে MozJPEG দিয়ে compress করবে (cover ছাড়া)।
                PNG হলে filename ও <strong>.jpg</strong> তে rename হবে এবং সব reference update হবে।
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-400">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`p-4 rounded-2xl border ${isDark ? "border-green-800/30 bg-green-900/10" : "border-green-200 bg-green-50"}`}>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={18} className="text-green-500" />
                <p className={`font-black text-sm ${isDark ? "text-green-400" : "text-green-700"}`}>Processing Complete!</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl ${isDark ? "bg-black/20" : "bg-white"} text-center`}>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted}`}>Converted</p>
                  <p className={`text-2xl font-black ${isDark ? "text-green-400" : "text-green-600"}`}>{result.converted}</p>
                  <p className={`text-[10px] ${t.textMuted}`}>PNG→JPG + large images</p>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? "bg-black/20" : "bg-white"} text-center`}>
                  <p className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted}`}>Size Saved</p>
                  <p className={`text-2xl font-black ${isDark ? "text-orange-400" : "text-orange-600"}`}>{savedPercent}%</p>
                  <p className={`text-[10px] ${t.textMuted}`}>{formatSize(saved)} saved</p>
                </div>
              </div>
              <div className={`mt-3 flex items-center justify-center gap-2 text-xs font-bold ${t.textMuted}`}>
                <span>{formatSize(result.originalSize)}</span>
                <ArrowRight size={12} />
                <span className={isDark ? "text-green-400" : "text-green-600"}>{formatSize(result.compressedSize)}</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!result ? (
              <button
                onClick={handleCompress}
                disabled={!file || processing}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {processing ? (
                  <><Loader2 size={18} className="animate-spin" /> Processing...</>
                ) : (
                  <><FileArchive size={18} /> Compress EPUB</>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setResult(null); setOutputBlob(null); }}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-sm border-2 ${t.cardBorder} ${t.surfaceHover} ${t.textSecondary} transition-all`}
                >
                  New File
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 transition-all active:scale-[0.98]"
                >
                  <Download size={18} /> Download
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
