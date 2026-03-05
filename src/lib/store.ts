import { create } from "zustand";
import { persist } from "zustand/middleware";
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

  priorArtSidebarOpen: boolean;
  setPriorArtSidebarOpen: (open: boolean) => void;

  exportSettings: {
    pageSize: "letter" | "a4";
    fontSize: number;
    lineSpacing: number;
    paragraphNumbering: boolean;
  };
  setExportSettings: (settings: Partial<AppState["exportSettings"]>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activePatentId: null,
      activeSectionType: null,
      setActivePatent: (id) => set({ activePatentId: id }),
      setActiveSection: (sectionType) => set({ activeSectionType: sectionType }),

      defaultDraftingModel: "gemini-3.1-pro",
      defaultClaimsModel: "gemini-3.1-pro",
      defaultAnalysisModel: "gemini-3.1-pro",
      defaultImageModel: "nano-banana-2",
      setDefaultDraftingModel: (model) => set({ defaultDraftingModel: model }),
      setDefaultClaimsModel: (model) => set({ defaultClaimsModel: model }),
      setDefaultAnalysisModel: (model) => set({ defaultAnalysisModel: model }),
      setDefaultImageModel: (model) => set({ defaultImageModel: model }),

      priorArtSidebarOpen: false,
      setPriorArtSidebarOpen: (open) => set({ priorArtSidebarOpen: open }),

      exportSettings: {
        pageSize: "letter",
        fontSize: 12,
        lineSpacing: 2,
        paragraphNumbering: true,
      },
      setExportSettings: (settings) =>
        set((state) => ({
          exportSettings: { ...state.exportSettings, ...settings },
        })),
    }),
    {
      name: "patent-writer-settings",
      partialize: (state) => ({
        defaultDraftingModel: state.defaultDraftingModel,
        defaultClaimsModel: state.defaultClaimsModel,
        defaultAnalysisModel: state.defaultAnalysisModel,
        defaultImageModel: state.defaultImageModel,
        exportSettings: state.exportSettings,
      }),
    }
  )
);
