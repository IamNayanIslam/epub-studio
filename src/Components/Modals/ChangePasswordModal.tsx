import { useState } from "react";
import { X, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "../../Utils/supabaseClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
}

export const ChangePasswordModal = ({ isOpen, onClose, theme: t }: Props) => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setFormData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setError("");
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.newPassword.length < 8) {
      return setError("নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।");
    }
    if (formData.newPassword !== formData.confirmPassword) {
      return setError("নতুন পাসওয়ার্ড দুটো মিলছে না!");
    }

    setLoading(true);
    try {
      // ১. আগে current password দিয়ে re-authenticate
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email;

      if (!email) throw new Error("Session পাওয়া যাচ্ছে না।");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: formData.currentPassword,
      });

      if (signInError) throw new Error("বর্তমান পাসওয়ার্ড ভুল হয়েছে!");

      // ২. নতুন পাসওয়ার্ড আপডেট
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => handleClose(), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={handleClose} />

      <div className={`${t.card} border ${t.cardBorder} w-full max-w-[420px] rounded-t-3xl sm:rounded-[28px] shadow-2xl z-10 overflow-hidden`}>

        {/* Header */}
        <div className="relative p-6 sm:p-8 pb-4">
          {/* Mobile drag handle */}
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto mb-5 sm:hidden" />
          <button
            onClick={handleClose}
            className={`absolute right-5 top-5 sm:right-6 sm:top-6 p-2 rounded-full ${t.stepInactive} ${t.surfaceHover} ${t.textMuted} transition-all`}
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-4 bg-blue-500/10 text-blue-500">
              <Lock size={30} />
            </div>
            <h2 className={`text-2xl font-black tracking-tight ${t.textPrimary}`}>
              Change Password
            </h2>
            <p className={`text-xs font-bold mt-1 uppercase tracking-widest ${t.textMuted}`}>
              আপনার পাসওয়ার্ড আপডেট করুন
            </p>
          </div>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-8 pt-4 flex flex-col items-center gap-4 text-center">
            <CheckCircle2 size={48} className="text-green-500" />
            <p className={`font-black text-lg ${t.textPrimary}`}>পাসওয়ার্ড পরিবর্তন হয়েছে!</p>
            <p className={`text-sm ${t.textMuted}`}>আপনাকে স্বয়ংক্রিয়ভাবে বের করে দেওয়া হচ্ছে...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-4">

            {/* Current Password */}
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${t.textMuted}`}>
                বর্তমান পাসওয়ার্ড
              </label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={16} />
                <input
                  type={showPasswords.current ? "text" : "password"}
                  required
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  className={`w-full pl-12 pr-12 py-3.5 rounded-2xl border ${t.cardBorder} ${t.card} ${t.textPrimary} outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-bold text-sm`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, current: !p.current }))}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 ${t.textMuted} hover:text-blue-500 transition-colors`}
                >
                  {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${t.textMuted}`}>
                নতুন পাসওয়ার্ড
              </label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={16} />
                <input
                  type={showPasswords.new ? "text" : "password"}
                  required
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  placeholder="কমপক্ষে ৮ অক্ষর"
                  className={`w-full pl-12 pr-12 py-3.5 rounded-2xl border ${t.cardBorder} ${t.card} ${t.textPrimary} outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-bold text-sm`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, new: !p.new }))}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 ${t.textMuted} hover:text-blue-500 transition-colors`}
                >
                  {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${t.textMuted}`}>
                পাসওয়ার্ড নিশ্চিত করুন
              </label>
              <div className="relative">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={16} />
                <input
                  type={showPasswords.confirm ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="আবার লিখুন"
                  className={`w-full pl-12 pr-12 py-3.5 rounded-2xl border ${
                    formData.confirmPassword && formData.newPassword !== formData.confirmPassword
                      ? "border-red-500/50 focus:border-red-500"
                      : formData.confirmPassword && formData.newPassword === formData.confirmPassword
                      ? "border-green-500/50 focus:border-green-500"
                      : t.cardBorder
                  } ${t.card} ${t.textPrimary} outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-bold text-sm`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 ${t.textMuted} hover:text-blue-500 transition-colors`}
                >
                  {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Live match indicator */}
              {formData.confirmPassword && (
                <p className={`text-[10px] font-bold ml-1 ${
                  formData.newPassword === formData.confirmPassword
                    ? "text-green-500"
                    : "text-red-500"
                }`}>
                  {formData.newPassword === formData.confirmPassword
                    ? "✓ পাসওয়ার্ড মিলেছে"
                    : "✗ পাসওয়ার্ড মিলছে না"}
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl">
                <p className="text-red-400 text-xs font-bold text-center">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              disabled={loading}
              type="submit"
              className="w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
            >
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /> আপডেট হচ্ছে...</>
              ) : (
                "পাসওয়ার্ড পরিবর্তন করুন"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
