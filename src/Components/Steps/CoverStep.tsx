import { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Image as ImageIcon,
  Check,
  Maximize2,
  Move,
  Download,
  RefreshCw,
} from "lucide-react";
import { useEpub } from "../../Store/EpubContext";
import { useTheme, tokens } from "../../Store/ThemeContext";
import { injectCoverIntoBlob } from "../../Utils/EpubDownloader";
import * as jpeg from "@jsquash/jpeg";

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
  } catch {
    return { minX: 0, minY: 0, trimmedWidth: logo.naturalWidth, trimmedHeight: logo.naturalHeight };
  }
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

async function buildPlainCoverBlob(coverUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 395; canvas.height = 632;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const coverImg = await loadImageWithCORS(coverUrl);
  ctx.drawImage(coverImg, 0, 0, 395, 632);
  try { return await canvasToMozJpegBlob(canvas); }
  catch {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject("Blob failed")), "image/jpeg", 0.85);
    });
  }
}

// ── Draw logo with optional background ───────────────────────────────────
function drawLogoWithBackground(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  bounds: { minX: number; minY: number; trimmedWidth: number; trimmedHeight: number },
  x: number,
  y: number,
  logoWidth: number,
  logoHeight: number,
  addBackground: boolean,
  logoColor: string,
) {
  if (addBackground) {
    const padding = 5;
    const radius = 6;
    const bgX = x - padding;
    const bgY = y - padding;
    const bgW = logoWidth + padding * 2;
    const bgH = logoHeight + padding * 2;
    const bgColor = logoColor === "white" ? "#4b9dd3" : "#ffffff"; // blue logo → white bg, white logo → blue bg

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

  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 12;
  ctx.drawImage(logo, bounds.minX, bounds.minY, bounds.trimmedWidth, bounds.trimmedHeight, x, y, logoWidth, logoHeight);
  ctx.shadowBlur = 0;
}

async function buildThumbnailBlob(
  coverUrl: string,
  config: { logoColor: string; logoSize: number; margin: number; logoPosition: string; addBackground?: boolean },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 395; canvas.height = 632;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const coverImg = await loadImageWithCORS(coverUrl);
  ctx.drawImage(coverImg, 0, 0, 395, 632);
  try {
    const logoSrc = config.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png";
    const logo = await loadImageWithCORS(logoSrc);
    const bounds = getTrimmedBounds(logo);
    const logoWidth = (395 * (config.logoSize || 18)) / 100;
    const logoHeight = (bounds.trimmedHeight / bounds.trimmedWidth) * logoWidth;
    const margin = config.margin || 18;
    const x = 395 - logoWidth - margin;
    const y = config.logoPosition === "top-right" ? margin : 632 - logoHeight - margin;
    drawLogoWithBackground(ctx, logo, bounds, x, y, logoWidth, logoHeight, !!config.addBackground, config.logoColor);
  } catch { console.warn("Logo load failed, skipping"); }
  try { return await canvasToMozJpegBlob(canvas); }
  catch {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject("Blob failed")), "image/jpeg", 0.85);
    });
  }
}

