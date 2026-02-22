"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { FilterPanel } from "@/components/layout/FilterPanel";
import { DetailPanel } from "@/components/layout/DetailPanel";
import { LayerToggles } from "@/components/map/LayerToggles";
import { useAtlasStore } from "@/lib/store";
import { cn } from "@/lib/utils";

// Mapbox must be client-only
const AtlasMap = dynamic(() => import("@/components/map/AtlasMap"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
      Loading map…
    </div>
  ),
});

export default function MapPage() {
  const { rightPanelOpen } = useAtlasStore();

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left filter panel ─────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col shadow-sm z-10 overflow-hidden">
          <FilterPanel />
        </aside>

        {/* ── Map area ──────────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          <Suspense fallback={null}>
            <AtlasMap />
          </Suspense>
          {/* Layer toggles floats over the map */}
          <div className="absolute top-3 right-3 z-10">
            <LayerToggles />
          </div>
        </div>

        {/* ── Right detail panel ────────────────────────────────────────── */}
        <aside
          className={cn(
            "flex-shrink-0 bg-white border-l border-gray-100 flex flex-col shadow-sm z-10 overflow-hidden transition-all duration-300",
            rightPanelOpen ? "w-80" : "w-0"
          )}
        >
          {rightPanelOpen && <DetailPanel />}
        </aside>
      </div>
    </div>
  );
}
