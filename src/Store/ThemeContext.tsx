import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // localStorage চেক
    const saved = localStorage.getItem("epub-theme");
    if (saved === "light" || saved === "dark") return saved;
    // system preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    localStorage.setItem("epub-theme", theme);
    // html element এ class যোগ (Tailwind dark mode এর জন্য প্রয়োজন হলে)
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, isDark: theme === "dark" }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};

// ── Color tokens ──────────────────────────────────────────────────────────
export const tokens = {
  light: {
    // backgrounds
    bg: "bg-[#F8FAFC]",
    surface: "bg-white",
    surfaceHover: "hover:bg-gray-50",
    card: "bg-white",
    cardBorder: "border-gray-100",
    modal: "bg-white",

    // inputs
    input:
      "bg-gray-50 border-gray-100 text-gray-800 placeholder:text-gray-300 focus:border-blue-400 focus:bg-white",
    select: "bg-gray-50 border-gray-100 text-gray-800",

    // text
    textPrimary: "text-gray-900",
    textSecondary: "text-gray-600",
    textMuted: "text-gray-400",

    // header/footer
    header: "bg-white border-gray-200 shadow-sm",
    footer: "bg-white/80 border-gray-200",

    // divider
    divider: "border-gray-100",
    dividerBg: "bg-gray-100",

    // step indicator
    stepInactive: "bg-gray-100 text-gray-400",
    stepConnector: "bg-gray-100",

    // dropzone
    dropzone:
      "border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300",
    dropzoneActive: "border-blue-500 bg-blue-50",
    dropzoneSuccess: "border-green-500 bg-green-50 shadow-green-100",

    // modal overlay
    overlay: "bg-black/60",

    // misc
    tagBg: "bg-red-50 border-red-100 text-red-600",
    missingBadge: "bg-blue-50 border-blue-100 text-blue-600",
    rangeBg: "bg-gray-100",
  },
  dark: {
    // backgrounds
    bg: "bg-[#0F1117]",
    surface: "bg-[#1A1D27]",
    surfaceHover: "hover:bg-[#252836]",
    card: "bg-[#1A1D27]",
    cardBorder: "border-[#2A2D3E]",
    modal: "bg-[#1E2130]",

    // inputs
    input:
      "bg-[#252836] border-[#2A2D3E] text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:bg-[#2A2D3E]",
    select: "bg-[#252836] border-[#2A2D3E] text-gray-100",

    // text
    textPrimary: "text-gray-100",
    textSecondary: "text-gray-400",
    textMuted: "text-gray-500",

    // header/footer
    header: "bg-[#1A1D27] border-[#2A2D3E] shadow-none",
    footer: "bg-[#1A1D27]/90 border-[#2A2D3E]",

    // divider
    divider: "border-[#2A2D3E]",
    dividerBg: "bg-[#2A2D3E]",

    // step indicator
    stepInactive: "bg-[#252836] text-gray-500",
    stepConnector: "bg-[#2A2D3E]",

    // dropzone
    dropzone:
      "border-[#2A2D3E] bg-[#252836] hover:bg-[#2A2D3E] hover:border-[#3A3D4E]",
    dropzoneActive: "border-blue-500 bg-blue-900/20",
    dropzoneSuccess: "border-green-500 bg-green-900/20 shadow-green-900/20",

    // modal overlay
    overlay: "bg-black/75",

    // misc
    tagBg: "bg-red-900/30 border-red-800 text-red-400",
    missingBadge: "bg-blue-900/30 border-blue-800 text-blue-400",
    rangeBg: "bg-[#2A2D3E]",
  },
} as const;
