import { type EpubState, type EpubAction } from "./Types";

export const initialState: EpubState = {
  currentStep: 0,
  originalFile: null,
  coverImage: null,
  processedBlob: null,
  wordCount: 0,
  missingPoints: [],
  splitConfig: { isManual: false, splitCount: 0 },
  coverConfig: {
    logoPosition: "bottom-right",
    logoColor: "blue",
    margin: 18,
    logoSize: 18,
  },
  metadata: {
    title: "",
    authorBengali: "",
    authorFileAs: "",
    subjects: "",
    publisher: "Boitoi",
    language: "bn",
  },
};

export const epubReducer = (
  state: EpubState,
  action: EpubAction,
): EpubState => {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.payload };
    case "SET_FILE":
      return {
        ...state,
        originalFile: action.payload.file,
        wordCount: action.payload.wordCount,
        missingPoints: action.payload.missing,
        coverImage: null,
        processedBlob: null,
      };
    case "SET_COVER_IMAGE":
      return { ...state, coverImage: action.payload };
    case "UPDATE_SPLIT_CONFIG":
      return {
        ...state,
        splitConfig: { ...state.splitConfig, ...action.payload },
      };
    case "UPDATE_COVER_CONFIG":
      return {
        ...state,
        coverConfig: { ...state.coverConfig, ...action.payload },
      };
    case "UPDATE_METADATA":
      return { ...state, metadata: { ...state.metadata, ...action.payload } };
    case "SET_PROCESSED_BLOB":
      return { ...state, processedBlob: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
};
