import { useState } from "react";
import { supabase } from "../Utils/supabaseClient";
import { Loader2, Eye, EyeOff } from "lucide-react";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        { email, password },
      );
      if (authError) throw new Error("ইমেইল বা পাসওয়ার্ড ভুল হয়েছে!");

      if (data?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile?.status === "inactive") {
          await supabase.auth.signOut();
          throw new Error(
            "আপনার অ্যাকাউন্টটি বর্তমানে ইন-একটিভ আছে। এডমিনের সাথে যোগাযোগ করুন।",
          );
        }

        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-sans">
      {/* ── Left Panel ───────────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[55%] relative overflow-hidden bg-[#0a0a0a] flex-col items-center justify-center p-16">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-600/15 rounded-full blur-[100px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 max-w-md text-center space-y-8">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 rounded-[24px] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect
                x="6"
                y="4"
                width="20"
                height="26"
                rx="3"
                fill="white"
                fillOpacity="0.15"
                stroke="white"
                strokeWidth="1.5"
              />
              <rect
                x="14"
                y="4"
                width="20"
                height="26"
                rx="3"
                fill="white"
                fillOpacity="0.25"
                stroke="white"
                strokeWidth="1.5"
              />
              <line
                x1="18"
                y1="12"
                x2="30"
                y2="12"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="18"
                y1="17"
                x2="30"
                y2="17"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="18"
                y1="22"
                x2="26"
                y2="22"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-5xl font-black text-white tracking-tight leading-none">
              EPUB
              <br />
              <span className="text-blue-400">Studio</span>
            </h1>
            <p className="text-gray-400 text-lg font-medium leading-relaxed">
              Simple, fast, and flawless
              <br />
              ebook processing — every time.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {["Split & Clean", "Cover Inject", "Metadata Edit"].map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-gray-500 tracking-wide"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom label */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-[11px] font-bold text-gray-700 uppercase tracking-[0.2em]">
            Internal Tool · v2.0
          </p>
        </div>
      </div>

      {/* ── Right Panel ──────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-[380px] space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
                <rect
                  x="6"
                  y="4"
                  width="20"
                  height="26"
                  rx="3"
                  fill="white"
                  fillOpacity="0.3"
                  stroke="white"
                  strokeWidth="2"
                />
                <rect
                  x="14"
                  y="4"
                  width="20"
                  height="26"
                  rx="3"
                  fill="white"
                  fillOpacity="0.5"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <span className="font-black text-gray-900 text-lg tracking-tight">
              EPUB Studio
            </span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              Login to your account
            </h2>
            <p className="text-sm text-gray-400 font-medium">
              Enter your credentials to continue
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Email address
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm text-gray-900 placeholder:text-gray-400"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 pr-12 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-sm text-gray-900 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                <p className="text-red-500 text-xs font-bold leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-black text-sm tracking-wide transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Verifying...
                </>
              ) : (
                "Login"
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-[11px] text-gray-300 text-center font-medium">
            Secure access · Authorized personnel only
          </p>
        </div>
      </div>
    </div>
  );
};
