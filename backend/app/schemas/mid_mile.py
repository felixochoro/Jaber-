from pydantic import BaseModel
from typing import Optional


class MidMileNodeOut(BaseModel):
    id: int
    zesco_substation_id: Optional[str]
    location: Optional[str]
    district: Optional[str]
    province: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    hub_name: Optional[str]
    hub_id: Optional[int]
    los_distance_m: Optional[float]
    routing_distance_m: Optional[float]
    total_distance_m: Optional[float]
    total_cost: Optional[float]
    coord_valid: Optional[bool]

    model_config = {"from_attributes": True}
