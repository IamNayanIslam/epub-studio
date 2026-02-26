import React from "react";
import { ChevronRight, Download, ArrowLeft, Loader2 } from "lucide-react";
import { useEpub } from "./Store/EpubContext";
import { injectCoverAndDownload } from "./Utils/EpubDownloader";

const steps = [
  { id: 0, title: "Upload & Clean" },
  { id: 1, title: "Cover & Logo" },
  { id: 2, title: "Metadata & Final" },
];

// ── crossOrigin সহ image load helper ─────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export const MainContainer = ({ children }: { children: React.ReactNode }) => {
  const { state, dispatch } = useEpub();
  const { currentStep, originalFile, coverImage, processedBlob } = state;
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleNext = () =>
    dispatch({ type: "SET_STEP", payload: currentStep + 1 });

  const handleBack = () =>
    dispatch({ type: "SET_STEP", payload: currentStep - 1 });

  // ── কভার ছাড়া সরাসরি download ────────────────────────────────────────
  const handleNoCoverDownload = () => {
    if (!processedBlob) {
      alert("আগে ফাইলটি প্রসেস হতে দিন!");
      return;
    }
    const url = URL.createObjectURL(processedBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Split_Book_No_Cover.epub`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Final download: cover + logo composite করে inject ────────────────
  const handleFinalDownload = async () => {
    if (!originalFile || !coverImage) {
      alert("প্রথমে file upload এবং cover select করুন!");
      return;
    }

    setIsDownloading(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 395;
      canvas.height = 632;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // ১. Cover draw করা
      const coverImg = await loadImage(coverImage);
      ctx.drawImage(coverImg, 0, 0, 395, 632);

      // ২. Logo draw করা (coverConfig থেকে settings নেওয়া)
      const logoSrc =
        state.coverConfig?.logoColor === "white"
          ? "/boitoi_white.png"
          : "/boitoi_blue.png";

      try {
        const logo = await loadImage(logoSrc);

        const logoSizePercent = state.coverConfig?.logoSize || 18;
        const margin = state.coverConfig?.margin || 18;
        const logoWidth = (395 * logoSizePercent) / 100;
        const logoHeight = (logo.naturalHeight / logo.naturalWidth) * logoWidth;

        const x = 395 - logoWidth - margin;
        const y =
          state.coverConfig?.logoPosition === "top-right"
            ? margin
            : 632 - logoHeight - margin;

        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 12;
        ctx.drawImage(logo, x, y, logoWidth, logoHeight);
      } catch {
        console.warn("Logo load failed, skipping logo overlay");
      }

      // ৩. Canvas থেকে blob বানিয়ে EPUB এ inject করা
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            const title = state.metadata?.title || "Updated_Book";
            await injectCoverAndDownload(originalFile, blob, title);
          }
          setIsDownloading(false);
        },
        "image/jpeg",
        1.0,
      );
    } catch (error) {
      console.error("Download Error:", error);
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      {/* ── Header ── */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex justify-between items-center">
          {steps.map((s) => (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold transition-all duration-300 ${
                    currentStep >= s.id
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-100 scale-110"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {s.id + 1}
                </div>
                <span
                  className={`text-sm font-bold tracking-tight transition-colors duration-300 ${
                    currentStep >= s.id ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {s.title}
                </span>
              </div>
              {s.id < 2 && (
                <div className="flex-1 max-w-[60px] h-[2px] bg-gray-100 mx-4" />
              )}
            </React.Fragment>
          ))}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10">
        <div className="bg-white rounded-[32px] shadow-xl shadow-blue-900/5 border border-white p-8 md:p-12 min-h-[500px] transition-all duration-500">
          {children}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white/80 backdrop-blur-md border-t p-6 sticky bottom-0">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-6 py-3 font-bold text-gray-500 hover:text-gray-800 disabled:opacity-0 transition-all rounded-2xl hover:bg-gray-50"
          >
            <ArrowLeft size={18} /> Back
          </button>

          <div className="flex items-center gap-3">
            {currentStep === 1 && (
              <>
                <button
                  onClick={handleNoCoverDownload}
                  className="hidden sm:flex items-center gap-2 px-6 py-3 bg-white text-gray-600 rounded-2xl font-bold border-2 border-gray-100 hover:border-blue-200 hover:text-blue-600 transition-all active:scale-95"
                >
                  <Download size={18} /> Download Epub
                </button>
                <button
                  onClick={() => dispatch({ type: "SET_STEP", payload: 2 })}
                  className="px-6 py-3 text-gray-400 font-bold hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                >
                  Skip Cover Step
                </button>
              </>
            )}

            {currentStep === 2 ? (
              <button
                onClick={handleFinalDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 px-10 py-4 bg-green-600 text-white rounded-[20px] font-black shadow-xl shadow-green-200 hover:bg-green-700 active:scale-95 transition-all text-sm uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Download size={20} /> Finish & Download
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!originalFile}
                className="flex items-center gap-2 px-10 py-4 bg-blue-600 text-white rounded-[20px] font-black shadow-xl shadow-blue-200 hover:bg-blue-700 disabled:bg-gray-200 disabled:shadow-none active:scale-95 transition-all text-sm uppercase tracking-wider"
              >
                {currentStep === 1 ? "Go to Next Step" : "Next Step"}{" "}
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
