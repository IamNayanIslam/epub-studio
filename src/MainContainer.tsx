import React, { useState, useCallback, useEffect } from "react";
import {
  ChevronRight, Download, ArrowLeft, Loader2,
  Sun, Moon, Settings, UserPlus, LogOut, Key, Users,
  ImagePlus, FileArchive, FileText, CheckCircle2, XCircle, AlertTriangle, X,
} from "lucide-react";
import { useEpub } from "./Store/EpubContext";
import { useTheme, tokens } from "./Store/ThemeContext";
import { useAuth } from "./Store/AuthContext";
import { supabase } from "./Utils/supabaseClient";
import { downloadBlob, updateCoverXhtmlMetadata, generatePreviewEpub, downloadPreviewBlob } from "./Utils/EpubDownloader";
import { AddUserModal } from "./Components/Modals/AddUserModal";
import { updateMetadataInBlob, validateMetadata } from "./Components/Steps/MetadataStep";
import { UserControlModal } from "./Components/Modals/UserControlModal";
import { ChangePasswordModal } from "./Components/Modals/ChangePasswordModal";
import { CoverToolModal } from "./Components/Modals/CoverToolModal";
import { CompressEpubModal } from "./Components/Modals/CompressEpubModal";
import { DocxToEpubModal } from "./Components/Modals/DocxToEpubModal";

// ── Toast ─────────────────────────────────────────────────────────────────
type ToastType = "success" | "error" | "warning";
interface Toast { id: number; type: ToastType; message: string; }

