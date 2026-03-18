import { create } from "zustand";
import type { ScopeMode } from "../types/consoleApi";

export type SourceViewMode = "all" | "active" | "bowed";

interface UiSessionState {
  scopeMode: ScopeMode;
  selectedCasa: string;
  discoveredGangName: string;
  discoveredCasas: Array<{
    name: string;
    host: string;
    port: number;
    messageTransportName: string;
  }>;
  sourceFilters: {
    mode: SourceViewMode;
    prefix: string;
    search: string;
  };
  usageFilters: {
    activeOnly: boolean;
    hasConsumers: boolean;
  };
  previewOptions: {
    includeUsage: boolean;
    progress: boolean;
    summaryOnly: boolean;
    topChanged: number;
    limit: number;
  };
  activeSourceUName: string | null;
  setScopeMode: (scopeMode: ScopeMode) => void;
  setSelectedCasa: (selectedCasa: string) => void;
  setDiscoverySnapshot: (
    gangName: string,
    casas: Array<{ name: string; host: string; port: number; messageTransportName: string }>
  ) => void;
  setSourceFilters: (filters: Partial<UiSessionState["sourceFilters"]>) => void;
  setUsageFilters: (filters: Partial<UiSessionState["usageFilters"]>) => void;
  setPreviewOptions: (options: Partial<UiSessionState["previewOptions"]>) => void;
  setActiveSourceUName: (sourceUName: string | null) => void;
}

export const useUiSessionStore = create<UiSessionState>((set) => ({
  scopeMode: "gang",
  selectedCasa: "all",
  discoveredGangName: "",
  discoveredCasas: [],
  sourceFilters: {
    mode: "all",
    prefix: "",
    search: ""
  },
  usageFilters: {
    activeOnly: false,
    hasConsumers: false
  },
  previewOptions: {
    includeUsage: false,
    progress: true,
    summaryOnly: true,
    topChanged: 25,
    limit: 200
  },
  activeSourceUName: null,
  setScopeMode: (scopeMode) => set({ scopeMode }),
  setSelectedCasa: (selectedCasa) => set({ selectedCasa }),
  setDiscoverySnapshot: (discoveredGangName, discoveredCasas) => set({ discoveredGangName, discoveredCasas }),
  setSourceFilters: (filters) =>
    set((state) => ({
      sourceFilters: { ...state.sourceFilters, ...filters }
    })),
  setUsageFilters: (filters) =>
    set((state) => ({
      usageFilters: { ...state.usageFilters, ...filters }
    })),
  setPreviewOptions: (options) =>
    set((state) => ({
      previewOptions: { ...state.previewOptions, ...options }
    })),
  setActiveSourceUName: (activeSourceUName) => set({ activeSourceUName })
}));
