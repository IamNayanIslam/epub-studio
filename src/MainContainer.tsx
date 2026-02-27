import React from "react";
import {
  ChevronRight,
  Download,
  ArrowLeft,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import { useEpub } from "./Store/EpubContext";
import { useTheme, tokens } from "./Store/ThemeContext";
import { downloadBlob } from "./Utils/EpubDownloader";
import { updateMetadataInBlob } from "./Steps/MetadataStep";

const steps = [
  { id: 0, title: "Upload & Clean" },
  { id: 1, title: "Cover & Logo" },
  { id: 2, title: "Metadata & Final" },
];

export const MainContainer = ({ children }: { children: React.ReactNode }) => {
  const { state, dispatch } = useEpub();
  const { isDark, toggleTheme } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;
  const { currentStep, originalFile, processedBlob } = state;
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleNext = () =>
    dispatch({ type: "SET_STEP", payload: currentStep + 1 });
  const handleBack = () =>
    dispatch({ type: "SET_STEP", payload: currentStep - 1 });

  const handleNoCoverDownload = () => {
    if (!processedBlob) {
      alert("আগে ফাইলটি প্রসেস হতে দিন!");
      return;
    }
    downloadBlob(processedBlob, "Split_Book_No_Cover");
  };

  const handleFinalDownload = async () => {
    if (!processedBlob) {
      alert("প্রথমে file upload করুন!");
      return;
    }
    setIsDownloading(true);
    try {
      const title = state.metadata?.title || "Updated_Book";
      const updatedBlob = await updateMetadataInBlob(
        processedBlob,
        state.metadata,
      );
      downloadBlob(updatedBlob, title);
    } catch (error) {
      console.error("Download Error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className={`min-h-screen ${t.bg} flex flex-col font-sans transition-colors duration-300`}
    >
      {/* ── Header ── */}
      <header className={`${t.header} border-b sticky top-0 z-10`}>
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
          {/* Steps */}
          <div className="flex items-center gap-1 sm:gap-2">
            {steps.map((s, idx) => (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs transition-all duration-300 shrink-0 ${
                      currentStep >= s.id
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : t.stepInactive
                    }`}
                  >
                    {s.id + 1}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-bold tracking-tight transition-colors duration-300 leading-tight ${
                      currentStep >= s.id ? t.textPrimary : t.textMuted
                    }`}
                  >
                    <span className="sm:hidden">
                      {s.id === 0 ? "Upload" : s.id === 1 ? "Cover" : "Final"}
                    </span>
                    <span className="hidden sm:inline">{s.title}</span>
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`w-6 sm:w-10 h-[2px] ${t.stepConnector} mx-1`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.stepInactive} ${t.surfaceHover} transition-all`}
          >
            {isDark ? (
              <Sun size={15} className="text-yellow-400" />
            ) : (
              <Moon size={15} className={t.textMuted} />
            )}
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-6 md:p-8">
        <div
          className={`${t.card} border ${t.cardBorder} rounded-[20px] sm:rounded-[28px] shadow-xl p-4 sm:p-8 md:p-10 min-h-[400px] sm:min-h-[500px] transition-colors duration-300`}
        >
          {children}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer
        className={`${t.footer} border-t p-3 sm:p-5 sticky bottom-0 backdrop-blur-md`}
      >
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-2">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2.5 font-bold text-sm ${t.textMuted} hover:${t.textPrimary} disabled:opacity-0 transition-all rounded-xl ${t.surfaceHover} shrink-0`}
          >
            <ArrowLeft size={15} /> Back
          </button>

          <div className="flex items-center gap-2">
            {currentStep === 1 && (
              <>
                <button
                  onClick={handleNoCoverDownload}
                  className={`hidden sm:flex items-center gap-2 px-5 py-2.5 ${t.surface} ${t.textSecondary} rounded-xl font-bold border ${t.cardBorder} hover:border-blue-400 hover:text-blue-500 transition-all active:scale-95 text-sm`}
                >
                  <Download size={16} /> Download Epub
                </button>
                <button
                  onClick={() => dispatch({ type: "SET_STEP", payload: 2 })}
                  className={`px-3 sm:px-5 py-2.5 text-xs sm:text-sm ${t.textMuted} font-bold hover:text-blue-500 ${t.surfaceHover} rounded-xl transition-all whitespace-nowrap`}
                >
                  Skip Cover
                </button>
              </>
            )}

            {currentStep === 2 ? (
              <button
                onClick={handleFinalDownload}
                disabled={isDownloading || !processedBlob}
                className="flex items-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3 bg-green-600 text-white rounded-xl font-black shadow-lg shadow-green-500/20 hover:bg-green-700 active:scale-95 transition-all text-xs sm:text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isDownloading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="hidden sm:inline">Processing...</span>
                    <span className="sm:hidden">Wait...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span className="hidden sm:inline">Finish & Download</span>
                    <span className="sm:hidden">Download</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!originalFile}
                className="flex items-center gap-1.5 px-5 sm:px-8 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:bg-gray-300 disabled:shadow-none active:scale-95 transition-all text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap"
              >
                <span className="hidden sm:inline">
                  {currentStep === 1 ? "Go to Next Step" : "Next Step"}
                </span>
                <span className="sm:hidden">Next</span>
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
