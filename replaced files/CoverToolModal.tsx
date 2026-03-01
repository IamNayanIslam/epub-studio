import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  X, Image as ImageIcon, Check, MousePointer2,
  Maximize2, Move, Download, RefreshCw, Loader2,
} from "lucide-react";
import * as jpeg from "@jsquash/jpeg";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
  isDark: boolean;
}

const JPEG_QUALITY = 80;

async function canvasToMozJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const jpegBuffer = await jpeg.encode(imageData, { quality: JPEG_QUALITY });
  return new Blob([jpegBuffer], { type: "image/jpeg" });
}

function getTrimmedBounds(logo: HTMLImageElement) {
  try {
    const tmp = document.createElement("canvas");
    tmp.width = logo.naturalWidth; tmp.height = logo.naturalHeight;
    const ctx = tmp.getContext("2d");
    if (!ctx) return { minX: 0, minY: 0, trimmedWidth: logo.naturalWidth, trimmedHeight: logo.naturalHeight };
    ctx.drawImage(logo, 0, 0);
    let pixels: ImageData;
    try { pixels = ctx.getImageData(0, 0, logo.naturalWidth, logo.naturalHeight); }
    catch { return { minX: 0, minY: 0, trimmedWidth: logo.naturalWidth, trimmedHeight: logo.naturalHeight }; }
    let minX = logo.naturalWidth, minY = logo.naturalHeight, maxX = 0, maxY = 0;
    for (let y = 0; y < logo.naturalHeight; y++) {
      for (let x = 0; x < logo.naturalWidth; x++) {
        const alpha = pixels.data[(y * logo.naturalWidth + x) * 4 + 3];
        if (alpha > 10) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
      }
    }
    if (maxX === 0 && maxY === 0) return { minX: 0, minY: 0, trimmedWidth: logo.naturalWidth, trimmedHeight: logo.naturalHeight };
    return { minX, minY, trimmedWidth: maxX - minX, trimmedHeight: maxY - minY };
  } catch { return { minX: 0, minY: 0, trimmedWidth: logo.naturalWidth, trimmedHeight: logo.naturalHeight }; }
}

function loadImageWithCORS(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => resolve(img2);
      img2.onerror = reject;
      img2.src = src + "?v=" + Date.now();
    };
    img.src = src;
  });
}

async function buildCoverBlob(coverUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 395; canvas.height = 632;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const img = await loadImageWithCORS(coverUrl);
  ctx.drawImage(img, 0, 0, 395, 632);
  try { return await canvasToMozJpegBlob(canvas); }
  catch { return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej("failed"), "image/jpeg", 0.85)); }
}

async function buildThumbnailBlob(
  coverUrl: string,
  config: { logoColor: string; logoSize: number; margin: number; logoPosition: string },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 395; canvas.height = 632;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const img = await loadImageWithCORS(coverUrl);
  ctx.drawImage(img, 0, 0, 395, 632);
  try {
    const logoSrc = config.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png";
    const logo = await loadImageWithCORS(logoSrc);
    const { minX, minY, trimmedWidth, trimmedHeight } = getTrimmedBounds(logo);
    const logoWidth = (395 * (config.logoSize || 18)) / 100;
    const logoHeight = (trimmedHeight / trimmedWidth) * logoWidth;
    const margin = config.margin || 18;
    const x = 395 - logoWidth - margin;
    const y = config.logoPosition === "top-right" ? margin : 632 - logoHeight - margin;
    ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 12;
    ctx.drawImage(logo, minX, minY, trimmedWidth, trimmedHeight, x, y, logoWidth, logoHeight);
  } catch { console.warn("Logo load failed"); }
  try { return await canvasToMozJpegBlob(canvas); }
  catch { return new Promise((res, rej) => canvas.toBlob((b) => b ? res(b) : rej("failed"), "image/jpeg", 0.85)); }
}

