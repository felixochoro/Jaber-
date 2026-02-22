"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
  Source, Layer, Popup, NavigationControl,
  ScaleControl, FullscreenControl,
  type MapRef, type MapLayerMouseEvent,
} from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import useSWR from "swr";
import { fetchSchools, fetchHubs, fetchMidMile } from "@/lib/api";
import { useAtlasStore } from "@/lib/store";
import { facilityTypeColor, ownerColor, fmtKm, fmtCurrency } from "@/lib/utils";
import type { School, HubBrief, MidMileNode } from "@/types";
import { activeTheme } from "@theme/config";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const ZAMBIA_CENTER: [number, number] = [27.85, -13.1];

function schoolsToGeoJSON(schools: School[]) {
  return {
    type: "FeatureCollection" as const,
    features: schools
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.longitude!, s.latitude!] },
        properties: {
          id: s.id,
          facility_code: s.facility_code,
          name: s.name,
          facility_type: s.facility_type,
          hub_dist_km: s.hub_dist_km,
          total_cost: s.total_cost,
          population: s.population,
          color: facilityTypeColor(s.facility_type),
          hub_id: s.hub_id,
          hub_lat: null,
          hub_lon: null,
        },
      })),
  };
}

function hubsToGeoJSON(hubs: HubBrief[]) {
  return {
    type: "FeatureCollection" as const,
    features: hubs
      .filter((h) => h.latitude && h.longitude)
      .map((h) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [h.longitude!, h.latitude!] },
        properties: {
          id: h.id,
          hub_site_code: h.hub_site_code,
          site_name: h.site_name,
          site_owner: h.site_owner,
          capacity: h.aggregate_capacity_gbps,
          color: ownerColor(h.site_owner),
        },
      })),
  };
}

function midMileToGeoJSON(nodes: MidMileNode[]) {
  return {
    type: "FeatureCollection" as const,
    features: nodes
      .filter((n) => n.latitude && n.longitude)
      .map((n) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [n.longitude!, n.latitude!] },
        properties: { id: n.id, location: n.location, hub_name: n.hub_name },
      })),
  };
}

function linksToGeoJSON(schools: School[], hubsById: Map<number, HubBrief>) {
  const features = [];
  for (const s of schools) {
    if (!s.hub_id || !s.latitude || !s.longitude) continue;
    const hub = hubsById.get(s.hub_id);
    if (!hub?.latitude || !hub?.longitude) continue;
    features.push({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [[s.longitude, s.latitude], [hub.longitude!, hub.latitude!]],
      },
      properties: { hub_dist_km: s.hub_dist_km },
    });
  }
  return { type: "FeatureCollection" as const, features };
}

