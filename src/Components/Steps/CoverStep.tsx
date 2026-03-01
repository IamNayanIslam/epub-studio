import { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Image as ImageIcon,
  Check,
  MousePointer2,
  Maximize2,
  Move,
  Download,
  RefreshCw,
} from "lucide-react";

import * as jpeg from "@jsquash/jpeg";
import { useEpub } from "../../Store/EpubContext";
import { tokens, useTheme } from "../../Store/ThemeContext";
import { injectCoverIntoBlob } from "../../Utils/EpubDownloader";

const JPEG_QUALITY = 80;

async function canvasToMozJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const jpegBuffer = await jpeg.encode(imageData, { quality: JPEG_QUALITY });
  return new Blob([jpegBuffer], { type: "image/jpeg" });
}

function getTrimmedBounds(logo: HTMLImageElement) {
  try {
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = logo.naturalWidth;
    tmpCanvas.height = logo.naturalHeight;
    const tmpCtx = tmpCanvas.getContext("2d");
    if (!tmpCtx)
      return {
        minX: 0,
        minY: 0,
        trimmedWidth: logo.naturalWidth,
        trimmedHeight: logo.naturalHeight,
      };
    tmpCtx.drawImage(logo, 0, 0);
    let pixels: ImageData;
    try {
      pixels = tmpCtx.getImageData(0, 0, logo.naturalWidth, logo.naturalHeight);
    } catch {
      return {
        minX: 0,
        minY: 0,
        trimmedWidth: logo.naturalWidth,
        trimmedHeight: logo.naturalHeight,
      };
    }
    let minX = logo.naturalWidth,
      minY = logo.naturalHeight,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < logo.naturalHeight; y++) {
      for (let x = 0; x < logo.naturalWidth; x++) {
        const alpha = pixels.data[(y * logo.naturalWidth + x) * 4 + 3];
        if (alpha > 10) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX === 0 && maxY === 0)
      return {
        minX: 0,
        minY: 0,
        trimmedWidth: logo.naturalWidth,
        trimmedHeight: logo.naturalHeight,
      };
    return {
      minX,
      minY,
      trimmedWidth: maxX - minX,
      trimmedHeight: maxY - minY,
    };
  } catch {
    return {
      minX: 0,
      minY: 0,
      trimmedWidth: logo.naturalWidth,
      trimmedHeight: logo.naturalHeight,
    };
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
  canvas.width = 395;
  canvas.height = 632;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const coverImg = await loadImageWithCORS(coverUrl);
  ctx.drawImage(coverImg, 0, 0, 395, 632);
  try {
    return await canvasToMozJpegBlob(canvas);
  } catch {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject("Blob failed")),
        "image/jpeg",
        0.85,
      );
    });
  }
}

async function buildThumbnailBlob(
  coverUrl: string,
  config: {
    logoColor: string;
    logoSize: number;
    margin: number;
    logoPosition: string;
  },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 395;
  canvas.height = 632;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const coverImg = await loadImageWithCORS(coverUrl);
  ctx.drawImage(coverImg, 0, 0, 395, 632);
  try {
    const logoSrc =
      config.logoColor === "white" ? "/boitoi_white.png" : "/boitoi_blue.png";
    const logo = await loadImageWithCORS(logoSrc);
    const { minX, minY, trimmedWidth, trimmedHeight } = getTrimmedBounds(logo);
    const logoWidth = (395 * (config.logoSize || 18)) / 100;
    const logoHeight = (trimmedHeight / trimmedWidth) * logoWidth;
    const margin = config.margin || 18;
    const x = 395 - logoWidth - margin;
    const y =
      config.logoPosition === "top-right" ? margin : 632 - logoHeight - margin;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 12;
    ctx.drawImage(
      logo,
      minX,
      minY,
      trimmedWidth,
      trimmedHeight,
      x,
      y,
      logoWidth,
      logoHeight,
    );
  } catch {
    console.warn("Logo load failed, skipping");
  }
  try {
    return await canvasToMozJpegBlob(canvas);
  } catch {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject("Blob failed")),
        "image/jpeg",
        0.85,
      );
    });
  }
}

