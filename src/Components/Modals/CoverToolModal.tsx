import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  X, Image as ImageIcon, Check, MousePointer2,
  Maximize2, Move, Download, Loader2,
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

function drawLogoWithBackground(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  bounds: { minX: number; minY: number; trimmedWidth: number; trimmedHeight: number },
  x: number, y: number, logoWidth: number, logoHeight: number,
  addBackground: boolean, logoColor: string,
) {
  if (addBackground) {
    const padding = 5;
    const radius = 6;
    const bgX = x - padding, bgY = y - padding;
    const bgW = logoWidth + padding * 2, bgH = logoHeight + padding * 2;
    const bgColor = logoColor === "white" ? "#4b9dd3" : "#ffffff";
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.moveTo(bgX + radius, bgY);
    ctx.lineTo(bgX + bgW - radius, bgY);
    ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + radius);
    ctx.lineTo(bgX + bgW, bgY + bgH - radius);
    ctx.quadraticCurveTo(bgX + bgW, bgY + bgH, bgX + bgW - radius, bgY + bgH);
    ctx.lineTo(bgX + radius, bgY + bgH);
    ctx.quadraticCurveTo(bgX, bgY + bgH, bgX, bgY + bgH - radius);
    ctx.lineTo(bgX, bgY + radius);
    ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 12;
  ctx.drawImage(logo, bounds.minX, bounds.minY, bounds.trimmedWidth, bounds.trimmedHeight, x, y, logoWidth, logoHeight);
  ctx.shadowBlur = 0;
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
  config: { logoColor: string; logoSize: number; margin: number; logoPosition: string; addBackground: boolean },
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
    const bounds = getTrimmedBounds(logo);
    const logoWidth = (395 * (config.logoSize || 18)) / 100;
    const logoHeight = (bounds.trimmedHeight / bounds.trimmedWidth) * logoWidth;
    const margin = config.margin || 18;
    const x = 395 - logoWidth - margin;
    const y = config.logoPosition === "top-right" ? margin : 632 - logoHeight - margin;
    drawLogoWithBackground(ctx, logo, bounds, x, y, logoWidth, logoHeight, config.addBackground, config.logoColor);
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
    addBackground: false,
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
      link.href = url; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) { console.error("Generation failed:", err); }
    finally { setIsGenerating(false); }
  };

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setConfig({ logoColor: "white", logoPosition: "bottom-right", logoSize: 18, margin: 18, addBackground: false });
    onClose();
  };

  const bgPreviewColor = config.logoColor === "white" ? "#4b9dd3" : "#ffffff";

  const controlBtn = (active: boolean) =>
    `flex-1 py-2.5 rounded-xl border-2 flex items-center justify-center gap-1.5 transition-all font-bold text-xs ${
      active ? "border-blue-600 bg-blue-600 text-white"
        : isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400" : "border-gray-100 bg-gray-50 text-gray-500"
    }`;

  const posBtn = (active: boolean) =>
    `flex-1 py-2.5 rounded-xl border-2 flex items-center justify-center gap-1.5 transition-all font-bold text-xs ${
      active ? `border-blue-600 ${isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700"}`
        : isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400" : "border-gray-100 bg-gray-50 text-gray-500"
    }`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex flex-col">
      {/* Header */}
      <div className={`${t.header} border-b ${t.cardBorder} px-6 py-4 flex items-center justify-between shrink-0`}>
        <div>
          <h2 className={`text-base font-black ${t.textPrimary}`}>Cover Generator</h2>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${t.textMuted}`}>
            Cover · Thumbnail · MozJPEG Quality
          </p>
        </div>
        <button onClick={handleClose} className={`p-2 rounded-xl ${t.surfaceHover} ${t.textMuted} transition-all`}>
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className={`flex flex-1 overflow-hidden ${t.bg}`}>

        {/* Preview */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto">
          <div
            {...getRootProps()}
            className={`relative cursor-pointer rounded-2xl overflow-hidden border-2 border-dashed transition-all shadow-2xl ${
              previewUrl ? "border-blue-500 ring-4 ring-blue-500/10"
                : isDragActive ? t.dropzoneActive : t.dropzone
            }`}
            style={{ width: "395px", height: "632px", flexShrink: 0 }}
          >
            <input {...getInputProps()} />
            {previewUrl ? (
              <div className="relative w-full h-full group">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                {/* Logo + background preview */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    ...(config.logoPosition === "top-right" ? { top: `${config.margin}px` } : { bottom: `${config.margin}px` }),
                    right: `${config.margin}px`,
                    width: `${(395 * config.logoSize) / 100}px`,
                  }}
                >
                  {config.addBackground ? (
                    <div className="p-[5px] rounded-md inline-block" style={{ backgroundColor: bgPreviewColor }}>
                      <img
                        src={config.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png"}
                        alt="Logo" className="w-full h-auto block"
                      />
                    </div>
                  ) : (
                    <img
                      src={config.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png"}
                      alt="Logo" className="w-full h-auto drop-shadow-xl"
                    />
                  )}
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-sm font-bold bg-black/50 px-4 py-2 rounded-xl">Change Image</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className={`w-16 h-16 rounded-2xl ${isDark ? "bg-[#252836]" : "bg-blue-50"} flex items-center justify-center`}>
                  <ImageIcon size={28} className="text-blue-400" />
                </div>
                <div className="text-center">
                  <p className={`text-sm font-bold ${t.textPrimary}`}>{isDragActive ? "Drop করুন!" : "Click or Drag Image"}</p>
                  <p className={`text-xs ${t.textMuted} mt-1`}>JPG · PNG · WEBP</p>
                </div>
              </div>
            )}
          </div>
          <p className={`mt-3 text-[10px] font-bold ${t.textMuted} uppercase tracking-widest`}>
            395 × 632 px — Real Preview
          </p>
        </div>

        {/* Controls */}
        <div className={`w-72 shrink-0 flex flex-col border-l ${t.cardBorder} ${t.card} overflow-y-auto`}>
          <div className="p-5 space-y-5 flex-1">

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

            {/* Add Background */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => updateConfig({ addBackground: !config.addBackground })}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    config.addBackground ? "bg-blue-600 border-blue-600"
                      : isDark ? "border-[#2A2D3E] bg-[#252836]" : "border-gray-200 bg-white"
                  }`}
                >
                  {config.addBackground && <Check size={12} className="text-white" />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${t.textPrimary}`}>Add Background</p>
                  <p className={`text-[10px] ${t.textMuted}`}>
                    {config.logoColor === "white" ? "White logo → Blue bg" : "Blue logo → White bg"}
                  </p>
                </div>
                {config.addBackground && (
                  <div className="ml-auto w-5 h-5 rounded-sm border border-gray-300" style={{ backgroundColor: bgPreviewColor }} />
                )}
              </label>
            </div>

            <div className={`border-t ${t.cardBorder}`} />

            {/* Logo Size */}
            <div>
              <div className="flex justify-between mb-2.5">
                <label className={`flex items-center gap-1.5 text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}>
                  <Maximize2 size={10} /> Logo Size
                </label>
                <span className={`text-blue-500 font-bold text-xs px-2 py-0.5 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}>
                  {config.logoSize}%
                </span>
              </div>
              <input type="range" min="10" max="40" value={config.logoSize}
                onChange={(e) => updateConfig({ logoSize: parseInt(e.target.value) })}
                className={`w-full h-1.5 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
              />
            </div>

            {/* Margin */}
            <div>
              <div className="flex justify-between mb-2.5">
                <label className={`flex items-center gap-1.5 text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}>
                  <Move size={10} /> Margin
                </label>
                <span className={`text-blue-500 font-bold text-xs px-2 py-0.5 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}>
                  {config.margin}px
                </span>
              </div>
              <input type="range" min="0" max="100" value={config.margin}
                onChange={(e) => updateConfig({ margin: parseInt(e.target.value) })}
                className={`w-full h-1.5 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
              />
            </div>

            <div className={`border-t ${t.cardBorder}`} />

            {/* Info */}
            <div className={`p-3 rounded-xl ${isDark ? "bg-blue-900/20 border border-blue-800/30" : "bg-blue-50 border border-blue-100"}`}>
              <p className={`text-[10px] font-bold ${isDark ? "text-blue-400" : "text-blue-600"} leading-relaxed`}>
                <strong>Cover</strong> — লোগো ছাড়া, EPUB এর জন্য<br />
                <strong>Thumbnail</strong> — লোগো সহ, প্রচারের জন্য
              </p>
            </div>
          </div>

          {/* Download buttons */}
          <div className={`p-5 border-t ${t.cardBorder} space-y-2.5 shrink-0`}>
            <button
              onClick={() => handleDownload("cover")}
              disabled={!previewUrl || isGenerating}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm border-2 transition-all active:scale-95 disabled:opacity-40 ${
                isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-300 hover:border-blue-500 hover:text-blue-400"
                  : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-500 hover:text-blue-600"
              }`}
            >
              {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Download Cover
            </button>
            <button
              onClick={() => handleDownload("thumbnail")}
              disabled={!previewUrl || isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-40"
            >
              {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Download Thumbnail
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
