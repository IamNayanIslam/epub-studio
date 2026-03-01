import React, { useState, useEffect } from "react";
import {
  X, Mail, Loader2, UserPlus, User, Lock, RefreshCw,
  ChevronRight, ChevronDown, ShieldCheck,
} from "lucide-react";
import { supabase } from "../../Utils/supabaseClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
}

export const AddUserModal = ({ isOpen, onClose, theme: t }: Props) => {
  const [formData, setFormData] = useState({
    fullName: "", email: "", password: "", role: "editor",
  });
  const [loading, setLoading] = useState(false);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!%";
    let password = "";
    for (let i = 0; i < 12; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData((prev) => ({ ...prev, password }));
  };

  useEffect(() => {
    if (isOpen) {
      setFormData({ fullName: "", email: "", password: "", role: "editor" });
      generatePassword();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { full_name: formData.fullName, role: formData.role } },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase.from("profiles").insert([{
          id: authData.user.id,
          name: formData.fullName,
          email: formData.email,
          role: formData.role,
          status: "active",
          is_approved: true,
        }]);
        if (profileError) throw profileError;
      }

      alert(`✅ User Created!\nName: ${formData.fullName}\nEmail: ${formData.email}\nPassword: ${formData.password}\nRole: ${formData.role}`);
      onClose();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = formData.role === "admin";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className={`${t.card} border ${t.cardBorder} w-full max-w-[480px] rounded-[32px] shadow-2xl z-10 overflow-hidden`}>

        {/* Header */}
        <div className="relative p-8 pb-4">
          <button
            onClick={onClose}
            className={`absolute right-6 top-6 p-2 rounded-full ${t.stepInactive} ${t.surfaceHover} ${t.textMuted} transition-all`}
          >
            <X size={18} />
          </button>

          <div className="flex flex-col items-center text-center">
            <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center mb-4 ${
              isAdmin ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
            }`}>
              {isAdmin ? <ShieldCheck size={32} /> : <UserPlus size={32} />}
            </div>
            <h2 className={`text-2xl font-black tracking-tight ${t.textPrimary}`}>Add New User</h2>
            <p className={`text-xs font-bold mt-1 uppercase tracking-widest ${t.textMuted}`}>
              Setup {formData.role} account
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleAddUser} className="p-8 pt-4 space-y-5">

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${t.textMuted}`}>Full Name</label>
            <div className="relative">
              <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
              <input
                type="text" required value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Nayan Ahmed"
                className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border ${t.cardBorder} ${t.card} ${t.textPrimary} outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-bold text-sm`}
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${t.textMuted}`}>Email Address</label>
            <div className="relative">
              <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={18} />
              <input
                type="email" required value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="nayan@example.com"
                className={`w-full pl-12 pr-4 py-3.5 rounded-2xl border ${t.cardBorder} ${t.card} ${t.textPrimary} outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all font-bold text-sm`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Role */}
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${t.textMuted}`}>Role</label>
              <div className="relative">
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className={`w-full px-4 py-3.5 rounded-2xl border ${t.cardBorder} ${t.card} ${t.textPrimary} text-sm font-black capitalize outline-none focus:ring-2 focus:ring-blue-500/30 appearance-none cursor-pointer`}
                >
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${t.textMuted}`} />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${t.textMuted}`}>Password</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} size={15} />
                <input
                  type="text" required value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full pl-9 pr-9 py-3.5 rounded-2xl border ${t.cardBorder} ${t.card} ${t.textPrimary} outline-none focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-[10px] font-bold`}
                />
                <button
                  type="button" onClick={generatePassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-blue-500/10 rounded-lg transition-colors text-blue-500"
                  title="Generate Password"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            disabled={loading} type="submit"
            className={`w-full mt-2 py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98] text-white disabled:opacity-50 ${
              isAdmin
                ? "bg-purple-600 hover:bg-purple-700 shadow-purple-500/20"
                : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
            }`}
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <><span>Create User Account</span><ChevronRight size={18} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
