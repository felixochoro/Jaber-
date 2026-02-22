/**
 * Global client state via Zustand.
 * Map state, filter state, selected items, layer visibility.
 */
import { create } from "zustand";
import type { School, HubBrief, SchoolFilters, LayerVisibility, ScenarioConfig } from "@/types";

interface AtlasState {
  // Map viewport
  viewport: { longitude: number; latitude: number; zoom: number };
  setViewport: (v: Partial<AtlasState["viewport"]>) => void;

  // Filters
  filters: SchoolFilters;
  setFilters: (f: Partial<SchoolFilters>) => void;
  clearFilters: () => void;

  // Layer visibility
  layers: LayerVisibility;
  toggleLayer: (layer: keyof LayerVisibility) => void;

  // Selected items
  selectedSchool: School | null;
  setSelectedSchool: (s: School | null) => void;
  selectedHub: HubBrief | null;
  setSelectedHub: (h: HubBrief | null) => void;

  // Compare mode
  compareList: string[];  // facility_codes
  addToCompare: (code: string) => void;
  removeFromCompare: (code: string) => void;
  clearCompare: () => void;

  // Scenario
  scenario: ScenarioConfig;
  setScenario: (s: Partial<ScenarioConfig>) => void;

  // UI
  rightPanelOpen: boolean;
  setRightPanelOpen: (v: boolean) => void;
  heatmapField: string;  // which field drives heatmap
  setHeatmapField: (f: string) => void;
}

export const useAtlasStore = create<AtlasState>((set) => ({
  viewport: { longitude: 27.85, latitude: -13.1, zoom: 5.5 },  // Zambia center
  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),

  filters: {},
  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
  clearFilters: () => set({ filters: {} }),

  layers: {
    schools: true,
    hubs: true,
    midMile: false,
    links: true,
    heatmap: false,
    clusters: true,
  },
  toggleLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),

  selectedSchool: null,
  setSelectedSchool: (s) => set({ selectedSchool: s, rightPanelOpen: s !== null }),
  selectedHub: null,
  setSelectedHub: (h) => set({ selectedHub: h, rightPanelOpen: h !== null }),

  compareList: [],
  addToCompare: (code) =>
    set((s) => ({
      compareList: s.compareList.includes(code) || s.compareList.length >= 5
        ? s.compareList
        : [...s.compareList, code],
    })),
  removeFromCompare: (code) =>
    set((s) => ({ compareList: s.compareList.filter((c) => c !== code) })),
  clearCompare: () => set({ compareList: [] }),

  scenario: { satellite_opex_years: 5, power_opex_years: 5 },
  setScenario: (s) => set((st) => ({ scenario: { ...st.scenario, ...s } })),

  rightPanelOpen: false,
  setRightPanelOpen: (v) => set({ rightPanelOpen: v }),

  heatmapField: "total_cost",
  setHeatmapField: (f) => set({ heatmapField: f }),
}));
