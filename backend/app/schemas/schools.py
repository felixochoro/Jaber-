from pydantic import BaseModel, computed_field
from typing import Optional, List


class CostBreakdown(BaseModel):
    fiber_cost: Optional[float] = None
    microwave_cost: Optional[float] = None
    satellite_hardware_cost: Optional[float] = None
    satellite_opex_cost: Optional[float] = None
    lan_cost: Optional[float] = None
    power_cost: Optional[float] = None
    power_opex: Optional[float] = None
    zamtel_internet_lease: Optional[float] = None
    managed_service_maint: Optional[float] = None
    total_cost: Optional[float] = None
    transmission: Optional[str] = None


class ConnectivityRecommendation(BaseModel):
    recommended_option: str
    reason: str
    cheapest_option: Optional[str] = None
    cheapest_cost: Optional[float] = None
    hub_distance_assessment: str


class SchoolBrief(BaseModel):
    id: int
    facility_code: str
    name: str
    facility_type: Optional[str]
    province: Optional[str]
    district: Optional[str]
    constituency: Optional[str]
    ward: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    hub_name: Optional[str]
    hub_dist_km: Optional[float]
    hub_id: Optional[int]
    hub_match_type: Optional[str]
    population: Optional[int]
    households: Optional[int]
    transmission: Optional[str]
    total_cost: Optional[float]
    coord_valid: Optional[bool]
    hub_dist_anomaly: Optional[bool]

    model_config = {"from_attributes": True}


class SchoolDetail(SchoolBrief):
    hub_dist_m: Optional[float]
    cost_breakdown: Optional[CostBreakdown] = None
    hub: Optional[dict] = None
    link_distance_computed_m: Optional[float] = None
    connectivity_recommendation: Optional[ConnectivityRecommendation] = None


class SchoolList(BaseModel):
    data: List[SchoolBrief]
    total: int
    page: int
    page_size: int
    pages: int
