import { MainContainer } from "./MainContainer";
import { useEpub } from "./Store/EpubContext";
import { useAuth } from "./Store/AuthContext";
import { Login } from "./Pages/Login";
import UploadStep from "./Components/Steps/UploadStep";
import CoverStep from "./Components/Steps/CoverStep";
import MetadataStep from "./Components/Steps/MetadataStep";

const LoadingScreen = () => (
  <div className="fixed inset-0 bg-[#0D0F18] flex flex-col items-center justify-center gap-8">
    <div className="relative">
      <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path
            d="M8 6h10a6 6 0 0 1 0 12H8V6z"
            fill="white"
            fillOpacity="0.9"
          />
          <path
            d="M8 18h12a6 6 0 0 1 0 12H8V18z"
            fill="white"
            fillOpacity="0.5"
          />
        </svg>
      </div>

      <div className="absolute inset-0 rounded-2xl bg-blue-500/20 animate-ping" />
    </div>

    <div className="flex flex-col items-center gap-2">
      <h1 className="text-white font-black text-xl tracking-tight">
        EPUB Studio
      </h1>
      <p className="text-slate-500 text-xs font-medium">Loading...</p>
    </div>

    <div className="w-32 h-[3px] bg-slate-800 rounded-full overflow-hidden">
      <div className="h-full bg-blue-500 rounded-full animate-[loading_1.4s_ease-in-out_infinite]" />
    </div>

    <style>{`
      @keyframes loading {
        0% { width: 0%; margin-left: 0%; }
        50% { width: 60%; margin-left: 20%; }
        100% { width: 0%; margin-left: 100%; }
      }
    `}</style>
  </div>
);

function App() {
  const { state } = useEpub();
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;

  return (
    <MainContainer>
      {state.currentStep === 0 && <UploadStep />}
      {state.currentStep === 1 && <CoverStep />}
      {state.currentStep === 2 && <MetadataStep />}
    </MainContainer>
  );
}

export default App;
