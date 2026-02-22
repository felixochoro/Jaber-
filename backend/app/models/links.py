from sqlalchemy import Column, Integer, String, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from app.database import Base


class SchoolHubLink(Base):
    __tablename__ = "school_hub_links"
    __table_args__ = (UniqueConstraint("school_id", "hub_id"),)

    id                  = Column(Integer, primary_key=True, index=True)
    school_id           = Column(Integer, ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    hub_id              = Column(Integer, ForeignKey("hubs.id", ondelete="CASCADE"), nullable=False)
    line_geom           = Column(Geometry("LINESTRING", srid=4326))
    distance_m_source   = Column(Float)
    distance_m_computed = Column(Float)
    match_type          = Column(String)

    school = relationship("School", back_populates="school_hub_links")
    hub    = relationship("Hub",    back_populates="school_hub_links")


class HubMidmileLink(Base):
    __tablename__ = "hub_midmile_links"
    __table_args__ = (UniqueConstraint("hub_id", "midmile_id"),)

    id                  = Column(Integer, primary_key=True, index=True)
    hub_id              = Column(Integer, ForeignKey("hubs.id", ondelete="CASCADE"), nullable=False)
    midmile_id          = Column(Integer, ForeignKey("mid_mile_nodes.id", ondelete="CASCADE"), nullable=False)
    line_geom           = Column(Geometry("LINESTRING", srid=4326))
    los_distance_m      = Column(Float)
    routing_distance_m  = Column(Float)
    total_distance_m    = Column(Float)
    total_cost          = Column(Float)

    hub     = relationship("Hub",         back_populates="hub_midmile_links")
    midmile = relationship("MidMileNode", back_populates="hub_midmile_links")
