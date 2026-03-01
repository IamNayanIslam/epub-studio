import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { EpubProvider } from "./Store/EpubContext.tsx";
import { ThemeProvider } from "./Store/ThemeContext.tsx";
import { AuthProvider } from "./Store/AuthContext.tsx";

createRoot(document.getElementById("root")!).render(
  <EpubProvider>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </EpubProvider>,
);
