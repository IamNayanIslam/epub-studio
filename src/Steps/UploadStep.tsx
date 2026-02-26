import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileWarning, Loader2, CheckCircle2 } from "lucide-react";
import { processEpubFile } from "../Utils/EpubProcessor";
import { processAndSplitEpub } from "../Utils/EpubSplit";
import { useEpub } from "../Store/EpubContext";

interface ModalState {
  type: "missing-points" | "no-points";
  data: {
    wordCount: number;
    missingPoints?: number[];
    totalSplits?: number;
  };
}

const UploadStep = () => {
  const { dispatch } = useEpub();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [detectedSplits, setDetectedSplits] = useState<number | null>(null);
  const [showModal, setShowModal] = useState<ModalState | null>(null);
  const [customSplitCount, setCustomSplitCount] = useState<number>(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // ── useCallback এর বাইরে রাখা হয়েছে — plain async function ────────
  // এতে dependency issue হবে না
  const runSplitAndDispatch = async (
    file: File,
    splitConfig: { isManual: boolean; count: number },
  ) => {
    const blob = await processAndSplitEpub(file, splitConfig);
    dispatch({ type: "SET_PROCESSED_BLOB", payload: blob });
  };

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
          setIsSuccess(true);
          setDetectedSplits(result.data.totalSplits);

          const splitConfig = {
            isManual: true,
            count: result.data.totalSplits,
          };

          dispatch({
            type: "SET_FILE",
            payload: {
              file,
              wordCount: result.data.wordCount,
              missing: [],
            },
          });

          dispatch({
            type: "UPDATE_SPLIT_CONFIG",
            payload: { isManual: true, splitCount: result.data.totalSplits },
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
    [dispatch], // runSplitAndDispatch intentionally excluded — it's stable
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
      splitConfig = { isManual: true, count: showModal.data.totalSplits || 0 };
      dispatch({
        type: "UPDATE_SPLIT_CONFIG",
        payload: {
          isManual: true,
          splitCount: showModal.data.totalSplits || 0,
        },
      });
    }

    await runSplitAndDispatch(uploadedFile, splitConfig);

    setShowModal(null);
    dispatch({ type: "SET_STEP", payload: 1 });
  };

  return (
    <div className="flex flex-col items-center justify-center p-10">
      <div
        {...getRootProps()}
        className={`w-full max-w-xl p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-500
          ${isSuccess ? "border-green-500 bg-green-50 shadow-lg shadow-green-100" : isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4 text-center">
          {isProcessing ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="w-12 h-12 text-green-500 animate-bounce" />
          ) : (
            <Upload className="w-12 h-12 text-gray-400" />
          )}

          <div
            className={`text-lg font-medium ${isSuccess ? "text-green-800" : "text-gray-700"}`}
          >
            {isProcessing ? (
              "ফাইলটি বিশ্লেষণ করা হচ্ছে..."
            ) : isSuccess ? (
              <div className="flex flex-col gap-2">
                <span className="text-xl font-bold">
                  সফলভাবে প্রসেস হয়েছে!
                </span>
                <span className="text-sm bg-green-200 px-4 py-1 rounded-full text-green-700 inline-block mx-auto font-bold">
                  মোট {detectedSplits} টি স্প্লিট পয়েন্ট পাওয়া গেছে
                </span>
              </div>
            ) : (
              "Drag & drop EPUB file, or click to select"
            )}
          </div>

          {isSuccess && (
            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-4">
              <div className="bg-green-500 h-full w-full origin-left animate-[progress_3s_linear]" />
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-8 rounded-3xl max-w-md w-full shadow-2xl border border-gray-100">
            <h3 className="text-xl font-black flex items-center gap-2 mb-4 text-gray-800 uppercase tracking-tight">
              <FileWarning className="text-amber-500" />
              {showModal.type === "missing-points"
                ? "Split Points Missing"
                : "No Split Points Found"}
            </h3>

            <div className="text-gray-600 mb-6 leading-relaxed">
              {showModal.type === "missing-points" ? (
                <div className="space-y-3">
                  <p>বইটিতে নিচের পয়েন্টগুলো পাওয়া যায়নি:</p>
                  <div className="flex flex-wrap gap-2">
                    {showModal.data.missingPoints?.map((p) => (
                      <span
                        key={p}
                        className="bg-red-50 text-red-600 px-2 py-1 rounded-md font-bold text-xs border border-red-100"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400">
                    আপনি কি এই অবস্থাতেই স্প্লিট করতে চান?
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p>
                    এই বইতে কোনো নির্ধারিত স্প্লিট প্যাটার্ন পাওয়া যায়নি। মোট
                    শব্দ সংখ্যা:{" "}
                    <span className="font-bold text-black">
                      {showModal.data.wordCount}
                    </span>
                  </p>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <label className="block text-xs font-bold text-blue-600 mb-2 uppercase tracking-widest">
                      How many splits do you want?
                    </label>
                    <input
                      type="number"
                      value={customSplitCount}
                      onChange={(e) =>
                        setCustomSplitCount(parseInt(e.target.value) || 1)
                      }
                      className="w-full bg-white border-2 border-blue-200 rounded-lg px-3 py-2 text-blue-800 font-bold outline-none focus:border-blue-500 transition-all"
                    />
                    <p className="text-[10px] text-blue-400 mt-2 italic">
                      *আমরা ১৫০০ শব্দে ১টি স্প্লিট হিসেবে{" "}
                      {Math.ceil(showModal.data.wordCount / 1500)}টি সাজেস্ট
                      করছি।
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowModal(null)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-400 hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleModalAction}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 active:scale-95 transition-all"
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
