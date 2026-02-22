"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";
import { fetchGaps, fetchAnalyticsSummary } from "@/lib/api";
import { fmt, fmtKm, fmtCurrency } from "@/lib/utils";

export default function DataQualityPage() {
  const [threshold, setThreshold] = useState(10);
  const [page, setPage] = useState(1);

  const { data: summary } = useSWR("analytics-summary", fetchAnalyticsSummary);
  const { data: gaps } = useSWR(
    ["gaps", threshold, page],
    () => fetchGaps({ hub_dist_km_gt: threshold, page, page_size: 50 })
  );

  const issueColor: Record<string, string> = {
    invalid_coord:      "text-red-600 bg-red-50",
    unmatched_hub:      "text-amber-600 bg-amber-50",
    beyond_threshold_km:"text-orange-600 bg-orange-50",
    ok:                 "text-green-600 bg-green-50",
  };

  const issueIcon: Record<string, React.ReactNode> = {
    invalid_coord:      <XCircle className="w-3.5 h-3.5" />,
    unmatched_hub:      <AlertTriangle className="w-3.5 h-3.5" />,
    beyond_threshold_km:<Info className="w-3.5 h-3.5" />,
    ok:                 <CheckCircle className="w-3.5 h-3.5" />,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle className="w-6 h-6 text-amber-500" />
        <h1 className="text-2xl font-bold text-gray-900">Data Quality</h1>
      </div>
      <p className="text-gray-500 mb-8">
        Inspect coordinate anomalies, unmatched hub references, and connectivity gaps.
      </p>

      {/* ── QA Summary cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Invalid Coordinates",
            value: summary
              ? (summary.total_schools - summary.schools_with_valid_coords)
              : "—",
            icon: XCircle,
            color: "text-red-600 bg-red-50",
          },
          {
            label: "Unmatched Hub Refs",
            value: fmt(summary?.schools_unmatched_hub),
            icon: AlertTriangle,
            color: "text-amber-600 bg-amber-50",
          },
          {
            label: "Beyond 10 km",
            value: fmt(summary?.schools_beyond_10km),
            icon: Info,
            color: "text-orange-600 bg-orange-50",
          },
          {
            label: "Schools OK",
            value: summary
              ? fmt(summary.total_schools - (summary.schools_unmatched_hub || 0) - (summary.schools_beyond_10km || 0))
              : "—",
            icon: CheckCircle,
            color: "text-green-600 bg-green-50",
          },
        ].map((card) => (
          <div key={card.label} className={`panel-card ${card.color}`}>
            <card.icon className="w-6 h-6 mb-2 opacity-70" />
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-sm mt-1 opacity-75">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ── Gap filter ─────────────────────────────────────────────────────── */}
      <div className="panel-card mb-6 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 flex-shrink-0">Hub distance threshold (km):</label>
        <input type="number" value={threshold} onChange={(e) => { setThreshold(Number(e.target.value)); setPage(1); }}
          min={0} step={1}
          className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none" />
        <span className="text-sm text-gray-500">
          Showing schools with distance &gt; {threshold} km, unmatched hubs, or invalid coordinates.
        </span>
      </div>

      {/* ── Gap table ──────────────────────────────────────────────────────── */}
      <div className="panel-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Connectivity Gaps ({fmt(gaps?.total)} schools)
          </h2>
          <a href={`/api/v1/export/schools.csv?hub_match_type=unmatched`}
            download
            className="text-xs text-blue-600 hover:underline">
            Export unmatched CSV
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-400">
                {["School", "Province", "District", "Hub Dist", "Total Cost", "Issue"].map((h) => (
                  <th key={h} className="py-2 pr-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gaps?.data.map((school: any) => (
                <tr key={school.id} className="border-b last:border-0 hover:bg-gray-50 text-xs">
                  <td className="py-2 pr-3">
                    <Link href={`/schools/${school.facility_code}`}
                      className="text-blue-600 hover:underline font-medium">
                      {school.name}
                    </Link>
                    <p className="text-gray-400 text-[10px]">{school.facility_code}</p>
                  </td>
                  <td className="py-2 pr-3 text-gray-500">{school.province || "—"}</td>
                  <td className="py-2 pr-3 text-gray-500">{school.district || "—"}</td>
                  <td className="py-2 pr-3">{fmtKm(school.hub_dist_km)}</td>
                  <td className="py-2 pr-3">{fmtCurrency(school.total_cost)}</td>
                  <td className="py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${issueColor[school.issue] || "bg-gray-100 text-gray-600"}`}>
                      {issueIcon[school.issue]}
                      {school.issue?.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {gaps && gaps.pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              ← Previous
            </button>
            <span className="text-sm text-gray-500">Page {page} of {gaps.pages}</span>
            <button onClick={() => setPage((p) => Math.min(gaps.pages, p + 1))}
              disabled={page === gaps.pages}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
