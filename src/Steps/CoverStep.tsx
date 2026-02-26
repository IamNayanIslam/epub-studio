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
import { useEpub } from "../Store/EpubContext";
import { injectCoverIntoBlob } from "../Utils/EpubDownloader";

// ── Transparent padding trim helper ───────────────────────────────────────
function getTrimmedBounds(logo: HTMLImageElement): {
  minX: number;
  minY: number;
  trimmedWidth: number;
  trimmedHeight: number;
} {
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

// ── crossOrigin image load helper ─────────────────────────────────────────
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

// ── Logo ছাড়া শুধু cover resize করে Blob বানানো (EPUB এর জন্য) ──────────
async function buildPlainCoverBlob(coverUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 395;
  canvas.height = 632;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const coverImg = await loadImageWithCORS(coverUrl);
  ctx.drawImage(coverImg, 0, 0, 395, 632);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject("Blob failed")),
      "image/jpeg",
      1.0,
    );
  });
}

// ── Logo সহ thumbnail Blob বানানো (download এর জন্য) ─────────────────────
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

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject("Blob failed")),
      "image/jpeg",
      1.0,
    );
  });
}

const CoverStep = () => {
  const { state, dispatch } = useEpub();
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    state.coverImage ?? null,
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);

  // ✅ Latest values সবসময় পাওয়ার জন্য useRef
  const processedBlobRef = useRef<Blob | null>(state.processedBlob);
  const coverConfigRef = useRef(state.coverConfig);

  useEffect(() => {
    processedBlobRef.current = state.processedBlob;
  }, [state.processedBlob]);

  useEffect(() => {
    coverConfigRef.current = state.coverConfig;
  }, [state.coverConfig]);
  useEffect(() => {
    if (!state.coverImage) {
      setPreviewUrl(null);
    }
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
          // ✅ EPUB এর জন্য logo ছাড়া plain cover
          const plainCoverBlob = await buildPlainCoverBlob(url);
          const updatedBlob = await injectCoverIntoBlob(
            currentBlob,
            plainCoverBlob,
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

  const updateConfig = (newConfig: any) => {
    dispatch({ type: "UPDATE_COVER_CONFIG", payload: newConfig });
  };

  // ── Thumbnail download — logo সহ ─────────────────────────────────────
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start p-2">
      {/* ── বাম পাশ: প্রিভিউ ─────────────────────────────────────────── */}
      <div className="space-y-4 text-center">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
          Live Preview
        </h3>

        <div
          {...getRootProps()}
          className={`relative aspect-[395/632] w-full max-w-[320px] mx-auto rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200 shadow-2xl cursor-pointer
            ${previewUrl ? "border-blue-400 ring-4 ring-blue-50" : isDragActive ? "border-blue-500 bg-blue-50 scale-[1.02]" : "border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300"}`}
        >
          <input {...getInputProps()} />

          {previewUrl ? (
            <div className="relative w-full h-full group">
              <img
                src={previewUrl}
                alt="Cover Preview"
                className="w-full h-full object-cover"
              />

              {/* Logo overlay — শুধু preview তে দেখাবে */}
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
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-white">
                    <RefreshCw size={24} className="animate-spin" />
                    <p className="text-xs font-bold">Injecting cover...</p>
                  </div>
                </div>
              )}

              {!isInjecting && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-xs font-bold tracking-wide">
                    Click to Change
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-gray-400 px-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <ImageIcon size={28} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">
                  {isDragActive ? "Drop it here!" : "Click or Drag Cover"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPG, PNG, WEBP supported
                </p>
              </div>
            </div>
          )}
        </div>

        {previewUrl && (
          <button
            onClick={handleDownloadThumbnail}
            disabled={isGenerating || isInjecting}
            className="w-full max-w-[320px] mx-auto flex items-center justify-center gap-2 bg-blue-600 text-white py-3.5 rounded-2xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Download size={16} /> Download Thumbnail
              </>
            )}
          </button>
        )}
      </div>

      {/* ── ডান পাশ: কন্ট্রোল প্যানেল ──────────────────────────────────── */}
      <div className="space-y-7 bg-white p-7 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">
            Logo Style
          </label>
          <div className="flex gap-3">
            {(["blue", "white"] as const).map((color) => (
              <button
                key={color}
                onClick={() => updateConfig({ logoColor: color })}
                className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-bold text-sm
                  ${state.coverConfig.logoColor === color ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-100" : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"}`}
              >
                {state.coverConfig.logoColor === color && <Check size={15} />}
                {color === "blue" ? "Blue" : "White"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black text-gray-400 mb-3 uppercase tracking-[0.2em]">
            Logo Position
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                id: "top-right",
                label: "Top Right",
                icon: <MousePointer2 size={13} className="rotate-[-90deg]" />,
              },
              {
                id: "bottom-right",
                label: "Bottom Right",
                icon: <MousePointer2 size={13} />,
              },
            ].map((pos) => (
              <button
                key={pos.id}
                onClick={() => updateConfig({ logoPosition: pos.id })}
                className={`py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-bold text-sm
                  ${state.coverConfig.logoPosition === pos.id ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm" : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"}`}
              >
                {state.coverConfig.logoPosition === pos.id ? (
                  <Check size={15} />
                ) : (
                  pos.icon
                )}
                {pos.label}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                <Maximize2 size={11} /> Logo Size
              </label>
              <span className="text-blue-600 font-bold text-sm bg-blue-50 px-2.5 py-0.5 rounded-lg">
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
              className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between mb-3">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                <Move size={11} /> Margin Offset
              </label>
              <span className="text-blue-600 font-bold text-sm bg-blue-50 px-2.5 py-0.5 rounded-lg">
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
              className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoverStep;
