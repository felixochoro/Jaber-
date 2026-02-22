"use client";

import { use } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, MapPin, AlertTriangle, CheckCircle } from "lucide-react";
import { fetchSchool } from "@/lib/api";
import { fmtCurrency, fmtKm, fmt, distanceBand, facilityTypeColor } from "@/lib/utils";

export default function SchoolDetailPage({ params }: { params: Promise<{ facility_code: string }> }) {
  const { facility_code } = use(params);
  const { data: school, error } = useSWR(
    `school-detail-${facility_code}`,
    () => fetchSchool(facility_code)
  );

  if (error) return <ErrorView code={facility_code} />;
  if (!school) return <LoadingView />;

  const band = distanceBand(school.hub_dist_km);
  const rec  = school.connectivity_recommendation;
  const cb   = school.cost_breakdown;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-blue-600">Home</Link>
        <span>/</span>
        <Link href="/map" className="hover:text-blue-600">Map</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{school.name}</span>
      </div>

      {/* Header card */}
      <div className="panel-card mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: facilityTypeColor(school.facility_type) }}>
            {school.name[0]}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
            <p className="text-gray-500">{school.facility_type} · {school.facility_code}</p>
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {[school.ward, school.constituency, school.district, school.province].filter(Boolean).join(", ")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {school.coord_valid ? (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" /> Valid coords
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" /> Invalid coords
              </span>
            )}
            {school.hub_dist_anomaly && (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3" /> Distance anomaly
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Location */}
        <div className="panel-card">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Location</h2>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["Province", school.province],
              ["District", school.district],
              ["Constituency", school.constituency],
              ["Ward", school.ward],
              ["Latitude", school.latitude?.toFixed(6)],
              ["Longitude", school.longitude?.toFixed(6)],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dt className="text-xs text-gray-400">{k}</dt>
                <dd className="text-sm font-medium text-gray-800">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Hub proximity */}
        <div className="panel-card">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Hub Proximity</h2>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold px-3 py-1 rounded-full text-white"
              style={{ background: band.color }}>
              {band.label}
            </span>
            <span className="text-sm text-gray-500">{school.hub_match_type} match</span>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div><dt className="text-xs text-gray-400">Hub Name</dt><dd className="text-sm font-medium">{school.hub_name || "—"}</dd></div>
            <div><dt className="text-xs text-gray-400">Distance</dt><dd className="text-sm font-medium">{fmtKm(school.hub_dist_km)}</dd></div>
          </dl>
          {school.hub && (
            <div className="mt-3 p-3 bg-purple-50 rounded-lg">
              <p className="text-xs font-semibold text-purple-700 mb-1">Linked Hub</p>
              <Link href={`/hubs/${school.hub.hub_site_code}`}
                className="text-sm font-medium text-purple-800 hover:underline">
                {school.hub.site_name}
              </Link>
              <p className="text-xs text-purple-600">{school.hub.site_owner} · {school.hub.aggregate_capacity_gbps?.toFixed(2)} Gbps</p>
            </div>
          )}
        </div>

        {/* Demand */}
        <div className="panel-card">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Demand</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <p className="text-2xl font-bold text-blue-800">{fmt(school.population)}</p>
              <p className="text-xs text-blue-600">Population</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-800">{fmt(school.households)}</p>
              <p className="text-xs text-green-600">Households</p>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        {rec && (
          <div className="panel-card">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Connectivity Recommendation</h2>
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-lg font-bold text-blue-900 mb-1">{rec.recommended_option}</p>
              <p className="text-sm text-blue-700 mb-2">{rec.reason}</p>
              <p className="text-xs text-blue-500 italic">{rec.hub_distance_assessment}</p>
              {rec.cheapest_option && (
                <div className="mt-3 pt-3 border-t border-blue-100 flex justify-between text-sm">
                  <span className="text-blue-600">Cheapest option: {rec.cheapest_option}</span>
                  <span className="font-semibold text-blue-800">{fmtCurrency(rec.cheapest_cost)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cost breakdown */}
      {cb && (
        <div className="panel-card mt-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Cost Breakdown</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "Fiber",                value: cb.fiber_cost,               icon: "🔌" },
              { label: "Microwave",            value: cb.microwave_cost,           icon: "📡" },
              { label: "Satellite Hardware",   value: cb.satellite_hardware_cost,  icon: "🛰️" },
              { label: "Satellite OPEX",       value: cb.satellite_opex_cost,      icon: "🔄" },
              { label: "LAN",                  value: cb.lan_cost,                 icon: "🌐" },
              { label: "Power",                value: cb.power_cost,               icon: "⚡" },
              { label: "Power OPEX",           value: cb.power_opex,               icon: "🔋" },
              { label: "Zamtel Internet Lease",value: cb.zamtel_internet_lease,    icon: "📶" },
              { label: "Managed Service",      value: cb.managed_service_maint,    icon: "🛠️" },
            ].filter((r) => r.value != null).map(({ label, value, icon }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                <span className="text-lg">{icon}</span>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-semibold text-gray-900">{fmtCurrency(value)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <span className="text-base font-semibold text-gray-700">Total Cost</span>
            <span className="text-2xl font-bold text-gray-900">{fmtCurrency(cb.total_cost)}</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link href="/map" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back to Map
        </Link>
        <Link href={`/map?q=${encodeURIComponent(school.name)}`}
          className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <MapPin className="w-4 h-4" /> View on Map
        </Link>
      </div>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function ErrorView({ code }: { code: string }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 text-center">
      <p className="text-red-600 mb-4">School '{code}' not found.</p>
      <Link href="/map" className="text-blue-600 hover:underline">← Back to Map</Link>
    </div>
  );
}