const CoverStep = () => {
  const { state, dispatch } = useEpub();
  const { isDark } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    state.coverImage ?? null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);

  const processedBlobRef = useRef<Blob | null>(state.processedBlob);
  const coverConfigRef = useRef(state.coverConfig);
  const metadataRef = useRef(state.metadata);

  useEffect(() => {
    processedBlobRef.current = state.processedBlob;
  }, [state.processedBlob]);
  useEffect(() => {
    coverConfigRef.current = state.coverConfig;
  }, [state.coverConfig]);
  useEffect(() => {
    metadataRef.current = state.metadata;
  }, [state.metadata]);
  useEffect(() => {
    if (!state.coverImage) setPreviewUrl(null);
  }, [state.coverImage]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
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
        } catch (err) {
          console.error("Cover injection failed:", err);
        } finally {
          setIsInjecting(false);
        }
      }
    },
    [dispatch],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    multiple: false,
  });

  const updateConfig = (newConfig: any) =>
    dispatch({ type: "UPDATE_COVER_CONFIG", payload: newConfig });

  const handleDownloadThumbnail = async () => {
    if (!previewUrl) return;
    setIsGenerating(true);
    try {
      const blob = await buildThumbnailBlob(previewUrl, state.coverConfig);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `thumbnail.jpg`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Thumbnail generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const controlBtn = (active: boolean) =>
    `border-2 flex items-center justify-center gap-1.5 transition-all font-bold text-sm rounded-xl py-2.5 px-3 ${
      active
        ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-500/20"
        : `border ${isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400 hover:border-[#3A3D4E]" : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"}`
    }`;

  const posBtn = (active: boolean) =>
    `border-2 flex items-center justify-center gap-1.5 transition-all font-bold text-sm rounded-xl py-2.5 px-3 ${
      active
        ? `border-blue-600 ${isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700"}`
        : `${isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400 hover:border-[#3A3D4E]" : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"}`
    }`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start p-1 md:p-2">
      {/* ── বাম: Preview ──────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3">
        <h3
          className={`text-[10px] font-black ${t.textMuted} uppercase tracking-widest self-start md:self-center`}
        >
          Live Preview
        </h3>

        {/* Mobile: preview উপরে full width, controls নিচে */}
        <div className="flex flex-col gap-3 w-full md:items-center">
          {/* Preview dropzone */}
          <div
            {...getRootProps()}
            className={`relative w-full md:max-w-[280px] shrink-0 aspect-[395/632] rounded-xl md:rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200 cursor-pointer
              ${previewUrl ? "border-blue-500 ring-2 ring-blue-500/20" : isDragActive ? t.dropzoneActive : t.dropzone}`}
          >
            <input {...getInputProps()} />
            {previewUrl ? (
              <div className="relative w-full h-full group">
                <img
                  src={previewUrl}
                  alt="Cover Preview"
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute transition-all duration-200 pointer-events-none"
                  style={{
                    ...(state.coverConfig.logoPosition === "top-right"
                      ? { top: `${state.coverConfig.margin}px` }
                      : { bottom: `${state.coverConfig.margin}px` }),
                    right: `${state.coverConfig.margin}px`,
                    width: `${state.coverConfig.logoSize || 18}%`,
                  }}
                >
                  <img
                    src={
                      state.coverConfig.logoColor === "white"
                        ? "/boitoi_white.png"
                        : "/boitoi_blue.png"
                    }
                    alt="Logo"
                    className="w-full h-auto drop-shadow-xl"
                  />
                </div>
                {isInjecting && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1 text-white">
                      <RefreshCw size={18} className="animate-spin" />
                      <p className="text-[10px] font-bold">Injecting...</p>
                    </div>
                  </div>
                )}
                {!isInjecting && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-[10px] font-bold">Change</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-2">
                <div
                  className={`w-8 h-8 md:w-12 md:h-12 rounded-xl ${isDark ? "bg-[#252836]" : "bg-blue-50"} flex items-center justify-center`}
                >
                  <ImageIcon size={16} className="text-blue-400 md:hidden" />
                  <ImageIcon
                    size={22}
                    className="text-blue-400 hidden md:block"
                  />
                </div>
                <p
                  className={`text-[9px] md:text-xs font-bold ${t.textMuted} text-center`}
                >
                  {isDragActive ? "Drop!" : "Click or Drag"}
                </p>
              </div>
            )}
          </div>

          {/* ── Mobile Controls (নিচে) ──────────────────────────────── */}
          <div className="w-full md:hidden space-y-3">
            <div>
              <label
                className={`block text-[9px] font-black ${t.textMuted} mb-1.5 uppercase tracking-wider`}
              >
                Logo Style
              </label>
              <div className="flex gap-2">
                {(["blue", "white"] as const).map((color) => (
                  <button
                    key={color}
                    onClick={() => updateConfig({ logoColor: color })}
                    className={`flex-1 py-1.5 rounded-lg border-2 flex items-center justify-center gap-1 transition-all font-bold text-xs
                      ${state.coverConfig.logoColor === color ? "border-blue-600 bg-blue-600 text-white" : `${isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400" : "border-gray-100 bg-gray-50 text-gray-400"}`}`}
                  >
                    {state.coverConfig.logoColor === color && (
                      <Check size={10} />
                    )}
                    {color === "blue" ? "Blue" : "White"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                className={`block text-[9px] font-black ${t.textMuted} mb-1.5 uppercase tracking-wider`}
              >
                Position
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "top-right", label: "Top Right" },
                  { id: "bottom-right", label: "Bottom Right" },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    onClick={() => updateConfig({ logoPosition: pos.id })}
                    className={`py-1.5 px-2 rounded-lg border-2 flex items-center justify-center gap-1 font-bold text-[10px] transition-all
                      ${state.coverConfig.logoPosition === pos.id ? `border-blue-600 ${isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700"}` : `${isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400" : "border-gray-100 bg-gray-50 text-gray-400"}`}`}
                  >
                    {state.coverConfig.logoPosition === pos.id && (
                      <Check size={10} />
                    )}
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label
                  className={`text-[9px] font-black ${t.textMuted} uppercase tracking-wider`}
                >
                  Logo Size
                </label>
                <span className="text-blue-500 font-bold text-[10px]">
                  {state.coverConfig.logoSize || 18}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                value={state.coverConfig.logoSize || 18}
                onChange={(e) =>
                  updateConfig({ logoSize: parseInt(e.target.value) })
                }
                className={`w-full h-1 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label
                  className={`text-[9px] font-black ${t.textMuted} uppercase tracking-wider`}
                >
                  Margin
                </label>
                <span className="text-blue-500 font-bold text-[10px]">
                  {state.coverConfig.margin || 18}px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={state.coverConfig.margin || 18}
                onChange={(e) =>
                  updateConfig({ margin: parseInt(e.target.value) })
                }
                className={`w-full h-1 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
              />
            </div>
            {previewUrl && (
              <button
                onClick={handleDownloadThumbnail}
                disabled={isGenerating || isInjecting}
                className="w-full flex items-center justify-center gap-1.5 bg-blue-600 text-white py-2 rounded-xl font-bold text-xs hover:bg-blue-700 shadow-md transition-all active:scale-95 disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />{" "}
                    Generating...
                  </>
                ) : (
                  <>
                    <Download size={12} /> Download Thumbnail
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── ডান: Desktop Control Panel ────────────────────────────────── */}
      <div
        className={`hidden md:flex flex-col gap-6 ${t.card} border ${t.cardBorder} p-6 rounded-2xl h-full`}
      >
        {/* Logo Style */}
        <div>
          <label
            className={`block text-[10px] font-black ${t.textMuted} mb-3 uppercase tracking-[0.2em]`}
          >
            Logo Style
          </label>
          <div className="flex gap-2">
            {(["blue", "white"] as const).map((color) => (
              <button
                key={color}
                onClick={() => updateConfig({ logoColor: color })}
                className={`flex-1 ${controlBtn(state.coverConfig.logoColor === color)}`}
              >
                {state.coverConfig.logoColor === color && <Check size={13} />}
                {color === "blue" ? "Blue" : "White"}
              </button>
            ))}
          </div>
        </div>

        {/* Logo Position */}
        <div>
          <label
            className={`block text-[10px] font-black ${t.textMuted} mb-3 uppercase tracking-[0.2em]`}
          >
            Logo Position
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                id: "top-right",
                label: "Top Right",
                icon: <MousePointer2 size={12} className="rotate-[-90deg]" />,
              },
              {
                id: "bottom-right",
                label: "Bottom Right",
                icon: <MousePointer2 size={12} />,
              },
            ].map((pos) => (
              <button
                key={pos.id}
                onClick={() => updateConfig({ logoPosition: pos.id })}
                className={posBtn(state.coverConfig.logoPosition === pos.id)}
              >
                {state.coverConfig.logoPosition === pos.id ? (
                  <Check size={13} />
                ) : (
                  pos.icon
                )}
                {pos.label}
              </button>
            ))}
          </div>
        </div>

        <hr className={t.divider} />

        {/* Sliders */}
        <div className="space-y-5">
          <div>
            <div className="flex justify-between mb-2">
              <label
                className={`flex items-center gap-1.5 text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}
              >
                <Maximize2 size={10} /> Logo Size
              </label>
              <span
                className={`text-blue-500 font-bold text-xs px-2 py-0.5 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}
              >
                {state.coverConfig.logoSize || 18}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="40"
              value={state.coverConfig.logoSize || 18}
              onChange={(e) =>
                updateConfig({ logoSize: parseInt(e.target.value) })
              }
              className={`w-full h-1.5 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label
                className={`flex items-center gap-1.5 text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}
              >
                <Move size={10} /> Margin Offset
              </label>
              <span
                className={`text-blue-500 font-bold text-xs px-2 py-0.5 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}
              >
                {state.coverConfig.margin || 18}px
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={state.coverConfig.margin || 18}
              onChange={(e) =>
                updateConfig({ margin: parseInt(e.target.value) })
              }
              className={`w-full h-1.5 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
            />
          </div>
        </div>

        {/* ── Thumbnail Download — Control Panel এর নিচে ── */}
        <div className="mt-auto pt-2">
          <button
            onClick={handleDownloadThumbnail}
            disabled={isGenerating || isInjecting || !previewUrl}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw size={15} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Download size={15} /> Download Thumbnail
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverStep;
