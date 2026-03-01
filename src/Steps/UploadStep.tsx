import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileWarning, Loader2, CheckCircle2 } from "lucide-react";
import { processEpubFile } from "../Utils/EpubProcessor";
import { processAndSplitEpub } from "../Utils/EpubSplit";
import { useEpub } from "../Store/EpubContext";
import { useTheme, tokens } from "../Store/ThemeContext";

interface ModalState {
  type: "missing-points" | "no-points";
  data: { wordCount: number; missingPoints?: number[]; totalSplits?: number };
}

const UploadStep = () => {
  const { dispatch } = useEpub();
  const { isDark } = useTheme();
  const t = isDark ? tokens.dark : tokens.light;

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [detectedSplits, setDetectedSplits] = useState<number | null>(null);
  const [showModal, setShowModal] = useState<ModalState | null>(null);
  const [customSplitCount, setCustomSplitCount] = useState<number>(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const runSplitAndDispatch = async (
    file: File,
    splitConfig: { isManual: boolean; count: number },
  ) => {
    const blob = await processAndSplitEpub(file, splitConfig);
    dispatch({ type: "SET_PROCESSED_BLOB", payload: blob });
  };

  const text = '"';
console.log('char code:', text.charCodeAt(0), '| hex:', text.charCodeAt(0).toString(16));

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

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
          const splitConfig = { isManual: true, count: totalSplits };

          dispatch({
            type: "SET_FILE",
            payload: { file, wordCount: result.data.wordCount, missing: [] },
          });
          dispatch({
            type: "UPDATE_SPLIT_CONFIG",
            payload: { isManual: true, splitCount: totalSplits },
          });
          await runSplitAndDispatch(file, splitConfig);
        } else if (result.status === "error") {
          const errorType = result.errorType as "missing-points" | "no-points";
          const suggestion = Math.ceil(result.data.wordCount / 1500);
          setCustomSplitCount(suggestion);
          setShowModal({ type: errorType, data: result.data });
          dispatch({
            type: "SET_FILE",
            payload: {
              file,
              wordCount: result.data.wordCount,
              missing: result.data.missingPoints || [],
            },
          });
        }
      } catch (err) {
        setIsProcessing(false);
        console.error("Processing Error:", err);
        alert("ফাইলটি প্রসেস করা যাচ্ছে না। সঠিক ইপাব দিন।");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/epub+zip": [".epub"] },
    multiple: false,
  });

  const handleModalAction = async () => {
    if (!showModal || !uploadedFile) return;
    let splitConfig: { isManual: boolean; count: number };

    if (showModal.type === "no-points") {
      splitConfig = { isManual: false, count: customSplitCount };
      dispatch({
        type: "UPDATE_SPLIT_CONFIG",
        payload: { isManual: false, splitCount: customSplitCount },
      });
    } else {
      const totalSplits: number = showModal.data.totalSplits ?? 0;
      splitConfig = { isManual: true, count: totalSplits };
      dispatch({
        type: "UPDATE_SPLIT_CONFIG",
        payload: { isManual: true, splitCount: totalSplits },
      });
    }

    await runSplitAndDispatch(uploadedFile, splitConfig);
    setShowModal(null);
    dispatch({ type: "SET_STEP", payload: 1 });
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-10">
      <div
        {...getRootProps()}
        className={`w-full max-w-xl p-10 sm:p-14 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
          ${
            isSuccess
              ? t.dropzoneSuccess
              : isDragActive
                ? t.dropzoneActive
                : t.dropzone
          }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-5 text-center">
          {isProcessing ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-12 h-12 text-green-500 animate-bounce" />
          ) : (
            <div
              className={`w-16 h-16 rounded-2xl ${isDark ? "bg-[#252836]" : "bg-gray-100"} flex items-center justify-center`}
            >
              <Upload className={`w-7 h-7 ${t.textMuted}`} />
            </div>
          )}

          <div
            className={`text-base font-semibold ${isSuccess ? "text-green-500" : t.textSecondary}`}
          >
            {isProcessing ? (
              <span className={t.textMuted}>ফাইলটি বিশ্লেষণ করা হচ্ছে...</span>
            ) : isSuccess ? (
              <div className="flex flex-col gap-2">
                <span className="text-lg font-bold text-green-500">
                  সফলভাবে প্রসেস হয়েছে!
                </span>
                <span
                  className={`text-sm px-4 py-1 rounded-full font-bold inline-block mx-auto ${isDark ? "bg-green-900/30 text-green-400" : "bg-green-100 text-green-700"}`}
                >
                  মোট {detectedSplits} টি স্প্লিট পয়েন্ট পাওয়া গেছে
                </span>
              </div>
            ) : (
              <div className="space-y-1">
                <p className={`font-bold ${t.textPrimary}`}>
                  Drag & drop EPUB file
                </p>
                <p className={`text-sm ${t.textMuted}`}>or click to select</p>
              </div>
            )}
          </div>

          {isSuccess && (
            <div
              className={`w-full ${isDark ? "bg-[#2A2D3E]" : "bg-gray-200"} h-1 rounded-full overflow-hidden mt-2`}
            >
              <div className="bg-green-500 h-full w-full origin-left animate-[progress_3s_linear]" />
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div
          className={`fixed inset-0 ${t.overlay} backdrop-blur-sm flex items-center justify-center p-4 z-50`}
        >
          <div
            className={`${t.modal} border ${t.cardBorder} p-7 rounded-2xl max-w-md w-full shadow-2xl`}
          >
            <h3
              className={`text-lg font-black flex items-center gap-2 mb-4 ${t.textPrimary} uppercase tracking-tight`}
            >
              <FileWarning className="text-amber-500" size={20} />
              {showModal.type === "missing-points"
                ? "Split Points Missing"
                : "No Split Points Found"}
            </h3>

            <div className={`${t.textSecondary} mb-6 leading-relaxed text-sm`}>
              {showModal.type === "missing-points" ? (
                <div className="space-y-3">
                  <p>বইটিতে নিচের পয়েন্টগুলো পাওয়া যায়নি:</p>
                  <div className="flex flex-wrap gap-2">
                    {showModal.data.missingPoints?.map((p) => (
                      <span
                        key={p}
                        className={`${t.tagBg} px-2 py-1 rounded-md font-bold text-xs border`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <p className={`text-xs ${t.textMuted}`}>
                    আপনি কি এই অবস্থাতেই স্প্লিট করতে চান?
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p>
                    কোনো নির্ধারিত স্প্লিট প্যাটার্ন পাওয়া যায়নি। মোট শব্দ:{" "}
                    <span className={`font-bold ${t.textPrimary}`}>
                      {showModal.data.wordCount}
                    </span>
                  </p>
                  <div
                    className={`${isDark ? "bg-blue-900/20 border-blue-800" : "bg-blue-50 border-blue-100"} p-4 rounded-xl border`}
                  >
                    <label className="block text-xs font-bold text-blue-500 mb-2 uppercase tracking-widest">
                      How many splits?
                    </label>
                    <input
                      type="number"
                      value={customSplitCount}
                      onChange={(e) =>
                        setCustomSplitCount(parseInt(e.target.value) || 1)
                      }
                      className={`w-full border-2 rounded-lg px-3 py-2 font-bold outline-none transition-all text-sm ${isDark ? "bg-[#252836] border-blue-800 text-gray-100 focus:border-blue-500" : "bg-white border-blue-200 text-blue-800 focus:border-blue-500"}`}
                    />
                    <p className="text-[10px] text-blue-400 mt-2 italic">
                      *১৫০০ শব্দে ১টি হিসেবে{" "}
                      {Math.ceil(showModal.data.wordCount / 1500)}টি সাজেস্ট
                      করছি।
                    </p>
                  </div>
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
                {showModal.type === "missing-points"
                  ? "Continue Anyway"
                  : "Start Splitting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadStep;