const CoverStep = () => {
  const { state, dispatch } = useEpub();
  const { isDark } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;

  const [previewUrl, setPreviewUrl] = useState<string | null>(state.coverImage ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);

  const processedBlobRef = useRef<Blob | null>(state.processedBlob);
  const coverConfigRef = useRef(state.coverConfig);
  const metadataRef = useRef(state.metadata);

  useEffect(() => { processedBlobRef.current = state.processedBlob; }, [state.processedBlob]);
  useEffect(() => { coverConfigRef.current = state.coverConfig; }, [state.coverConfig]);
  useEffect(() => { metadataRef.current = state.metadata; }, [state.metadata]);
  useEffect(() => { if (!state.coverImage) setPreviewUrl(null); }, [state.coverImage]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    dispatch({ type: "SET_COVER_IMAGE", payload: url });
    const currentBlob = processedBlobRef.current;
    if (currentBlob) {
      setIsInjecting(true);
      try {
        const plainCoverBlob = await buildPlainCoverBlob(url);
        const updatedBlob = await injectCoverIntoBlob(
          currentBlob,
          plainCoverBlob,
          metadataRef.current?.title || "",
          metadataRef.current?.authorBengali || "",
        );
        dispatch({ type: "SET_PROCESSED_BLOB", payload: updatedBlob });
      } catch (err) { console.error("Cover injection failed:", err); }
      finally { setIsInjecting(false); }
    }
  }, [dispatch]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    multiple: false,
  });

  const coverConfig = state.coverConfig;

  const updateConfig = (newConfig: any) =>
    dispatch({ type: "UPDATE_COVER_CONFIG", payload: newConfig });

  const handleDownloadThumbnail = async () => {
    if (!previewUrl) return;
    setIsGenerating(true);
    try {
      const blob = await buildThumbnailBlob(previewUrl, coverConfig);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `thumbnail.jpg`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) { console.error("Thumbnail generation failed:", err); }
    finally { setIsGenerating(false); }
  };

  // Background preview color
  const bgPreviewColor = coverConfig.logoColor === "white" ? "#4b9dd3" : "#ffffff";

  // controls JSX — inline করা হয়েছে, inner component হিসেবে না
  // কারণ inner component হলে range drag কাজ করে না (re-render এ unmount হয়)
  const controlsJSX = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {(["blue", "white"] as const).map((color) => (
          <button
            key={color}
            onClick={() => updateConfig({ logoColor: color })}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs border-2 transition-all ${
              coverConfig.logoColor === color
                ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : isDark ? "border-[#222538] bg-[#1C1F30] text-slate-400" : "border-slate-100 bg-slate-50 text-slate-500"
            }`}
          >
            {coverConfig.logoColor === color && <Check size={12} />}
            {color === "blue" ? "Blue Logo" : "White Logo"}
          </button>
        ))}
        {[
          { id: "top-right", label: "Top Right" },
          { id: "bottom-right", label: "Bottom Right" },
        ].map((pos) => (
          <button
            key={pos.id}
            onClick={() => updateConfig({ logoPosition: pos.id })}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs border-2 transition-all ${
              coverConfig.logoPosition === pos.id
                ? isDark ? "border-blue-500 bg-blue-900/30 text-blue-400" : "border-blue-500 bg-blue-50 text-blue-700"
                : isDark ? "border-[#222538] bg-[#1C1F30] text-slate-400" : "border-slate-100 bg-slate-50 text-slate-500"
            }`}
          >
            {coverConfig.logoPosition === pos.id && <Check size={12} />}
            {pos.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => updateConfig({ addBackground: !coverConfig.addBackground })}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
          coverConfig.addBackground
            ? isDark ? "border-blue-500/50 bg-blue-900/20" : "border-blue-300 bg-blue-50"
            : isDark ? "border-[#222538] bg-[#1C1F30]" : "border-slate-100 bg-slate-50"
        }`}
      >
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
          coverConfig.addBackground ? "bg-blue-600 border-blue-600" : isDark ? "border-[#2A2D3E]" : "border-slate-200"
        }`}>
          {coverConfig.addBackground && <Check size={11} className="text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${t.textPrimary}`}>Add Background</p>
          <p className={`text-[10px] ${t.textMuted} truncate`}>
            {coverConfig.logoColor === "white" ? "White logo → Blue bg" : "Blue logo → White bg"}
          </p>
        </div>
        {coverConfig.addBackground && (
          <div className="w-4 h-4 rounded shrink-0 border border-slate-200" style={{ backgroundColor: bgPreviewColor }} />
        )}
      </button>

      <div>
        <div className="flex justify-between items-center mb-2">
          <p className={`flex items-center gap-1.5 text-[10px] font-black ${t.textMuted} uppercase tracking-widest`}>
            <Maximize2 size={10} /> Logo Size
          </p>
          <span className={`text-blue-500 font-bold text-xs px-2 py-0.5 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}>
            {coverConfig.logoSize}%
          </span>
        </div>
        <input
          type="range" min="10" max="40" value={coverConfig.logoSize}
          onChange={(e) => updateConfig({ logoSize: parseInt(e.target.value) })}
          className={`w-full h-2 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
        />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <p className={`flex items-center gap-1.5 text-[10px] font-black ${t.textMuted} uppercase tracking-widest`}>
            <Move size={10} /> Margin
          </p>
          <span className={`text-blue-500 font-bold text-xs px-2 py-0.5 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}>
            {coverConfig.margin}px
          </span>
        </div>
        <input
          type="range" min="0" max="100" value={coverConfig.margin}
          onChange={(e) => updateConfig({ margin: parseInt(e.target.value) })}
          className={`w-full h-2 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
        />
      </div>

      <button
        onClick={handleDownloadThumbnail}
        disabled={!previewUrl || isGenerating}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-40"
      >
        {isGenerating ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
        Download Thumbnail
      </button>
    </div>
  );

  return (
    <div className="p-1">
      {/* ── Mobile: vertical stack ── */}
      <div className="flex flex-col gap-4 md:hidden">

        {/* Cover preview — compact on mobile */}
        <div
          {...getRootProps()}
          className={`relative w-full max-w-[200px] mx-auto aspect-[395/632] rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200 cursor-pointer ${
            previewUrl ? "border-blue-500 ring-2 ring-blue-500/20" : isDragActive ? t.dropzoneActive : t.dropzone
          }`}
        >
          <input {...getInputProps()} />
          {previewUrl ? (
            <div className="relative w-full h-full group">
              <img src={previewUrl} alt="Cover" className="w-full h-full object-cover" />
              <div className="absolute transition-all duration-200 pointer-events-none" style={{
                ...(coverConfig.logoPosition === "top-right" ? { top: `${coverConfig.margin}px` } : { bottom: `${coverConfig.margin}px` }),
                right: `${coverConfig.margin}px`, width: `${coverConfig.logoSize || 18}%`,
              }}>
                {coverConfig.addBackground ? (
                  <div className="p-[5px] rounded-md inline-block" style={{ backgroundColor: bgPreviewColor }}>
                    <img src={coverConfig.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png"} alt="Logo" className="w-full h-auto block" />
                  </div>
                ) : (
                  <img src={coverConfig.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png"} alt="Logo" className="w-full h-auto drop-shadow-xl" />
                )}
              </div>
              {isInjecting && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <RefreshCw size={16} className="animate-spin text-white" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-white text-xs font-bold">Change</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <ImageIcon size={24} className="text-blue-400" />
              <p className={`text-xs font-bold ${t.textPrimary}`}>{isDragActive ? "Drop করুন!" : "Cover Drop করুন"}</p>
              <p className={`text-[10px] ${t.textMuted}`}>JPG · PNG · WEBP</p>
            </div>
          )}
        </div>

        {/* Mobile controls */}
        {controlsJSX}
      </div>

      {/* ── Desktop: side by side ── */}
      <div className="hidden md:grid md:grid-cols-2 gap-8 items-start">

        {/* Left: Preview */}
        <div className="flex flex-col items-center gap-3">
          <p className={`text-[10px] font-black ${t.textMuted} uppercase tracking-widest self-start`}>Live Preview</p>
          <div
            {...getRootProps()}
            className={`relative w-full max-w-[280px] aspect-[395/632] rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200 cursor-pointer ${
              previewUrl ? "border-blue-500 ring-2 ring-blue-500/20" : isDragActive ? t.dropzoneActive : t.dropzone
            }`}
          >
            <input {...getInputProps()} />
            {previewUrl ? (
              <div className="relative w-full h-full group">
                <img src={previewUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                <div className="absolute transition-all duration-200 pointer-events-none" style={{
                  ...(coverConfig.logoPosition === "top-right" ? { top: `${coverConfig.margin}px` } : { bottom: `${coverConfig.margin}px` }),
                  right: `${coverConfig.margin}px`, width: `${coverConfig.logoSize || 18}%`,
                }}>
                  {coverConfig.addBackground ? (
                    <div className="p-[5px] rounded-md inline-block" style={{ backgroundColor: bgPreviewColor }}>
                      <img src={coverConfig.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png"} alt="Logo" className="w-full h-auto block" />
                    </div>
                  ) : (
                    <img src={coverConfig.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png"} alt="Logo" className="w-full h-auto drop-shadow-xl" />
                  )}
                </div>
                {isInjecting && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1 text-white">
                      <RefreshCw size={18} className="animate-spin" />
                      <span className="text-[10px] font-bold">Processing...</span>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-xs font-bold">Change Image</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-4 text-center">
                <div className={`w-14 h-14 rounded-2xl ${isDark ? "bg-[#1C1F30]" : "bg-blue-50"} flex items-center justify-center`}>
                  <ImageIcon size={26} className="text-blue-400" />
                </div>
                <div>
                  <p className={`text-sm font-bold ${t.textPrimary}`}>{isDragActive ? "Drop করুন!" : "Cover Image Drop করুন"}</p>
                  <p className={`text-xs ${t.textMuted} mt-1`}>JPG · PNG · WEBP</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex flex-col gap-5 h-full">
          {controlsJSX}
        </div>
      </div>
    </div>
  );
};

export default CoverStep;