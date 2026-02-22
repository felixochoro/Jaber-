"use client";

import { use } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, MapPin, Wifi, BarChart3 } from "lucide-react";
import { fetchHub } from "@/lib/api";
import { fmt, fmtKm, fmtCurrency, ownerColor } from "@/lib/utils";

export default function HubDetailPage({ params }: { params: Promise<{ hub_site_code: string }> }) {
  const { hub_site_code } = use(params);
  const { data: hub, error } = useSWR(`hub-detail-${hub_site_code}`, () => fetchHub(hub_site_code));

  if (error) return <div className="p-8 text-center text-red-600">Hub not found. <Link href="/map" className="underline">Back</Link></div>;
  if (!hub)  return <div className="p-8 text-center text-gray-400 animate-pulse">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-600">Home</Link>
        <span>/</span>
        <Link href="/map" className="hover:text-blue-600">Map</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{hub.site_name}</span>
      </div>

      {/* Header */}
      <div className="panel-card mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: ownerColor(hub.site_owner) }}>
            <Wifi className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{hub.site_name}</h1>
            <p className="text-gray-500">{hub.site_owner} · {hub.hub_site_code}</p>
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {[hub.district, hub.province].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-purple-700">{hub.aggregate_capacity_gbps?.toFixed(2)}</p>
            <p className="text-sm text-gray-400">Gbps Capacity</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="panel-card text-center">
          <p className="text-3xl font-bold text-gray-900">{fmt((hub as any).linked_school_count)}</p>
          <p className="text-sm text-gray-500">Linked Schools</p>
        </div>
        <div className="panel-card text-center">
          <p className="text-3xl font-bold text-gray-900">{hub.fiber_links ?? "—"}</p>
          <p className="text-sm text-gray-500">Fiber Links</p>
        </div>
        <div className="panel-card text-center">
          <p className="text-3xl font-bold text-gray-900">{hub.microwave_links ?? "—"}</p>
          <p className="text-sm text-gray-500">Microwave Links</p>
        </div>
      </div>

      {/* Nearby schools */}
      {(hub as any).nearby_schools?.length > 0 && (
        <div className="panel-card mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Linked Schools</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-400 text-xs">
                  <th className="py-2 pr-4 font-medium">School</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium text-right">Distance</th>
                  <th className="py-2 font-medium text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {(hub as any).nearby_schools.map((s: any) => (
                  <tr key={s.facility_code} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 pr-4">
                      <Link href={`/schools/${s.facility_code}`} className="text-blue-600 hover:underline font-medium">
                        {s.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{s.facility_type}</td>
                    <td className="py-2 pr-4 text-right">{fmtKm(s.hub_dist_km)}</td>
                    <td className="py-2 text-right">{fmtCurrency(s.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mid-mile nodes */}
      {(hub as any).mid_mile_nodes?.length > 0 && (
        <div className="panel-card">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Mid-mile Nodes</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {(hub as any).mid_mile_nodes.map((m: any) => (
              <div key={m.id} className="bg-amber-50 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-900">{m.location || "Unknown"}</p>
                <p className="text-xs text-amber-600">{m.district}</p>
                <p className="text-xs text-amber-700 mt-1">{fmtKm(m.total_distance_m ? m.total_distance_m / 1000 : null)} · {fmtCurrency(m.total_cost)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link href="/map" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to Map
        </Link>
      </div>
    </div>
  );
}
