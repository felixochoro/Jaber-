"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Wifi, BarChart3, ArrowRight, School, Radio, Zap } from "lucide-react";
import useSWR from "swr";
import { fetchAnalyticsSummary } from "@/lib/api";
import { fmt, fmtCurrency } from "@/lib/utils";

export default function LandingPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: summary } = useSWR("analytics-summary", fetchAnalyticsSummary);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/map?q=${encodeURIComponent(query)}`);
    } else {
      router.push("/map");
    }
  };

  const stats = [
    {
      label: "Schools Mapped",
      value: fmt(summary?.total_schools),
      icon: School,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Hub Sites",
      value: fmt(summary?.total_hubs),
      icon: Radio,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Schools with Hub",
      value: summary?.total_schools
        ? `${Math.round((summary.schools_with_hub / summary.total_schools) * 100)}%`
        : "—",
      icon: Wifi,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Avg Connectivity Cost",
      value: fmtCurrency(summary?.cost_percentiles?.p50),
      icon: Zap,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 text-sm mb-6">
            <MapPin className="w-4 h-4" />
            <span>Zambia School Connectivity Atlas</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 tracking-tight">
            Map Every School.<br />
            <span className="text-blue-300">Connect Every Student.</span>
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">
            Explore telecom infrastructure, connectivity options, and cost data for
            {summary ? ` ${fmt(summary.total_schools)}` : " thousands of"} schools across Zambia.
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="relative flex bg-white rounded-[var(--radius-btn)] shadow-2xl overflow-hidden">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by school name, code, district, province…"
                className="flex-1 pl-12 pr-4 py-4 text-gray-900 text-base outline-none placeholder:text-gray-400"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 font-semibold transition-colors"
              >
                Search
              </button>
            </div>
            <p className="text-sm text-blue-200 mt-3">
              Or{" "}
              <Link href="/map" className="underline underline-offset-2 hover:text-white">
                open the full map explorer
              </Link>
            </p>
          </form>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-4">
              <div className={`${s.bg} ${s.color} p-3 rounded-xl`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-8">
        {[
          {
            icon: MapPin,
            title: "Interactive Map Atlas",
            desc: "Search and filter schools across Zambia. Visualize hub distances, connectivity lines, and mid-mile infrastructure on a high-detail map.",
            href: "/map",
            cta: "Open Map",
          },
          {
            icon: BarChart3,
            title: "Analytics Dashboard",
            desc: "Province and district-level statistics, cost distributions, hub capacity demand ranking, and connectivity gap analysis.",
            href: "/dashboards",
            cta: "View Dashboard",
          },
          {
            icon: Wifi,
            title: "Connectivity Intelligence",
            desc: "Per-school connectivity recommendations comparing fiber, microwave, and satellite options with transparent cost breakdowns.",
            href: "/map",
            cta: "Explore Schools",
          },
        ].map((f) => (
          <div key={f.title} className="panel-card flex flex-col gap-4 hover:shadow-md transition-shadow">
            <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center">
              <f.icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
            <p className="text-sm text-gray-500 flex-1">{f.desc}</p>
            <Link href={f.href} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800">
              {f.cta} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </section>

      {/* ── Province summary table ────────────────────────────────────────── */}
      {summary && summary.province_summaries.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="panel-card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Coverage by Province</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4 font-medium">Province</th>
                    <th className="py-2 pr-4 font-medium text-right">Schools</th>
                    <th className="py-2 pr-4 font-medium text-right">With Hub</th>
                    <th className="py-2 pr-4 font-medium text-right">≤5 km</th>
                    <th className="py-2 pr-4 font-medium text-right">&gt;10 km</th>
                    <th className="py-2 font-medium text-right">Avg Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.province_summaries.slice(0, 10).map((p) => (
                    <tr key={p.province} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2 pr-4 font-medium">
                        <Link href={`/map?province=${encodeURIComponent(p.province || "")}`}
                          className="text-blue-600 hover:underline">
                          {p.province || "Unknown"}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-right">{fmt(p.school_count)}</td>
                      <td className="py-2 pr-4 text-right">{fmt(p.schools_with_hub)}</td>
                      <td className="py-2 pr-4 text-right">{fmt(p.within_5km)}</td>
                      <td className="py-2 pr-4 text-right text-red-500">{fmt(p.beyond_10km)}</td>
                      <td className="py-2 text-right">{fmtCurrency(p.avg_total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <Link href="/dashboards" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                Full analytics <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
