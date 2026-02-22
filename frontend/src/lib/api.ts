/**
 * API client for SchoolConnect Atlas backend.
 * All methods typed; base URL from env.
 */
import type {
  School, SchoolDetail, HubDetail, HubBrief,
  MidMileNode, AnalyticsSummary, PaginatedResponse, SchoolFilters,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function buildQS(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  return qs.toString() ? `?${qs.toString()}` : "";
}

// ── Schools ───────────────────────────────────────────────────────────────────
export function fetchSchools(
  filters: SchoolFilters & { page?: number; page_size?: number; sort_by?: string; sort_dir?: string }
): Promise<PaginatedResponse<School>> {
  return apiFetch(`/api/v1/schools${buildQS(filters as Record<string, unknown>)}`);
}

export function fetchSchool(facilityCode: string): Promise<SchoolDetail> {
  return apiFetch(`/api/v1/schools/${facilityCode}`);
}

export function compareSchools(codes: string[]): Promise<{ schools: SchoolDetail[]; count: number }> {
  return apiFetch("/api/v1/schools/compare", {
    method: "POST",
    body: JSON.stringify(codes),
  });
}

// ── Hubs ──────────────────────────────────────────────────────────────────────
export function fetchHubs(params: {
  q?: string; province?: string; district?: string;
  site_owner?: string; capacity_gbps_gte?: number;
  page?: number; page_size?: number; bbox?: string;
}): Promise<PaginatedResponse<HubBrief>> {
  return apiFetch(`/api/v1/hubs${buildQS(params as Record<string, unknown>)}`);
}

export function fetchHub(hubSiteCode: string): Promise<HubDetail> {
  return apiFetch(`/api/v1/hubs/${hubSiteCode}`);
}

// ── Mid-mile ──────────────────────────────────────────────────────────────────
export function fetchMidMile(params: {
  province?: string; district?: string; hub_name?: string;
  page?: number; page_size?: number; bbox?: string;
}): Promise<PaginatedResponse<MidMileNode>> {
  return apiFetch(`/api/v1/mid-mile${buildQS(params as Record<string, unknown>)}`);
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiFetch("/api/v1/analytics/summary");
}

export function fetchGaps(params: {
  hub_dist_km_gt?: number; province?: string; page?: number; page_size?: number;
}): Promise<PaginatedResponse<School & { issue: string }>> {
  return apiFetch(`/api/v1/analytics/gaps${buildQS(params as Record<string, unknown>)}`);
}

export function fetchDistrictBreakdown(province?: string): Promise<{ data: unknown[] }> {
  return apiFetch(`/api/v1/analytics/district${province ? `?province=${province}` : ""}`);
}

export function fetchCostDistribution(groupBy: string): Promise<{ data: unknown[]; grouped_by: string }> {
  return apiFetch(`/api/v1/analytics/cost-distribution?group_by=${groupBy}`);
}

export function fetchHubDemand(params?: {
  province?: string; page?: number;
}): Promise<PaginatedResponse<unknown>> {
  return apiFetch(`/api/v1/analytics/hubs/demand${buildQS((params || {}) as Record<string, unknown>)}`);
}

// ── Meta ──────────────────────────────────────────────────────────────────────
export function fetchMeta(): Promise<{
  provinces: string[];
  districts: string[];
  facility_types: string[];
  transmissions: string[];
  hub_site_owners: string[];
}> {
  return apiFetch("/api/v1/meta");
}

// ── Export ────────────────────────────────────────────────────────────────────
export function exportSchoolsUrl(filters: SchoolFilters): string {
  return `${BASE}/api/v1/export/schools.csv${buildQS(filters as Record<string, unknown>)}`;
}
