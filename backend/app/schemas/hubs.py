from pydantic import BaseModel
from typing import Optional, List


class HubBrief(BaseModel):
    id: int
    hub_site_code: Optional[str]
    site_name: str
    site_owner: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    province: Optional[str]
    district: Optional[str]
    aggregate_capacity_gbps: Optional[float]
    total_links: Optional[int]
    fiber_links: Optional[int]
    microwave_links: Optional[int]
    coord_valid: Optional[bool]

    model_config = {"from_attributes": True}


class HubDetail(HubBrief):
    aggregate_capacity_mbps: Optional[float]
    linked_school_count: Optional[int] = None
    nearby_schools: Optional[List[dict]] = None
    mid_mile_nodes: Optional[List[dict]] = None
