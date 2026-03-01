export interface CoverConfig {
  logoPosition: "top-right" | "bottom-right";
  logoColor: "blue" | "white";
  margin: number;
  logoSize: number;
  addBackground: boolean;
}

export interface Metadata {
  title: string;
  authorBengali: string;   // dc:creator content — বাংলায়
  authorFileAs: string;    // opf:file-as — ইংরেজিতে
  subjects: string;        // comma separated — Romance, Drama
  publisher: string;
  language: string;        // default "bn"
}

export interface EpubState {
  currentStep: number;
  originalFile: File | null;
  coverImage: string | null;
  processedBlob: Blob | null;
  wordCount: number;
  missingPoints: number[];
  splitConfig: {
    isManual: boolean;
    splitCount: number;
  };
  coverConfig: CoverConfig;
  metadata: Metadata;
}

export type EpubAction =
  | {
      type: "SET_FILE";
      payload: { file: File; wordCount: number; missing: number[] };
    }
  | { type: "SET_STEP"; payload: number }
  | { type: "SET_COVER_IMAGE"; payload: string }
  | {
      type: "UPDATE_SPLIT_CONFIG";
      payload: { isManual: boolean; splitCount: number };
    }
  | { type: "UPDATE_COVER_CONFIG"; payload: Partial<CoverConfig> }
  | { type: "UPDATE_METADATA"; payload: Partial<Metadata> }
  | { type: "SET_PROCESSED_BLOB"; payload: Blob }
  | { type: "RESET" };