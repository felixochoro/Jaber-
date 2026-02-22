"use client";

import { useAtlasStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";
import { useState } from "react";

const LAYERS = [
  { key: "schools"  as const, label: "Schools",    color: "#3b82f6" },
  { key: "hubs"     as const, label: "Hubs",        color: "#8b5cf6" },
  { key: "midMile"  as const, label: "Mid-mile",    color: "#f59e0b" },
  { key: "links"    as const, label: "Links",       color: "#94a3b8" },
  { key: "heatmap"  as const, label: "Heatmap",     color: "#ef4444" },
  { key: "clusters" as const, label: "Clustering",  color: "#22c55e" },
];

export function LayerToggles() {
  const { layers, toggleLayer, heatmapField, setHeatmapField } = useAtlasStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-white shadow-md border border-gray-200 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <Layers className="w-4 h-4" />
        Layers
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Layers</p>
          {LAYERS.map(({ key, label, color }) => (
            <label key={key}
              className="flex items-center gap-3 py-1.5 cursor-pointer group">
              <div
                className={cn(
                  "w-8 h-4 rounded-full relative transition-colors",
                  layers[key] ? "bg-blue-600" : "bg-gray-200"
                )}
                onClick={() => toggleLayer(key)}
              >
                <div className={cn(
                  "absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform",
                  layers[key] ? "translate-x-4" : "translate-x-0.5"
                )} />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-sm text-gray-700">{label}</span>
              </div>
            </label>
          ))}

          {layers.heatmap && (
            <div className="mt-3 border-t pt-3">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Heatmap field</p>
              <select
                value={heatmapField}
                onChange={(e) => setHeatmapField(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              >
                <option value="total_cost">Total Cost</option>
                <option value="hub_dist_km">Hub Distance</option>
                <option value="population">Population</option>
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
