import { MainContainer } from "./MainContainer";
import CoverStep from "./Steps/CoverStep";
import MetadataStep from "./Steps/MetadataStep";
import UploadStep from "./Steps/UploadStep";
// import { UploadStep } from "./Steps/UploadStep";
import { useEpub } from "./Store/EpubContext";

function App() {
  const { state } = useEpub();
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
