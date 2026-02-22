from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ProvinceSummary(BaseModel):
    province: Optional[str]
    school_count: int
    schools_with_hub: int
    within_1km: int
    within_5km: int
    within_10km: int
    beyond_10km: int
    invalid_coords: int
    avg_hub_dist_km: Optional[float]
    avg_total_cost: Optional[float]
    total_population: Optional[int]
    total_households: Optional[int]
    district_count: int
    facility_type_count: int


class GapReport(BaseModel):
    school_id: int
    facility_code: str
    name: str
    province: Optional[str]
    district: Optional[str]
    hub_dist_km: Optional[float]
    total_cost: Optional[float]
    issue: str  # e.g. "beyond_10km", "unmatched_hub", "invalid_coord"


class CostPercentiles(BaseModel):
    p25: Optional[float]
    p50: Optional[float]
    p75: Optional[float]
    p90: Optional[float]
    p99: Optional[float]


class AnalyticsSummary(BaseModel):
    total_schools: int
    total_hubs: int
    total_mid_mile_nodes: int
    schools_with_valid_coords: int
    schools_with_hub: int
    schools_unmatched_hub: int
    schools_beyond_10km: int
    province_summaries: List[ProvinceSummary]
    cost_percentiles: Optional[CostPercentiles]
    facility_type_counts: Dict[str, int]
    transmission_counts: Dict[str, int]
