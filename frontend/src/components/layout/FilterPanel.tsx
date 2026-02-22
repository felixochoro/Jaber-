"use client";

import { useState, useEffect } from "react";
import { Search, X, SlidersHorizontal, Download } from "lucide-react";
import useSWR from "swr";
import { useAtlasStore } from "@/lib/store";
import { fetchMeta, fetchSchools, exportSchoolsUrl } from "@/lib/api";
import { fmt, fmtCurrency } from "@/lib/utils";
import type { School } from "@/types";

export function FilterPanel() {
  const { filters, setFilters, clearFilters } = useAtlasStore();
  const [localQ, setLocalQ] = useState(filters.q || "");
  const [results, setResults] = useState<School[]>([]);
  const [total, setTotal] = useState(0);
  const { setSelectedSchool, setRightPanelOpen } = useAtlasStore();

  const { data: meta } = useSWR("meta", fetchMeta);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters({ q: localQ || undefined });
    }, 300);
    return () => clearTimeout(t);
  }, [localQ]);

  // Fetch filtered school list
  const { data } = useSWR(
    ["schools", JSON.stringify(filters)],
    () => fetchSchools({ ...filters, page: 1, page_size: 50 })
  );

  useEffect(() => {
    if (data) {
      setResults(data.data);
      setTotal(data.total);
    }
  }, [data]);

  const exportUrl = exportSchoolsUrl(filters);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4" />
            Filter Schools
          </h2>
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            Clear all
          </button>
        </div>

        {/* Text search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Search name, code, district…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {localQ && (
            <button onClick={() => { setLocalQ(""); setFilters({ q: undefined }); }}
              className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-gray-100 flex flex-col gap-3 overflow-y-auto">
        {/* Province */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Province</label>
          <select
            value={filters.province || ""}
            onChange={(e) => setFilters({ province: e.target.value || undefined, district: undefined })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Provinces</option>
            {meta?.provinces.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>

        {/* District */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">District</label>
          <select
            value={filters.district || ""}
            onChange={(e) => setFilters({ district: e.target.value || undefined })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Districts</option>
            {meta?.districts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>

        {/* Facility type */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Facility Type</label>
          <select
            value={filters.facility_type || ""}
            onChange={(e) => setFilters({ facility_type: e.target.value || undefined })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {meta?.facility_types.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Transmission */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Transmission</label>
          <select
            value={filters.transmission || ""}
            onChange={(e) => setFilters({ transmission: e.target.value || undefined })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            {meta?.transmissions.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Hub distance */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Max Hub Distance (km)</label>
          <input
            type="number"
            min={0}
            step={1}
            value={filters.hub_dist_km_lte ?? ""}
            onChange={(e) => setFilters({ hub_dist_km_lte: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="e.g. 5"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Max total cost */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Max Total Cost ($)</label>
          <input
            type="number"
            min={0}
            step={1000}
            value={filters.total_cost_lte ?? ""}
            onChange={(e) => setFilters({ total_cost_lte: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="e.g. 50000"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Hub match type */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Hub Match Quality</label>
          <select
            value={filters.hub_match_type || ""}
            onChange={(e) => setFilters({ hub_match_type: e.target.value || undefined })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="exact">Exact match</option>
            <option value="fuzzy">Fuzzy match</option>
            <option value="unmatched">Unmatched</option>
          </select>
        </div>
      </div>

      {/* Results count + export */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">{fmt(total)} schools</span>
        <a
          href={exportUrl}
          download
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </a>
      </div>

      {/* School list */}
      <div className="flex-1 overflow-y-auto">
        {results.map((school) => (
          <button
            key={school.facility_code}
            onClick={() => { setSelectedSchool(school); setRightPanelOpen(true); }}
            className="w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-blue-50 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900 truncate">{school.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {[school.facility_type, school.district, school.province].filter(Boolean).join(" · ")}
            </p>
            {school.hub_dist_km != null && (
              <p className="text-xs text-blue-600 mt-0.5">
                {school.hub_dist_km.toFixed(1)} km to hub
                {school.total_cost ? ` · ${fmtCurrency(school.total_cost)}` : ""}
              </p>
            )}
          </button>
        ))}
        {results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No schools match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
