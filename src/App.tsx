import { MainContainer } from "./MainContainer";
import { useEpub } from "./Store/EpubContext";
import { useAuth } from "./Store/AuthContext"; // আপনার AuthContext ইমপোর্ট করুন
import { Login } from "./Pages/Login"; // আপনার লগইন পেজ ইমপোর্ট করুন
import UploadStep from "./Components/Steps/UploadStep";
import CoverStep from "./Components/Steps/CoverStep";
import MetadataStep from "./Components/Steps/MetadataStep";

function App() {
  const { state } = useEpub();
  const { user, loading } = useAuth(); // Auth ডাটা নিয়ে আসা

  // ১. ডাটা লোড হওয়া পর্যন্ত ওয়েট করা (সাদা স্ক্রিন এড়াতে)
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <p className="animate-pulse">EPUB Studio লোড হচ্ছে...</p>
      </div>
    );
  }

  // ২. যদি ইউজার লগ-ইন করা না থাকে, তবে তাকে শুধু লগইন পেজ দেখাও
  if (!user) {
    return <Login />;
  }

  // ৩. ইউজার লগ-ইন থাকলে আপনার আসল অ্যাপ দেখাবে
  return (
    <>
      <div>
        <MainContainer>
          {state.currentStep === 0 && <UploadStep />}
          {state.currentStep === 1 && <CoverStep />}
          {state.currentStep === 2 && <MetadataStep />}
        </MainContainer>
      </div>
    </>
  );
}

export default App;