const ToastContainer = ({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) => (
  <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-24 z-[200] flex flex-col gap-2 pointer-events-none sm:max-w-xs sm:ml-auto">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border pointer-events-auto
          backdrop-blur-md text-sm font-semibold
          animate-in slide-in-from-bottom-4 sm:slide-in-from-right-4 fade-in duration-300
          ${t.type === "success" ? "bg-emerald-900/90 border-emerald-700/50 text-emerald-100" :
            t.type === "error" ? "bg-red-900/90 border-red-700/50 text-red-100" :
            "bg-amber-900/90 border-amber-700/50 text-amber-100"}`}
      >
        {t.type === "success" ? <CheckCircle2 size={16} className="shrink-0 text-emerald-400" /> :
         t.type === "error" ? <XCircle size={16} className="shrink-0 text-red-400" /> :
         <AlertTriangle size={16} className="shrink-0 text-amber-400" />}
        <span className="flex-1">{t.message}</span>
        <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 transition-opacity shrink-0">
          <X size={13} />
        </button>
      </div>
    ))}
  </div>
);

// ── Steps ─────────────────────────────────────────────────────────────────
const steps = [
  { id: 0, title: "Upload & Clean", short: "Upload" },
  { id: 1, title: "Cover & Logo", short: "Cover" },
  { id: 2, title: "Metadata & Final", short: "Final" },
];

export const MainContainer = ({ children }: { children: React.ReactNode }) => {
  const { state, dispatch } = useEpub();
  const { isDark, toggleTheme } = useTheme();
  const { profile } = useAuth();
  const t = isDark ? tokens.dark : tokens.light;
  const { currentStep, originalFile, processedBlob } = state;

  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewDownloading, setIsPreviewDownloading] = useState(false);
  const [activeModal, setActiveModal] = useState<"user" | "list" | "password" | "cover-tool" | "compress" | "docx-epub" | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [prevStep, setPrevStep] = useState(currentStep);
  const [animDir, setAnimDir] = useState<"forward" | "back">("forward");
  const [isAnimating, setIsAnimating] = useState(false);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);

  // Step transition animation
  useEffect(() => {
    if (currentStep !== prevStep) {
      setAnimDir(currentStep > prevStep ? "forward" : "back");
      setIsAnimating(true);
      const t = setTimeout(() => { setIsAnimating(false); setPrevStep(currentStep); }, 280);
      return () => clearTimeout(t);
    }
  }, [currentStep, prevStep]);

  const handleNext = () => dispatch({ type: "SET_STEP", payload: currentStep + 1 });
  const handleBack = () => dispatch({ type: "SET_STEP", payload: currentStep - 1 });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleNoCoverDownload = () => {
    if (!processedBlob) { addToast("warning", "আগে ফাইলটি প্রসেস হতে দিন!"); return; }
    downloadBlob(processedBlob, "Split_Book_No_Cover");
  };

  const handleFinalDownload = async () => {
    if (!processedBlob) { addToast("warning", "প্রথমে file upload করুন!"); return; }
    const emptyFields = validateMetadata(state.metadata);
    if (emptyFields.length > 0) {
      addToast("error", `${emptyFields.length}টি field খালি আছে। পূরণ করুন।`);
      return;
    }
    setIsDownloading(true);
    try {
      const title = state.metadata?.title || "Updated_Book";
      const authorBengali = state.metadata?.authorBengali || "";
      let blob = processedBlob;
      if (state.coverImage) blob = await updateCoverXhtmlMetadata(blob, title, authorBengali);
      const updatedBlob = await updateMetadataInBlob(blob, state.metadata);
      downloadBlob(updatedBlob, title);
      addToast("success", "ডাউনলোড সম্পন্ন হয়েছে!");
      dispatch({ type: "RESET" });
    } catch (error) {
      console.error("Download Error:", error);
      addToast("error", "ডাউনলোডে সমস্যা হয়েছে।");
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreviewDownload = async () => {
    if (!processedBlob) { addToast("warning", "প্রথমে file upload করুন!"); return; }
    const emptyFields = validateMetadata(state.metadata);
    if (emptyFields.length > 0) {
      addToast("error", `${emptyFields.length}টি field খালি আছে। পূরণ করুন।`);
      return;
    }
    setIsPreviewDownloading(true);
    try {
      const title = state.metadata?.title || "Updated_Book";
      const authorBengali = state.metadata?.authorBengali || "";
      let blob = processedBlob;
      if (state.coverImage) blob = await updateCoverXhtmlMetadata(blob, title, authorBengali);
      const updatedBlob = await updateMetadataInBlob(blob, state.metadata);
      const previewBlob = await generatePreviewEpub(updatedBlob, title);
      downloadPreviewBlob(previewBlob, title);
      addToast("success", "Preview ডাউনলোড সম্পন্ন!");
    } catch (error) {
      console.error("Preview Download Error:", error);
      addToast("error", "Preview তৈরিতে সমস্যা হয়েছে।");
    } finally {
      setIsPreviewDownloading(false);
    }
  };

  const isAdminOrAbove = profile?.role === "super_admin" || profile?.role === "admin";

  // Step content animation styles
  const contentStyle: React.CSSProperties = isAnimating ? {
    opacity: 0,
    transform: animDir === "forward" ? "translateX(18px)" : "translateX(-18px)",
    transition: "opacity 0.22s ease, transform 0.22s ease",
  } : {
    opacity: 1,
    transform: "translateX(0)",
    transition: "opacity 0.22s ease, transform 0.22s ease",
  };

  const menuItemClass = `w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold ${t.textSecondary} ${t.surfaceHover} rounded-xl transition-all text-left`;

  return (
    <div className={`min-h-screen ${t.bg} flex flex-col font-sans transition-colors duration-300`}>

      {/* ── Header ── */}
      <header className={`${t.header} border-b sticky top-0 z-50`}>
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-3">

          {/* Steps */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {steps.map((s, idx) => {
              const isActive = currentStep === s.id;
              const isDone = currentStep > s.id;
              return (
                <React.Fragment key={s.id}>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-black text-[11px] sm:text-xs transition-all duration-300 shrink-0 ${
                      isDone ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                      : isActive ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                      : t.stepInactive
                    }`}>
                      {isDone ? <CheckCircle2 size={13} /> : s.id + 1}
                    </div>
                    <span className={`text-[10px] sm:text-xs font-bold tracking-tight transition-all duration-300 hidden sm:inline ${
                      isActive ? t.textPrimary : isDone ? "text-emerald-500" : t.textMuted
                    }`}>
                      {s.title}
                    </span>
                    <span className={`text-[10px] font-bold tracking-tight transition-all duration-300 sm:hidden ${
                      isActive ? t.textPrimary : isDone ? "text-emerald-500" : t.textMuted
                    } ${isActive ? "inline" : "hidden"}`}>
                      {s.short}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-4 sm:w-8 h-[2px] rounded-full transition-all duration-500 ${
                      currentStep > s.id ? "bg-emerald-400" : t.stepConnector
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">

            {/* Theme */}
            <button
              onClick={toggleTheme}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border ${t.cardBorder} ${t.stepInactive} ${t.surfaceHover} transition-all`}
              title="Toggle theme"
            >
              {isDark
                ? <Sun size={15} className="text-amber-400" />
                : <Moon size={15} className={t.textMuted} />}
            </button>

            {/* Tools */}
            <div className="relative">
              <button
                onClick={() => { setShowTools(!showTools); setShowProfile(false); }}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border transition-all ${
                  showTools
                    ? "bg-blue-600 border-blue-600 text-white"
                    : `${t.cardBorder} ${t.stepInactive} ${t.surfaceHover}`
                }`}
                title="Tools"
              >
                <Settings size={15} />
              </button>

              {showTools && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTools(false)} />
                  <div className={`absolute right-0 mt-3 w-56 rounded-2xl shadow-2xl border ${t.cardBorder} ${isDark ? t.modal : t.surface} z-50 p-2 overflow-hidden`}>
                    <p className={`px-3 pt-1 pb-2 text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Tools</p>
                    <button onClick={() => { setActiveModal("cover-tool"); setShowTools(false); }} className={menuItemClass}>
                      <ImagePlus size={15} /> Create Cover
                    </button>
                    <button onClick={() => { setActiveModal("compress"); setShowTools(false); }} className={menuItemClass}>
                      <FileArchive size={15} /> Compress EPUB
                    </button>
                    <button onClick={() => { setActiveModal("docx-epub"); setShowTools(false); }} className={menuItemClass}>
                      <FileText size={15} /> DOCX → EPUB
                    </button>

                    {isAdminOrAbove && (
                      <>
                        <div className={`my-2 border-t ${t.cardBorder}`} />
                        <p className={`px-3 pt-1 pb-2 text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Management</p>
                        {profile?.role === "super_admin" && (
                          <button onClick={() => { setActiveModal("list"); setShowTools(false); }} className={menuItemClass}>
                            <Users size={15} /> User List & Control
                          </button>
                        )}
                        <button onClick={() => { setActiveModal("user"); setShowTools(false); }} className={menuItemClass}>
                          <UserPlus size={15} /> Add New User
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => { setShowProfile(!showProfile); setShowTools(false); }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-xs shadow-md hover:scale-105 transition-all"
              >
                {profile?.email?.substring(0, 1).toUpperCase()}
              </button>

              {showProfile && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowProfile(false)} />
                  <div className={`absolute right-0 mt-3 w-52 rounded-2xl shadow-2xl border ${t.cardBorder} ${isDark ? t.modal : t.surface} z-50 p-2`}>
                    <div className={`px-3 py-2.5 border-b ${t.cardBorder} mb-1`}>
                      <p className={`text-xs font-bold truncate ${t.textPrimary}`}>{profile?.email}</p>
                      <p className="text-[10px] text-blue-500 font-black uppercase tracking-wider mt-0.5">
                        {profile?.role?.replace("_", " ")}
                      </p>
                    </div>
                    <button
                      onClick={() => { setActiveModal("password"); setShowProfile(false); }}
                      className={menuItemClass}
                    >
                      <Key size={15} /> Change Password
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-500/10 rounded-xl transition-all text-left"
                    >
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-6 md:p-8">
        <div className={`${t.card} border ${t.cardBorder} rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-8 md:p-10 min-h-[420px] sm:min-h-[520px] transition-colors duration-300 overflow-hidden`}>
          <div style={contentStyle}>
            {children}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className={`${t.footer} border-t sticky bottom-0`}>
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2">

          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2.5 font-semibold text-sm rounded-xl transition-all ${t.surfaceHover} ${t.textMuted} disabled:opacity-0 shrink-0`}
          >
            <ArrowLeft size={15} /> <span className="hidden sm:inline">Back</span>
          </button>

          <div className="flex items-center gap-2">

            {currentStep === 1 && (
              <>
                <button
                  onClick={handleNoCoverDownload}
                  className={`hidden sm:flex items-center gap-2 px-5 py-2.5 ${t.surface} ${t.textSecondary} rounded-xl font-semibold border ${t.cardBorder} hover:border-blue-400 hover:text-blue-500 transition-all active:scale-95 text-sm`}
                >
                  <Download size={15} /> Download EPUB
                </button>
                <button
                  onClick={() => dispatch({ type: "SET_STEP", payload: 2 })}
                  className={`px-3 sm:px-5 py-2.5 text-xs sm:text-sm ${t.textMuted} font-semibold hover:text-blue-500 ${t.surfaceHover} rounded-xl transition-all whitespace-nowrap`}
                >
                  Skip Cover
                </button>
              </>
            )}

            {currentStep === 2 ? (
              <div className="flex items-center gap-2">
                {/* Preview */}
                <button
                  onClick={handlePreviewDownload}
                  disabled={isPreviewDownloading || isDownloading || !processedBlob}
                  className={`flex items-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold border-2 transition-all text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap active:scale-95 ${
                    isDark
                      ? "border-amber-700/50 bg-amber-900/15 text-amber-400 hover:border-amber-500 hover:bg-amber-900/30"
                      : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100"
                  }`}
                >
                  {isPreviewDownloading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Download size={14} />}
                  <span>Preview</span>
                </button>

                {/* Final */}
                <button
                  onClick={handleFinalDownload}
                  disabled={isDownloading || isPreviewDownloading || !processedBlob}
                  className="flex items-center gap-2 px-5 sm:px-7 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all text-xs sm:text-sm disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isDownloading
                    ? <><Loader2 size={15} className="animate-spin" /><span>Processing...</span></>
                    : <><Download size={15} /><span className="hidden sm:inline">Finish & Download</span><span className="sm:hidden">Download</span></>}
                </button>
              </div>
            ) : (
              <button
                onClick={handleNext}
                disabled={!originalFile}
                className="flex items-center gap-1.5 px-5 sm:px-7 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:bg-slate-300 disabled:shadow-none active:scale-95 transition-all text-xs sm:text-sm whitespace-nowrap"
              >
                <span className="hidden sm:inline">{currentStep === 1 ? "Go to Next Step" : "Next Step"}</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* ── Toast ── */}
      <ToastContainer toasts={toasts} remove={removeToast} />

      {/* ── Modals ── */}
      <CoverToolModal isOpen={activeModal === "cover-tool"} onClose={() => setActiveModal(null)} theme={t} isDark={isDark} />
      <CompressEpubModal isOpen={activeModal === "compress"} onClose={() => setActiveModal(null)} theme={t} isDark={isDark} />
      <DocxToEpubModal isOpen={activeModal === "docx-epub"} onClose={() => setActiveModal(null)} theme={t} isDark={isDark} />
      <AddUserModal isOpen={activeModal === "user"} onClose={() => setActiveModal(null)} theme={t} currentUserRole={profile?.role} />
      {profile?.role === "super_admin" && (
        <UserControlModal isOpen={activeModal === "list"} onClose={() => setActiveModal(null)} theme={t} />
      )}
      <ChangePasswordModal isOpen={activeModal === "password"} onClose={() => setActiveModal(null)} theme={t} />
    </div>
  );
};
