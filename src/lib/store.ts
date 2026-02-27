import { create } from "zustand";
import type { ModelId, ImageModelId } from "./ai/providers";

interface AppState {
  activePatentId: string | null;
  activeSectionType: string | null;
  setActivePatent: (id: string | null) => void;
  setActiveSection: (sectionType: string | null) => void;

  defaultDraftingModel: ModelId;
  defaultClaimsModel: ModelId;
  defaultAnalysisModel: ModelId;
  defaultImageModel: ImageModelId;
  setDefaultDraftingModel: (model: ModelId) => void;
  setDefaultClaimsModel: (model: ModelId) => void;
  setDefaultAnalysisModel: (model: ModelId) => void;
  setDefaultImageModel: (model: ImageModelId) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activePatentId: null,
  activeSectionType: null,
  setActivePatent: (id) => set({ activePatentId: id }),
  setActiveSection: (sectionType) => set({ activeSectionType: sectionType }),

  defaultDraftingModel: "gemini-2.5-flash",
  defaultClaimsModel: "gpt-5.2",
  defaultAnalysisModel: "gemini-2.5-pro",
  defaultImageModel: "imagen-3",
  setDefaultDraftingModel: (model) => set({ defaultDraftingModel: model }),
  setDefaultClaimsModel: (model) => set({ defaultClaimsModel: model }),
  setDefaultAnalysisModel: (model) => set({ defaultAnalysisModel: model }),
  setDefaultImageModel: (model) => set({ defaultImageModel: model }),
}));
