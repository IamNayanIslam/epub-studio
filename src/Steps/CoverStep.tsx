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
import { useTheme, tokens } from "../Store/ThemeContext";
import { injectCoverIntoBlob } from "../Utils/EpubDownloader";

// ... (getTrimmedBounds, loadImageWithCORS, buildPlainCoverBlob, buildThumbnailBlob লজিক আগের মতোই থাকবে)

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
  useEffect(() => {
    processedBlobRef.current = state.processedBlob;
  }, [state.processedBlob]);

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
    `border-2 flex items-center justify-center gap-2 transition-all font-bold text-sm rounded-xl py-3 px-4 ${
      active
        ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/20"
        : `${t.cardBorder} border ${isDark ? "bg-[#252836] text-gray-400 hover:border-[#3A3D4E]" : "bg-gray-50 text-gray-400 hover:border-gray-200"}`
    }`;

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start max-w-5xl mx-auto w-full">
      {/* ── বাম পাশ: প্রিভিউ এবং থাম্বনেইল বাটন ─────────────────────────────────── */}
      <div className="w-full lg:w-[320px] shrink-0 space-y-4">
        <h3
          className={`text-xs font-black ${t.textMuted} uppercase tracking-widest text-center lg:text-left`}
        >
          Live Preview
        </h3>

        <div
          {...getRootProps()}
          className={`relative w-full aspect-[395/632] max-h-[512px] lg:max-h-none rounded-2xl border-2 border-dashed overflow-hidden flex items-center justify-center transition-all duration-200 cursor-pointer shadow-xl
            ${previewUrl ? "border-blue-500 ring-4 ring-blue-500/10" : isDragActive ? t.dropzoneActive : t.dropzone}`}
        >
          <input {...getInputProps()} />
          {previewUrl ? (
            <div className="relative w-full h-full group">
              <img
                src={previewUrl}
                alt="Cover"
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
                  className="w-full h-auto drop-shadow-2xl"
                />
              </div>

              {isInjecting && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm text-white">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw size={24} className="animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-tighter">
                      Injecting Cover...
                    </p>
                  </div>
                </div>
              )}

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-white text-sm font-bold bg-blue-600/80 px-4 py-2 rounded-full backdrop-blur-md">
                  Change Image
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <div
                className={`w-16 h-16 rounded-2xl ${isDark ? "bg-[#252836]" : "bg-blue-50"} flex items-center justify-center shadow-inner`}
              >
                <ImageIcon size={32} className="text-blue-400" />
              </div>
              <p className={`text-sm font-bold ${t.textMuted}`}>
                Click or Drag Cover Image
              </p>
            </div>
          )}
        </div>

        {previewUrl && (
          <button
            onClick={handleDownloadThumbnail}
            disabled={isGenerating || isInjecting}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-60"
          >
            {isGenerating ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            {isGenerating ? "GENERATING..." : "DOWNLOAD THUMBNAIL"}
          </button>
        )}
      </div>

      {/* ── ডান পাশ: কন্ট্রোল প্যানেল ──────────────────────────────────────── */}
      <div
        className={`w-full flex-1 space-y-8 ${t.card} border ${t.cardBorder} p-8 rounded-[32px] shadow-sm`}
      >
        {/* Logo Style */}
        <section className="space-y-4">
          <label
            className={`block text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}
          >
            Logo Style
          </label>
          <div className="grid grid-cols-2 gap-4">
            {(["blue", "white"] as const).map((color) => (
              <button
                key={color}
                onClick={() => updateConfig({ logoColor: color })}
                className={controlBtn(state.coverConfig.logoColor === color)}
              >
                {state.coverConfig.logoColor === color && <Check size={16} />}
                {color === "blue" ? "Blue Style" : "White Style"}
              </button>
            ))}
          </div>
        </section>

        {/* Logo Position */}
        <section className="space-y-4">
          <label
            className={`block text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}
          >
            Logo Position
          </label>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                id: "top-right",
                label: "Top Right",
                icon: <MousePointer2 size={16} className="rotate-[-90deg]" />,
              },
              {
                id: "bottom-right",
                label: "Bottom Right",
                icon: <MousePointer2 size={16} />,
              },
            ].map((pos) => (
              <button
                key={pos.id}
                onClick={() => updateConfig({ logoPosition: pos.id })}
                className={`py-3.5 px-4 rounded-xl border-2 flex items-center justify-center gap-2 transition-all font-bold text-sm
                  ${
                    state.coverConfig.logoPosition === pos.id
                      ? `border-blue-600 ${isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-700"}`
                      : `${isDark ? "border-[#2A2D3E] bg-[#252836] text-gray-400 hover:border-[#3A3D4E]" : "border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200"}`
                  }`}
              >
                {state.coverConfig.logoPosition === pos.id ? (
                  <Check size={16} />
                ) : (
                  pos.icon
                )}
                {pos.label}
              </button>
            ))}
          </div>
        </section>

        <hr className={t.divider} />

        {/* Sliders */}
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label
                className={`flex items-center gap-2 text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}
              >
                <Maximize2 size={14} /> Logo Size
              </label>
              <span
                className={`text-blue-500 font-black text-sm px-3 py-1 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}
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
              className={`w-full h-2 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label
                className={`flex items-center gap-2 text-[10px] font-black ${t.textMuted} uppercase tracking-[0.2em]`}
              >
                <Move size={14} /> Margin Offset
              </label>
              <span
                className={`text-blue-500 font-black text-sm px-3 py-1 rounded-lg ${isDark ? "bg-blue-900/30" : "bg-blue-50"}`}
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
              className={`w-full h-2 ${t.rangeBg} rounded-lg appearance-none cursor-pointer accent-blue-600`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoverStep;
