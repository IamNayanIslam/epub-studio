import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { EpubProvider } from "./Store/EpubContext.tsx";
import { ThemeProvider } from "./Store/ThemeContext.tsx";

createRoot(document.getElementById("root")!).render(
  <EpubProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </EpubProvider>,
);
