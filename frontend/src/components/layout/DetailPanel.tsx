"use client";

import { X, ExternalLink, AlertTriangle, CheckCircle, Info } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { useAtlasStore } from "@/lib/store";
import { fetchSchool, fetchHub } from "@/lib/api";
import { fmtCurrency, fmtKm, fmt, distanceBand, facilityTypeColor } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function DetailPanel() {
  const {
    selectedSchool, selectedHub,
    setSelectedSchool, setSelectedHub, setRightPanelOpen,
    addToCompare, compareList,
  } = useAtlasStore();

  const { data: schoolDetail } = useSWR(
    selectedSchool ? `school-${selectedSchool.facility_code}` : null,
    () => fetchSchool(selectedSchool!.facility_code)
  );

  const { data: hubDetail } = useSWR(
    selectedHub ? `hub-${selectedHub.hub_site_code}` : null,
    () => fetchHub(selectedHub!.hub_site_code!)
  );

  const handleClose = () => {
    setSelectedSchool(null);
    setSelectedHub(null);
    setRightPanelOpen(false);
  };

  if (selectedSchool) {
    const d = schoolDetail || selectedSchool;
    const band = distanceBand(d.hub_dist_km);
    const rec = schoolDetail?.connectivity_recommendation;
    const cb  = schoolDetail?.cost_breakdown;

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-start gap-2">
          <div
            className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
            style={{ background: facilityTypeColor(d.facility_type) }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{d.name}</p>
            <p className="text-xs text-gray-500">{d.facility_type} · {d.facility_code}</p>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Admin hierarchy */}
          <Section title="Location">
            <Grid2>
              <Kv label="Province" value={d.province} />
              <Kv label="District" value={d.district} />
              <Kv label="Constituency" value={d.constituency} />
              <Kv label="Ward" value={d.ward} />
              <Kv label="Latitude" value={d.latitude?.toFixed(6)} />
              <Kv label="Longitude" value={d.longitude?.toFixed(6)} />
            </Grid2>
          </Section>

          {/* Hub distance */}
          <Section title="Hub Proximity">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                style={{ background: band.color }}>
                {band.label}
              </span>
              {d.hub_dist_anomaly && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Distance anomaly
                </span>
              )}
            </div>
            <Grid2>
              <Kv label="Hub Name" value={d.hub_name} />
              <Kv label="Match Type" value={d.hub_match_type} />
              <Kv label="Distance" value={fmtKm(d.hub_dist_km)} />
              <Kv label="Distance (m)" value={d.hub_dist_m?.toFixed(0)} />
            </Grid2>
          </Section>

          {/* Connectivity recommendation */}
          {rec && (
            <Section title="Connectivity Recommendation">
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <p className="font-semibold text-blue-900 mb-1">{rec.recommended_option}</p>
                <p className="text-blue-700 text-xs mb-2">{rec.reason}</p>
                <p className="text-xs text-blue-600 italic">{rec.hub_distance_assessment}</p>
              </div>
            </Section>
          )}

          {/* Cost breakdown */}
          {cb && (
            <Section title="Cost Breakdown">
              <div className="flex flex-col gap-1.5">
                {[
                  { label: "Fiber", value: cb.fiber_cost },
                  { label: "Microwave", value: cb.microwave_cost },
                  { label: "Satellite Hardware", value: cb.satellite_hardware_cost },
                  { label: "Satellite OPEX", value: cb.satellite_opex_cost },
                  { label: "LAN", value: cb.lan_cost },
                  { label: "Power", value: cb.power_cost },
                  { label: "Power OPEX", value: cb.power_opex },
                  { label: "Zamtel Internet", value: cb.zamtel_internet_lease },
                  { label: "Managed Service", value: cb.managed_service_maint },
                ].filter((r) => r.value != null).map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-mono text-gray-900">{fmtCurrency(value)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold border-t pt-1.5 mt-1">
                  <span>Total</span>
                  <span>{fmtCurrency(cb.total_cost)}</span>
                </div>
              </div>
            </Section>
          )}

          {/* Demand */}
          <Section title="Demand">
            <Grid2>
              <Kv label="Population" value={fmt(d.population)} />
              <Kv label="Households" value={fmt(d.households)} />
            </Grid2>
          </Section>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-100 flex gap-2">
          <Link href={`/schools/${d.facility_code}`}
            className="flex-1 text-center text-xs font-medium py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1">
            Full Detail <ExternalLink className="w-3 h-3" />
          </Link>
          {!compareList.includes(d.facility_code) && compareList.length < 5 ? (
            <button onClick={() => addToCompare(d.facility_code)}
              className="px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
              + Compare
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (selectedHub) {
    const h = hubDetail || selectedHub;
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-100 flex items-start gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500 mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{h.site_name}</p>
            <p className="text-xs text-gray-500">Hub · {h.hub_site_code}</p>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <Section title="Hub Info">
            <Grid2>
              <Kv label="Owner" value={h.site_owner} />
              <Kv label="Province" value={h.province} />
              <Kv label="District" value={h.district} />
              <Kv label="Capacity (Gbps)" value={h.aggregate_capacity_gbps?.toFixed(2)} />
              <Kv label="Fiber Links" value={h.fiber_links} />
              <Kv label="Microwave Links" value={h.microwave_links} />
              <Kv label="Total Links" value={h.total_links} />
              <Kv label="Linked Schools" value={(hubDetail as any)?.linked_school_count} />
            </Grid2>
          </Section>

          {(hubDetail as any)?.nearby_schools?.length > 0 && (
            <Section title="Nearby Schools">
              {(hubDetail as any).nearby_schools.slice(0, 5).map((s: any) => (
                <button key={s.facility_code}
                  onClick={() => setSelectedSchool(s)}
                  className="w-full text-left text-xs py-1.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-gray-400 ml-2">{fmtKm(s.hub_dist_km)}</span>
                </button>
              ))}
            </Section>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          {h.hub_site_code && (
            <Link href={`/hubs/${h.hub_site_code}`}
              className="block w-full text-center text-xs font-medium py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Full Hub Detail
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4 text-center">
      <div>
        <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Click a school or hub on the map to see details
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>;
}

function Kv({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-xs font-medium text-gray-800 truncate">{value ?? "—"}</p>
    </div>
  );
}
