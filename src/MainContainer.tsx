import React, { useState } from "react";
import {
  ChevronRight, Download, ArrowLeft, Loader2,
  Sun, Moon, Settings, UserPlus, LogOut, Key, Users, ImagePlus, FileArchive,
} from "lucide-react";
import { useEpub } from "./Store/EpubContext";
import { useTheme, tokens } from "./Store/ThemeContext";
import { useAuth } from "./Store/AuthContext";
import { supabase } from "./Utils/supabaseClient";
import { downloadBlob, updateCoverXhtmlMetadata } from "./Utils/EpubDownloader";
import { AddUserModal } from "./Components/Modals/AddUserModal";
import { updateMetadataInBlob, validateMetadata } from "./Components/Steps/MetadataStep";
import { UserControlModal } from "./Components/Modals/UserControlModal";
import { ChangePasswordModal } from "./Components/Modals/ChangePasswordModal";
import { CoverToolModal } from "./Components/Modals/CoverToolModal";
import { CompressEpubModal } from "./Components/Modals/CompressEpubModal";

const steps = [
  { id: 0, title: "Upload & Clean" },
  { id: 1, title: "Cover & Logo" },
  { id: 2, title: "Metadata & Final" },
];

export const MainContainer = ({ children }: { children: React.ReactNode }) => {
  const { state, dispatch } = useEpub();
  const { isDark, toggleTheme } = useTheme();
  const { profile } = useAuth();
  const t = isDark ? tokens.dark : tokens.light;
  const { currentStep, originalFile, processedBlob } = state;
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeModal, setActiveModal] = useState<"user" | "list" | "password" | "cover-tool" | "compress" | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleNext = () => dispatch({ type: "SET_STEP", payload: currentStep + 1 });
  const handleBack = () => dispatch({ type: "SET_STEP", payload: currentStep - 1 });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const handleNoCoverDownload = () => {
    if (!processedBlob) { alert("আগে ফাইলটি প্রসেস হতে দিন!"); return; }
    downloadBlob(processedBlob, "Split_Book_No_Cover");
  };

  const handleFinalDownload = async () => {
    if (!processedBlob) { alert("প্রথমে file upload করুন!"); return; }

    // ── Metadata validation ───────────────────────────────────────────
    const emptyFields = validateMetadata(state.metadata);
    if (emptyFields.length > 0) {
      alert(`নিচের field গুলো পূরণ করুন:\n\n• ${emptyFields.join("\n• ")}`);
      return;
    }

    setIsDownloading(true);
    try {
      const title = state.metadata?.title || "Updated_Book";
      const authorBengali = state.metadata?.authorBengali || "";
      let blob = processedBlob;
      if (state.coverImage) {
        blob = await updateCoverXhtmlMetadata(blob, title, authorBengali);
      }
      const updatedBlob = await updateMetadataInBlob(blob, state.metadata);
      downloadBlob(updatedBlob, title);
      dispatch({ type: "RESET" });
    } catch (error) {
      console.error("Download Error:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const isAdminOrAbove = profile?.role === "super_admin" || profile?.role === "admin";

  return (
    <div className={`min-h-screen ${t.bg} flex flex-col font-sans transition-colors duration-300`}>

      {/* ── Header ── */}
      <header className={`${t.header} border-b sticky top-0 z-50`}>
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex justify-between items-center">

          {/* Steps */}
          <div className="flex items-center gap-1 sm:gap-2">
            {steps.map((s, idx) => (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-[10px] sm:text-xs transition-all duration-300 shrink-0 ${
                    currentStep >= s.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : t.stepInactive
                  }`}>
                    {s.id + 1}
                  </div>
                  {/* Label — mobile এ শুধু active step দেখাবে */}
                  <span className={`text-[10px] sm:text-xs font-bold tracking-tight transition-all duration-300 leading-tight ${
                    currentStep >= s.id ? t.textPrimary : t.textMuted
                  } ${currentStep === s.id ? "inline" : "hidden sm:inline"}`}>
                    <span className="sm:hidden">
                      {s.id === 0 ? "Upload" : s.id === 1 ? "Cover" : "Final"}
                    </span>
                    <span className="hidden sm:inline">{s.title}</span>
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`w-3 sm:w-10 h-[2px] ${t.stepConnector} mx-0.5 sm:mx-1`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Right Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2 relative">

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center ${t.stepInactive} ${t.surfaceHover} transition-all border ${t.cardBorder}`}
            >
              {isDark ? <Sun size={13} className="text-yellow-400 sm:hidden" /> : <Moon size={13} className={`${t.textMuted} sm:hidden`} />}
              {isDark ? <Sun size={16} className="text-yellow-400 hidden sm:block" /> : <Moon size={16} className={`${t.textMuted} hidden sm:block`} />}
            </button>

            {/* Settings — সব user */}
            <div className="relative">
              <button
                onClick={() => { setShowTools(!showTools); setShowProfile(false); }}
                className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center transition-all border ${t.cardBorder} ${
                  showTools ? "bg-blue-600 text-white border-blue-600" : `${t.stepInactive} ${t.surfaceHover}`
                }`}
              >
                <Settings size={13} className="sm:hidden" />
                <Settings size={16} className="hidden sm:block" />
              </button>

              {showTools && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTools(false)} />
                  <div className={`absolute right-0 mt-3 w-60 rounded-2xl shadow-2xl border ${t.cardBorder} ${t.header} z-50 p-2`}>

                    {/* Tools — সব user দেখবে */}
                    <p className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>
                      Tools
                    </p>
                    <button
                      onClick={() => { setActiveModal("cover-tool"); setShowTools(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold ${t.textSecondary} hover:bg-blue-600 hover:text-white rounded-xl transition-all text-left`}
                    >
                      <ImagePlus size={16} /> Create Cover
                    </button>
                    <button
                      onClick={() => { setActiveModal("compress"); setShowTools(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold ${t.textSecondary} hover:bg-blue-600 hover:text-white rounded-xl transition-all text-left`}
                    >
                      <FileArchive size={16} /> Compress EPUB
                    </button>

                    {/* Management — Admin/Super Admin */}
                    {isAdminOrAbove && (
                      <>
                        <div className={`my-2 border-t ${t.cardBorder}`} />
                        <p className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>
                          Management
                        </p>
                        {profile?.role === "super_admin" && (
                          <button
                            onClick={() => { setActiveModal("list"); setShowTools(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold ${t.textSecondary} hover:bg-blue-600 hover:text-white rounded-xl transition-all text-left`}
                          >
                            <Users size={16} /> User List & Control
                          </button>
                        )}
                        <button
                          onClick={() => { setActiveModal("user"); setShowTools(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold ${t.textSecondary} hover:bg-blue-600 hover:text-white rounded-xl transition-all text-left`}
                        >
                          <UserPlus size={16} /> Add New User
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
                className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-[10px] sm:text-xs border-2 ${t.cardBorder} shadow-sm hover:scale-105 transition-all`}
              >
                {profile?.email?.substring(0, 1).toUpperCase()}
              </button>

              {showProfile && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowProfile(false)} />
                  <div className={`absolute right-0 mt-3 w-52 rounded-2xl shadow-2xl border ${t.cardBorder} ${t.header} z-50 p-2`}>
                    <div className={`px-3 py-2 border-b ${t.cardBorder} mb-1`}>
                      <p className={`text-xs font-bold truncate ${t.textPrimary}`}>{profile?.email}</p>
                      <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider mt-0.5">
                        {profile?.role?.replace("_", " ")}
                      </p>
                    </div>
                    <button
                      onClick={() => { setActiveModal("password"); setShowProfile(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold ${t.textSecondary} ${t.surfaceHover} rounded-xl transition-all text-left`}
                    >
                      <Key size={16} /> Change Password
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-all text-left"
                    >
                      <LogOut size={16} /> Logout
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
        <div className={`${t.card} border ${t.cardBorder} rounded-[20px] sm:rounded-[28px] shadow-xl p-4 sm:p-8 md:p-10 min-h-[400px] sm:min-h-[500px] transition-colors duration-300`}>
          {children}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className={`${t.footer} border-t p-3 sm:p-5 sticky bottom-0 backdrop-blur-md`}>
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-2">

          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2.5 font-bold text-sm ${t.textMuted} disabled:opacity-0 transition-all rounded-xl ${t.surfaceHover} shrink-0`}
          >
            <ArrowLeft size={15} /> Back
          </button>

          <div className="flex items-center gap-2">
            {/* Step 1 — Skip Cover + Download without cover */}
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

            {/* Final Download */}
            {currentStep === 2 ? (
              <button
                onClick={handleFinalDownload}
                disabled={isDownloading || !processedBlob}
                className="flex items-center gap-2 px-5 sm:px-8 py-2.5 sm:py-3 bg-green-600 text-white rounded-xl font-black shadow-lg shadow-green-500/20 hover:bg-green-700 active:scale-95 transition-all text-xs sm:text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isDownloading ? (
                  <><Loader2 size={16} className="animate-spin" /><span className="hidden sm:inline">Processing...</span><span className="sm:hidden">Wait...</span></>
                ) : (
                  <><Download size={16} /><span className="hidden sm:inline">Finish & Download</span><span className="sm:hidden">Download</span></>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!originalFile}
                className="flex items-center gap-1.5 px-5 sm:px-8 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 disabled:bg-gray-300 disabled:shadow-none active:scale-95 transition-all text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap"
              >
                <span className="hidden sm:inline">{currentStep === 1 ? "Go to Next Step" : "Next Step"}</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* ── Modals ── */}
      <CoverToolModal
        isOpen={activeModal === "cover-tool"}
        onClose={() => setActiveModal(null)}
        theme={t}
        isDark={isDark}
      />
      <CompressEpubModal
        isOpen={activeModal === "compress"}
        onClose={() => setActiveModal(null)}
        theme={t}
        isDark={isDark}
      />
      <AddUserModal
        isOpen={activeModal === "user"}
        onClose={() => setActiveModal(null)}
        theme={t}
      />
      {profile?.role === "super_admin" && (
        <UserControlModal
          isOpen={activeModal === "list"}
          onClose={() => setActiveModal(null)}
          theme={t}
        />
      )}
      <ChangePasswordModal
        isOpen={activeModal === "password"}
        onClose={() => setActiveModal(null)}
        theme={t}
      />
    </div>
  );
};
