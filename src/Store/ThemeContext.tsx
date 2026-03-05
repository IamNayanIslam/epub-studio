import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
interface ThemeContextType { theme: Theme; toggleTheme: () => void; isDark: boolean; }
const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("epub-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    localStorage.setItem("epub-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const toggleTheme = () => setTheme((p) => (p === "light" ? "dark" : "light"));
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};

export const tokens = {
  light: {
    bg: "bg-[#F0F2F8]",
    surface: "bg-white",
    surfaceHover: "hover:bg-slate-50",
    card: "bg-white",
    cardBorder: "border-slate-100",
    modal: "bg-white",
    input: "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-300 focus:border-blue-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(59,130,246,0.08)]",
    select: "bg-slate-50 border-slate-200 text-slate-800",
    textPrimary: "text-slate-900",
    textSecondary: "text-slate-600",
    textMuted: "text-slate-400",
    header: "bg-white/90 border-slate-200 shadow-sm backdrop-blur-xl",
    footer: "bg-white/85 border-slate-200 backdrop-blur-xl",
    divider: "border-slate-100",
    dividerBg: "bg-slate-100",
    stepInactive: "bg-slate-100 text-slate-400",
    stepConnector: "bg-slate-200",
    dropzone: "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300",
    dropzoneActive: "border-blue-400 bg-blue-50",
    dropzoneSuccess: "border-emerald-400 bg-emerald-50",
    overlay: "bg-slate-900/60",
    tagBg: "bg-red-50 border-red-100 text-red-500",
    missingBadge: "bg-blue-50 border-blue-100 text-blue-600",
    rangeBg: "bg-slate-200",
  },
  dark: {
    bg: "bg-[#0D0F18]",
    surface: "bg-[#151722]",
    surfaceHover: "hover:bg-[#1C1F30]",
    card: "bg-[#151722]",
    cardBorder: "border-[#222538]",
    modal: "bg-[#181B2A]",
    input: "bg-[#1C1F30] border-[#222538] text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]",
    select: "bg-[#1C1F30] border-[#222538] text-slate-100",
    textPrimary: "text-slate-100",
    textSecondary: "text-slate-400",
    textMuted: "text-slate-500",
    header: "bg-[#151722]/90 border-[#222538] shadow-none backdrop-blur-xl",
    footer: "bg-[#151722]/90 border-[#222538] backdrop-blur-xl",
    divider: "border-[#222538]",
    dividerBg: "bg-[#222538]",
    stepInactive: "bg-[#1C1F30] text-slate-500",
    stepConnector: "bg-[#222538]",
    dropzone: "border-[#222538] bg-[#1C1F30] hover:bg-[#222538] hover:border-[#2E3248]",
    dropzoneActive: "border-blue-500 bg-blue-900/20",
    dropzoneSuccess: "border-emerald-500 bg-emerald-900/15",
    overlay: "bg-black/70",
    tagBg: "bg-red-900/25 border-red-800/40 text-red-400",
    missingBadge: "bg-blue-900/25 border-blue-800/40 text-blue-400",
    rangeBg: "bg-[#1C1F30]",
  },
} as const;