export const CoverToolModal = ({ isOpen, onClose, theme: t, isDark }: Props) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [config, setConfig] = useState({
    logoColor: "white",
    logoPosition: "bottom-right",
    logoSize: 18,
    margin: 18,
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const updateConfig = (val: any) => setConfig((prev) => ({ ...prev, ...val }));

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }, [previewUrl]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    multiple: false,
  });

  const handleDownload = async (type: "cover" | "thumbnail") => {
    if (!previewUrl) return;
    setIsGenerating(true);
    try {
      const blob = type === "cover"
        ? await buildCoverBlob(previewUrl)
        : await buildThumbnailBlob(previewUrl, config);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = type === "cover" ? "cover.jpg" : "thumbnail.jpg";
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) { console.error("Generation failed:", err); }
    finally { setIsGenerating(false); }
  };

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setConfig({ logoColor: "white", logoPosition: "bottom-right", logoSize: 18, margin: 18 });
    onClose();
  };

  const controlBtn = (active: boolean) =>
    `flex-1 py-2 rounded-xl border-2 flex items-center justify-center gap-1.5 transition-all font-bold text-xs ${
      active
        ? "border-blue-600 bg-blue-600 text-white"
        : `${isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400" : "border-gray-100 bg-gray-50 text-gray-400"}`
    }`;

  const posBtn = (active: boolean) =>
    `flex-1 py-2 rounded-xl border-2 flex items-center justify-center gap-1.5 transition-all font-bold text-xs ${
      active
        ? `border-blue-600 ${isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700"}`
        : `${isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400" : "border-gray-100 bg-gray-50 text-gray-400"}`
    }`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={handleClose} />

      <div className={`${t.card} border ${t.cardBorder} w-full max-w-3xl rounded-[32px] shadow-2xl z-10 overflow-hidden`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-8 py-5 border-b ${t.cardBorder}`}>
          <div>
            <h2 className={`text-lg font-black ${t.textPrimary}`}>Cover Generator</h2>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${t.textMuted}`}>
              Cover · Thumbnail · MozJPEG Quality
            </p>
          </div>
          <button onClick={handleClose} className={`p-2 rounded-xl ${t.surfaceHover} ${t.textMuted} transition-all`}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* ── বাম: Preview ── */}
          <div className="flex flex-col gap-4">
            <div
              {...getRootProps()}
              className={`relative w-full aspect-[395/632] max-h-[360px] mx-auto rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center cursor-pointer transition-all ${
                previewUrl ? "border-blue-500 ring-2 ring-blue-500/20" : isDragActive ? t.dropzoneActive : t.dropzone
              }`}
            >
              <input {...getInputProps()} />
              {previewUrl ? (
                <div className="relative w-full h-full group">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  {/* Logo overlay preview */}
                  <div className="absolute pointer-events-none transition-all" style={{
                    ...(config.logoPosition === "top-right" ? { top: `${config.margin}px` } : { bottom: `${config.margin}px` }),
                    right: `${config.margin}px`,
                    width: `${config.logoSize}%`,
                  }}>
                    <img
                      src={config.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png"}
                      alt="Logo"
                      className="w-full h-auto drop-shadow-xl"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-xs font-bold">Change Image</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 px-4 text-center">
                  <div className={`w-14 h-14 rounded-2xl ${isDark ? "bg-[#252836]" : "bg-blue-50"} flex items-center justify-center`}>
                    <ImageIcon size={26} className="text-blue-400" />
                  </div>
                  <p className={`text-sm font-bold ${t.textMuted}`}>
                    {isDragActive ? "Drop করুন!" : "Click or Drag Image"}
                  </p>
                </div>
              )}
            </div>

            {/* Download Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDownload("cover")}
                disabled={!previewUrl || isGenerating}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-2 transition-all active:scale-95 disabled:opacity-40 ${
                  isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-300 hover:border-blue-500 hover:text-blue-400" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-500 hover:text-blue-600"
                }`}
              >
                {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Cover
              </button>
              <button
                onClick={() => handleDownload("thumbnail")}
                disabled={!previewUrl || isGenerating}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-40"
              >
                {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Thumbnail
              </button>
            </div>
          </div>

          {/* ── ডান: Controls ── */}
          <div className={`space-y-5 ${t.card} border ${t.cardBorder} p-5 rounded-2xl`}>

            {/* Logo Style */}
            <div>
              <label className={`block text-[10px] font-black ${t.textMuted} mb-2.5 uppercase tracking-[0.2em]`}>Logo Style</label>
              <div className="flex gap-2">
                {(["blue", "white"] as const).map((color) => (
                  <button key={color} onClick={() => updateConfig({ logoColor: color })} className={controlBtn(config.logoColor === color)}>
                    {config.logoColor === color && <Check size={11} />}
                    {color === "blue" ? "Blue" : "White"}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo Position */}
            <div>
              <label className={`block text-[10px] font-black ${t.textMuted} mb-2.5 uppercase tracking-[0.2em]`}>Logo Position</label>
              <div className="flex gap-2">
                {[
                  { id: "top-right", label: "Top Right", icon: <MousePointer2 size={11} className="rotate-[-90deg]" /> },
                  { id: "bottom-right", label: "Bottom Right", icon: <MousePointer2 size={11} /> },
                ].map((pos) => (
                  <button key={pos.id} onClick={() => updateConfig({ logoPosition: pos.id })} className={posBtn(config.logoPosition === pos.id)}>
                    {config.logoPosition === pos.id ? <Check size={11} /> : pos.icon}
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            <hr className={t.divider} />

            {/* Logo Size */}
            <div>
              <div className="flex justify-between mb-2">
                <label className={`flex items-center gap-1.5 text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}>
                  <Maximize2 size={10} /> Logo Size
                </label>
                <span className={`text-blue-500 font-bold text-xs px-2 py-0.5 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}>
                  {config.logoSize}%
                </span>
              </div>
              <input
                type="range" min="10" max="40" value={config.logoSize}
                onChange={(e) => updateConfig({ logoSize: parseInt(e.target.value) })}
                className={`w-full h-1.5 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
              />
            </div>

            {/* Margin */}
            <div>
              <div className="flex justify-between mb-2">
                <label className={`flex items-center gap-1.5 text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}>
                  <Move size={10} /> Margin
                </label>
                <span className={`text-blue-500 font-bold text-xs px-2 py-0.5 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}>
                  {config.margin}px
                </span>
              </div>
              <input
                type="range" min="0" max="100" value={config.margin}
                onChange={(e) => updateConfig({ margin: parseInt(e.target.value) })}
                className={`w-full h-1.5 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
              />
            </div>

            {/* Info */}
            <div className={`mt-2 p-3 rounded-xl ${isDark ? "bg-blue-900/20 border border-blue-800/30" : "bg-blue-50 border border-blue-100"}`}>
              <p className={`text-[10px] font-bold ${isDark ? "text-blue-400" : "text-blue-600"} leading-relaxed`}>
                <strong>Cover</strong> — লোগো ছাড়া, EPUB এর জন্য<br />
                <strong>Thumbnail</strong> — লোগো সহ, প্রচারের জন্য
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
