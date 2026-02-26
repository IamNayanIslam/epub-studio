import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from "react";
import { epubReducer, initialState } from "./EpubReducer";
import type { EpubAction, EpubState } from "./Types";
// import { epubReducer, initialState } from './epubReducer';
// import { EpubState, EpubAction } from './types';

const EpubContext = createContext<{
  state: EpubState;
  dispatch: React.Dispatch<EpubAction>;
} | null>(null);

export const EpubProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(epubReducer, initialState);

  return (
    <EpubContext.Provider value={{ state, dispatch }}>
      {children}
    </EpubContext.Provider>
  );
};

export const useEpub = () => {
  const context = useContext(EpubContext);
  if (!context) throw new Error("useEpub must be used within an EpubProvider");
  return context;
};
