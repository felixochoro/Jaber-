from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from datetime import datetime
from app.database import Base


class Hub(Base):
    __tablename__ = "hubs"

    id                      = Column(Integer, primary_key=True, index=True)
    hub_site_code           = Column(String, unique=True, index=True)
    site_name               = Column(String, nullable=False)
    site_owner              = Column(String)
    fiber_links             = Column(Integer)
    microwave_links         = Column(Integer)
    total_links             = Column(Integer)
    latitude                = Column(Float)
    longitude               = Column(Float)
    geom                    = Column(Geometry("POINT", srid=4326))
    district                = Column(String, index=True)
    province                = Column(String, index=True)
    aggregate_capacity_mbps = Column(Float)
    aggregate_capacity_gbps = Column(Float)
    coord_valid             = Column(Boolean)
    created_at              = Column(DateTime, default=datetime.utcnow)
    updated_at              = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schools = relationship("School", back_populates="hub", foreign_keys="School.hub_id")
    school_hub_links = relationship("SchoolHubLink", back_populates="hub")
    hub_midmile_links = relationship("HubMidmileLink", back_populates="hub")
    mid_mile_nodes = relationship("MidMileNode", back_populates="hub", foreign_keys="MidMileNode.hub_id")