export default function AtlasMap() {
  const mapRef = useRef<MapRef>(null);
  const {
    viewport, setViewport, filters, layers,
    setSelectedSchool, setSelectedHub, heatmapField,
  } = useAtlasStore();

  const [popup, setPopup] = useState<{ lon: number; lat: number; content: React.ReactNode } | null>(null);
  const [mapBbox, setMapBbox] = useState<string | undefined>();

  // Fetch data (use bbox from map to limit load)
  const { data: schoolsData } = useSWR(
    ["schools-map", JSON.stringify(filters), mapBbox],
    () => fetchSchools({ ...filters, bbox: mapBbox, page: 1, page_size: 2000 }),
    { revalidateOnFocus: false }
  );

  const { data: hubsData } = useSWR(
    ["hubs-map", mapBbox],
    () => fetchHubs({ page: 1, page_size: 5000, bbox: mapBbox }),
    { revalidateOnFocus: false }
  );

  const { data: midMileData } = useSWR(
    layers.midMile ? ["midmile-map", mapBbox] : null,
    () => fetchMidMile({ page: 1, page_size: 1000, bbox: mapBbox }),
    { revalidateOnFocus: false }
  );

  const schools = schoolsData?.data || [];
  const hubs    = hubsData?.data   || [];
  const midMile = midMileData?.data || [];

  const hubsById = new Map(hubs.map((h) => [h.id, h]));

  const schoolsGeoJSON = schoolsToGeoJSON(schools);
  const hubsGeoJSON    = hubsToGeoJSON(hubs);
  const midMileGeoJSON = midMileToGeoJSON(midMile);
  const linksGeoJSON   = linksToGeoJSON(schools, hubsById);

  // Update bbox on map move
  const onMapMove = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(4)).join(",");
    setMapBbox(bbox);
    const c = map.getCenter();
    setViewport({ longitude: c.lng, latitude: c.lat, zoom: map.getZoom() });
  }, [setViewport]);

  // Click handlers
  const onSchoolClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const { facility_code, name, facility_type, hub_dist_km, total_cost } = f.properties as any;
    setSelectedSchool({
      id: f.properties!.id,
      facility_code, name, facility_type, hub_dist_km, total_cost,
      longitude: (f.geometry as any).coordinates[0],
      latitude:  (f.geometry as any).coordinates[1],
    } as School);
    setPopup({
      lon: (f.geometry as any).coordinates[0],
      lat: (f.geometry as any).coordinates[1],
      content: (
        <div>
          <p className="font-semibold text-sm">{name}</p>
          <p className="text-xs text-gray-500">{facility_type}</p>
          {hub_dist_km && <p className="text-xs text-blue-600 mt-1">Hub: {fmtKm(hub_dist_km)}</p>}
          {total_cost && <p className="text-xs text-gray-700">{fmtCurrency(total_cost)}</p>}
        </div>
      ),
    });
  }, [setSelectedSchool]);

  const onHubClick = useCallback((e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    const { hub_site_code, site_name, site_owner, capacity } = f.properties as any;
    setSelectedHub({ id: f.properties!.id, hub_site_code, site_name, site_owner, aggregate_capacity_gbps: capacity } as HubBrief);
  }, [setSelectedHub]);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      mapStyle={activeTheme.mapStyle}
      initialViewState={{ longitude: ZAMBIA_CENTER[0], latitude: ZAMBIA_CENTER[1], zoom: 5.5 }}
      style={{ width: "100%", height: "100%" }}
      onMoveEnd={onMapMove}
      interactiveLayerIds={["schools-points", "hubs-points"]}
      onClick={(e) => {
        const f = e.features?.[0];
        if (f?.layer?.id === "schools-points") onSchoolClick(e);
        if (f?.layer?.id === "hubs-points")   onHubClick(e);
      }}
      onMouseEnter={() => { if (mapRef.current) mapRef.current.getCanvas().style.cursor = "pointer"; }}
      onMouseLeave={() => { if (mapRef.current) mapRef.current.getCanvas().style.cursor = ""; }}
    >
      <NavigationControl position="bottom-right" />
      <ScaleControl position="bottom-left" />
      <FullscreenControl position="bottom-right" />

      {/* ── Links layer ────────────────────────────────────────────────── */}
      {layers.links && (
        <Source id="links" type="geojson" data={linksGeoJSON}>
          <Layer id="links-lines" type="line"
            paint={{ "line-color": "#94a3b8", "line-width": 1, "line-opacity": 0.4, "line-dasharray": [3, 3] }} />
        </Source>
      )}

      {/* ── Schools layer ──────────────────────────────────────────────── */}
      {layers.schools && (
        <Source
          id="schools"
          type="geojson"
          data={schoolsGeoJSON}
          cluster={layers.clusters}
          clusterMaxZoom={10}
          clusterRadius={40}
        >
          {/* Cluster circles */}
          {layers.clusters && <>
            <Layer id="schools-clusters" type="circle" filter={["has", "point_count"]}
              paint={{
                "circle-color": ["step", ["get", "point_count"], "#60a5fa", 50, "#3b82f6", 200, "#1d4ed8"],
                "circle-radius": ["step", ["get", "point_count"], 20, 50, 28, 200, 36],
                "circle-opacity": 0.85,
              }} />
            <Layer id="schools-cluster-count" type="symbol" filter={["has", "point_count"]}
              layout={{ "text-field": "{point_count_abbreviated}", "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"], "text-size": 12 }}
              paint={{ "text-color": "#fff" }} />
          </>}

          {/* Individual points */}
          <Layer id="schools-points" type="circle"
            filter={layers.clusters ? ["!", ["has", "point_count"]] : ["all"]}
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 3, 10, 6, 14, 10],
              "circle-color": ["get", "color"],
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#fff",
              "circle-opacity": 0.9,
            }} />
        </Source>
      )}

      {/* ── Heatmap layer ──────────────────────────────────────────────── */}
      {layers.heatmap && (
        <Source id="schools-heat" type="geojson" data={schoolsGeoJSON}>
          <Layer id="schools-heatmap" type="heatmap"
            paint={{
              "heatmap-weight": ["interpolate", ["linear"], ["get", heatmapField], 0, 0, 100000, 1],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
              "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
                0, "rgba(33,102,172,0)", 0.2, "rgb(103,169,207)",
                0.4, "rgb(209,229,240)", 0.6, "rgb(253,219,199)",
                0.8, "rgb(239,138,98)", 1, "rgb(178,24,43)"],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
              "heatmap-opacity": 0.7,
            }} />
        </Source>
      )}

      {/* ── Hubs layer ─────────────────────────────────────────────────── */}
      {layers.hubs && (
        <Source id="hubs" type="geojson" data={hubsGeoJSON}>
          <Layer id="hubs-points" type="circle"
            paint={{
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 8, 14, 14],
              "circle-color": ["get", "color"],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
              "circle-opacity": 0.85,
            }} />
          <Layer id="hubs-labels" type="symbol" minzoom={9}
            layout={{
              "text-field": ["get", "site_name"],
              "text-size": 10,
              "text-offset": [0, 1.2],
              "text-anchor": "top",
            }}
            paint={{ "text-color": "#374151", "text-halo-color": "#fff", "text-halo-width": 1 }} />
        </Source>
      )}

      {/* ── Mid-mile layer ─────────────────────────────────────────────── */}
      {layers.midMile && (
        <Source id="midmile" type="geojson" data={midMileGeoJSON}>
          <Layer id="midmile-points" type="circle"
            paint={{
              "circle-radius": 5,
              "circle-color": "#f59e0b",
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#fff",
              "circle-opacity": 0.8,
            }} />
        </Source>
      )}

      {/* ── Popup ──────────────────────────────────────────────────────── */}
      {popup && (
        <Popup longitude={popup.lon} latitude={popup.lat}
          anchor="bottom" closeOnClick={false}
          onClose={() => setPopup(null)}>
          {popup.content}
        </Popup>
      )}
    </Map>
  );
}
