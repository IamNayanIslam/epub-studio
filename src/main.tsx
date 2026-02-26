import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { EpubProvider } from "./Store/EpubContext.tsx";

createRoot(document.getElementById("root")!).render(
  <EpubProvider>
    <App />
  </EpubProvider>,
);
