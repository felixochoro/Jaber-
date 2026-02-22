from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime
from app.database import Base


class School(Base):
    __tablename__ = "schools"

    id                      = Column(Integer, primary_key=True, index=True)
    facility_code           = Column(String, unique=True, nullable=False, index=True)
    name                    = Column(String, nullable=False)
    facility_type           = Column(String, index=True)
    province                = Column(String, index=True)
    district                = Column(String, index=True)
    constituency            = Column(String, index=True)
    ward                    = Column(String, index=True)
    latitude                = Column(Float)
    longitude               = Column(Float)
    geom                    = Column(Geometry("POINT", srid=4326))
    hub_name                = Column(String, index=True)
    hub_dist_km             = Column(Float, index=True)
    hub_dist_m              = Column(Float)
    hub_id                  = Column(Integer, ForeignKey("hubs.id"), index=True)
    hub_match_type          = Column(String)
    population              = Column(Integer)
    households              = Column(Integer)
    transmission            = Column(String, index=True)
    fiber_cost              = Column(Float)
    microwave_cost          = Column(Float)
    satellite_hardware_cost = Column(Float)
    satellite_opex_cost     = Column(Float)
    lan_cost                = Column(Float)
    power_cost              = Column(Float)
    power_opex              = Column(Float)
    zamtel_internet_lease   = Column(Float)
    managed_service_maint   = Column(Float)
    total_cost              = Column(Float, index=True)
    coord_valid             = Column(Boolean)
    hub_dist_anomaly        = Column(Boolean, default=False)
    created_at              = Column(DateTime, default=datetime.utcnow)
    updated_at              = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    hub = relationship("Hub", back_populates="schools", foreign_keys=[hub_id])
    school_hub_links = relationship("SchoolHubLink", back_populates="school")
