from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime
from app.database import Base


class MidMileNode(Base):
    __tablename__ = "mid_mile_nodes"

    id                          = Column(Integer, primary_key=True, index=True)
    zesco_substation_id         = Column(String)
    location                    = Column(String)
    district                    = Column(String, index=True)
    province                    = Column(String, index=True)
    latitude                    = Column(Float)
    longitude                   = Column(Float)
    geom                        = Column(Geometry("POINT", srid=4326))
    hub_name                    = Column(String)
    hub_id                      = Column(Integer, ForeignKey("hubs.id"), index=True)
    los_distance_m              = Column(Float)
    routing_distance_m          = Column(Float)
    total_distance_m            = Column(Float)
    avg_cost_per_meter          = Column(Float)
    total_fiber_deployment_cost = Column(Float)
    active_dwdm_equipment_cost  = Column(Float)
    ip_aggregator_router_cost   = Column(Float)
    total_active_equipment_cost = Column(Float)
    avg_microwave_links_to_hub  = Column(Float)
    unit_cost_microwave_1g      = Column(Float)
    total_microwave_cost        = Column(Float)
    access_router_cost          = Column(Float)
    lease_fibercomm_per_month   = Column(Float)
    power_upgrade_per_hub       = Column(Float)
    total_cost                  = Column(Float)
    coord_valid                 = Column(Boolean)
    created_at                  = Column(DateTime, default=datetime.utcnow)
    updated_at                  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    hub = relationship("Hub", back_populates="mid_mile_nodes", foreign_keys=[hub_id])
    hub_midmile_links = relationship("HubMidmileLink", back_populates="midmile")
