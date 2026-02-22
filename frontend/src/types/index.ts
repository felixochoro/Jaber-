// ── School ────────────────────────────────────────────────────────────────────
export interface School {
  id: number;
  facility_code: string;
  name: string;
  facility_type?: string;
  province?: string;
  district?: string;
  constituency?: string;
  ward?: string;
  latitude?: number;
  longitude?: number;
  hub_name?: string;
  hub_dist_km?: number;
  hub_dist_m?: number;
  hub_id?: number;
  hub_match_type?: "exact" | "fuzzy" | "unmatched";
  population?: number;
  households?: number;
  transmission?: string;
  total_cost?: number;
  coord_valid?: boolean;
  hub_dist_anomaly?: boolean;
}

export interface CostBreakdown {
  fiber_cost?: number;
  microwave_cost?: number;
  satellite_hardware_cost?: number;
  satellite_opex_cost?: number;
  lan_cost?: number;
  power_cost?: number;
  power_opex?: number;
  zamtel_internet_lease?: number;
  managed_service_maint?: number;
  total_cost?: number;
  transmission?: string;
}

export interface ConnectivityRecommendation {
  recommended_option: string;
  reason: string;
  cheapest_option?: string;
  cheapest_cost?: number;
  hub_distance_assessment: string;
}

export interface SchoolDetail extends School {
  cost_breakdown?: CostBreakdown;
  hub?: HubBrief;
  link_distance_computed_m?: number;
  connectivity_recommendation?: ConnectivityRecommendation;
}

// ── Hub ───────────────────────────────────────────────────────────────────────
export interface HubBrief {
  id: number;
  hub_site_code?: string;
  site_name: string;
  site_owner?: string;
  latitude?: number;
  longitude?: number;
  province?: string;
  district?: string;
  aggregate_capacity_gbps?: number;
  total_links?: number;
  fiber_links?: number;
  microwave_links?: number;
  coord_valid?: boolean;
}

export interface HubDetail extends HubBrief {
  aggregate_capacity_mbps?: number;
  linked_school_count?: number;
  nearby_schools?: Partial<School>[];
  mid_mile_nodes?: MidMileNode[];
}

// ── Mid-mile ──────────────────────────────────────────────────────────────────
export interface MidMileNode {
  id: number;
  zesco_substation_id?: string;
  location?: string;
  district?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  hub_name?: string;
  hub_id?: number;
  los_distance_m?: number;
  routing_distance_m?: number;
  total_distance_m?: number;
  total_cost?: number;
  coord_valid?: boolean;
}

// ── API responses ─────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export interface ProvinceSummary {
  province?: string;
  school_count: number;
  schools_with_hub: number;
  within_1km: number;
  within_5km: number;
  within_10km: number;
  beyond_10km: number;
  invalid_coords: number;
  avg_hub_dist_km?: number;
  avg_total_cost?: number;
  total_population?: number;
  total_households?: number;
  district_count: number;
}

export interface AnalyticsSummary {
  total_schools: number;
  total_hubs: number;
  total_mid_mile_nodes: number;
  schools_with_valid_coords: number;
  schools_with_hub: number;
  schools_unmatched_hub: number;
  schools_beyond_10km: number;
  province_summaries: ProvinceSummary[];
  cost_percentiles?: { p25?: number; p50?: number; p75?: number; p90?: number; p99?: number };
  facility_type_counts: Record<string, number>;
  transmission_counts: Record<string, number>;
}

// ── Map layer state ───────────────────────────────────────────────────────────
export interface LayerVisibility {
  schools: boolean;
  hubs: boolean;
  midMile: boolean;
  links: boolean;
  heatmap: boolean;
  clusters: boolean;
}

// ── Map filters ────────────────────────────────────────────────────────────────
export interface SchoolFilters {
  q?: string;
  facility_type?: string;
  province?: string;
  district?: string;
  ward?: string;
  hub_dist_km_lte?: number;
  hub_dist_km_gte?: number;
  total_cost_lte?: number;
  population_gte?: number;
  transmission?: string;
  coord_valid?: boolean;
  hub_match_type?: string;
}

// ── Scenario ──────────────────────────────────────────────────────────────────
export interface ScenarioConfig {
  cost_per_meter_override?: number;
  satellite_opex_years: number;
  power_opex_years: number;
}
