"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  fetchAnalyticsSummary, fetchCostDistribution, fetchHubDemand, fetchDistrictBreakdown,
} from "@/lib/api";
import { fmt, fmtCurrency } from "@/lib/utils";

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#14b8a6", "#f97316", "#ec4899"];

export default function DashboardsPage() {
  const [groupBy, setGroupBy] = useState("province");

  const { data: summary } = useSWR("analytics-summary", fetchAnalyticsSummary);
  const { data: costDist } = useSWR(
    ["cost-dist", groupBy],
    () => fetchCostDistribution(groupBy)
  );
  const { data: hubDemand } = useSWR("hub-demand", () => fetchHubDemand({ page: 1 }));

  const facilityPieData = Object.entries(summary?.facility_type_counts || {})
    .map(([name, value]) => ({ name, value }))
    .slice(0, 8);

  const transmissionPieData = Object.entries(summary?.transmission_counts || {})
    .map(([name, value]) => ({ name, value }))
    .slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
      <p className="text-gray-500 mb-8">Platform-wide statistics on school connectivity across Zambia.</p>

      {/* ── Top stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Schools",       value: fmt(summary?.total_schools),         color: "bg-blue-50 text-blue-700" },
          { label: "Total Hubs",          value: fmt(summary?.total_hubs),            color: "bg-purple-50 text-purple-700" },
          { label: "Schools with Hub",    value: fmt(summary?.schools_with_hub),      color: "bg-green-50 text-green-700" },
          { label: "Beyond 10 km",        value: fmt(summary?.schools_beyond_10km),   color: "bg-red-50 text-red-700" },
          { label: "Unmatched Hubs",      value: fmt(summary?.schools_unmatched_hub), color: "bg-amber-50 text-amber-700" },
          { label: "Mid-mile Nodes",      value: fmt(summary?.total_mid_mile_nodes),  color: "bg-teal-50 text-teal-700" },
          { label: "Median Cost",         value: fmtCurrency(summary?.cost_percentiles?.p50), color: "bg-gray-50 text-gray-700" },
          { label: "P90 Cost",            value: fmtCurrency(summary?.cost_percentiles?.p90), color: "bg-orange-50 text-orange-700" },
        ].map((s) => (
          <div key={s.label} className={`panel-card ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm mt-1 opacity-75">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* ── Province bar chart ──────────────────────────────────────────── */}
        <div className="panel-card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Schools by Province</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={summary?.province_summaries.slice(0, 10)} margin={{ top: 0, right: 10, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="province" angle={-40} textAnchor="end" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => fmt(v as number)} />
              <Bar dataKey="school_count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Schools" />
              <Bar dataKey="schools_with_hub" fill="#22c55e" radius={[4, 4, 0, 0]} name="With Hub" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Facility type pie ───────────────────────────────────────────── */}
        <div className="panel-card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Facility Types</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={facilityPieData} cx="50%" cy="50%" outerRadius={90}
                dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}>
                {facilityPieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v as number)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* ── Cost distribution ───────────────────────────────────────────── */}
        <div className="panel-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Cost Distribution</h2>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1">
              <option value="province">By Province</option>
              <option value="facility_type">By Type</option>
              <option value="transmission">By Transmission</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={(costDist?.data as any[])?.slice(0, 12)}
              margin={{ top: 0, right: 10, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" angle={-35} textAnchor="end" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => fmtCurrency(v as number)} />
              <Bar dataKey="avg_cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Avg Cost" />
              <Bar dataKey="median_cost" fill="#c4b5fd" radius={[4, 4, 0, 0]} name="Median Cost" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Transmission mix ────────────────────────────────────────────── */}
        <div className="panel-card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Transmission Mix</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={transmissionPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90}
                dataKey="value" nameKey="name">
                {transmissionPieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v as number)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Province summary table ──────────────────────────────────────────── */}
      {summary?.province_summaries && (
        <div className="panel-card mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Province Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-400">
                  {["Province", "Schools", "With Hub", "≤1km", "≤5km", "≤10km", ">10km", "Invalid", "Avg Dist", "Avg Cost", "Population"].map((h) => (
                    <th key={h} className="py-2 pr-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.province_summaries.map((p) => (
                  <tr key={p.province} className="border-b last:border-0 hover:bg-gray-50 text-xs">
                    <td className="py-2 pr-3 font-medium">{p.province || "Unknown"}</td>
                    <td className="py-2 pr-3">{fmt(p.school_count)}</td>
                    <td className="py-2 pr-3 text-green-600">{fmt(p.schools_with_hub)}</td>
                    <td className="py-2 pr-3">{fmt(p.within_1km)}</td>
                    <td className="py-2 pr-3">{fmt(p.within_5km)}</td>
                    <td className="py-2 pr-3">{fmt(p.within_10km)}</td>
                    <td className="py-2 pr-3 text-red-500">{fmt(p.beyond_10km)}</td>
                    <td className="py-2 pr-3 text-amber-500">{fmt(p.invalid_coords)}</td>
                    <td className="py-2 pr-3">{p.avg_hub_dist_km?.toFixed(1)} km</td>
                    <td className="py-2 pr-3">{fmtCurrency(p.avg_total_cost)}</td>
                    <td className="py-2">{fmt(p.total_population)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Hub demand table ────────────────────────────────────────────────── */}
      {(hubDemand?.data as any[])?.length > 0 && (
        <div className="panel-card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top Hubs by Linked Schools</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-400">
                  {["Hub", "Province", "Schools", "Population", "Avg Dist", "Capacity (Gbps)"].map((h) => (
                    <th key={h} className="py-2 pr-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(hubDemand.data as any[]).slice(0, 15).map((h: any) => (
                  <tr key={h.hub_id} className="border-b last:border-0 hover:bg-gray-50 text-xs">
                    <td className="py-2 pr-3 font-medium text-purple-700">{h.site_name}</td>
                    <td className="py-2 pr-3 text-gray-500">{h.province}</td>
                    <td className="py-2 pr-3">{fmt(h.linked_schools)}</td>
                    <td className="py-2 pr-3">{fmt(h.total_population)}</td>
                    <td className="py-2 pr-3">{h.avg_dist_km?.toFixed(1)} km</td>
                    <td className="py-2">{h.aggregate_capacity_gbps?.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
