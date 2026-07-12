/**
 * LiveTrackingMap.jsx  — Uber/Ola-style live ambulance tracking map
 *
 * Props:
 *   userLocation      – { latitude, longitude } | null   (patient)
 *   ambulanceLoc      – { latitude, longitude } | null   (ambulance / driver)
 *   hospitalLocation  – { latitude, longitude } | null
 *   emergencyStatus   – string  e.g. "DRIVER_ON_THE_WAY"
 *   speed             – number km/h | null
 *   mapHeight         – CSS string, default "480px"
 *   label             – overlay badge text
 */

import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
// Fix for Vite production worker transpilation bug
import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker";
mapboxgl.workerClass = MapboxWorker;

import {
  USER_ICON_SVG,
  AMBULANCE_ICON_SVG,
  HOSPITAL_ICON_SVG,
  haversineDistance,
  formatDistance,
  lerp,
} from "../utils/trackingUtils";

// ── Mapbox token ──────────────────────────────────────────────────────────────
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

// ── Constants ─────────────────────────────────────────────────────────────────
const DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";
const FOLLOW_ZOOM        = 15;      // Zoom when following ambulance (Uber-style close)
const LOCAL_FIT_MAX_KM   = 30;      // Only fitBounds when points within 30 km
const ROUTE_DEBOUNCE_MS  = 5000;    // Directions API rate-limit guard
const ANIM_STEPS         = 40;      // Lerp frames for smooth marker move
const ANIM_MS            = 1000;    // Total animation duration

function getMapStyle() {
  const h = new Date().getHours();
  return h >= 6 && h < 18
    ? "mapbox://styles/mapbox/navigation-day-v1"
    : "mapbox://styles/mapbox/navigation-night-v1";
}

function buildMarkerEl(svgString, size = 44) {
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4));`;
  el.innerHTML = svgString;
  return el;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function LiveTrackingMap({
  userLocation,
  ambulanceLoc,
  hospitalLocation,
  emergencyStatus,
  speed,
  mapHeight = "480px",
  label,
}) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef({ user: null, ambulance: null, hospital: null });
  const animFrameRef    = useRef(null);
  const prevAmbRef      = useRef(null);
  const routeTimerRef   = useRef(null);
  const etaPanelRef     = useRef(null);
  const hasMovedRef     = useRef(false);   // true after first location update

  // ── ETA state shown in overlay ─────────────────────────────────────────────
  const [etaInfo, setEtaInfo] = useState({ eta: "–", dist: "–", spd: "–" });

  // ── Initialise map ONCE ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!mapboxgl.accessToken) {
      console.warn("VITE_MAPBOX_TOKEN missing");
      return;
    }

    const center = ambulanceLoc
      ? [ambulanceLoc.longitude, ambulanceLoc.latitude]
      : userLocation
      ? [userLocation.longitude, userLocation.latitude]
      : [77.5946, 12.9716]; // fallback Bangalore

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: getMapStyle(),
      center,
      zoom: FOLLOW_ZOOM,          // Start zoomed-in like Uber
      pitch: 45,                  // Slight tilt for depth (Uber-feel)
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    map.on("load", () => {
      // ── Route line layers ───────────────────────────────────────────────────
      map.addSource("route", {
        type: "geojson",
        data: emptyGeojson(),
      });

      // Glow / casing
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3B82F6", "line-width": 12, "line-opacity": 0.18 },
      });

      // Main solid line
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2563EB", "line-width": 5.5, "line-opacity": 1 },
      });

      // Direction arrows along the route
      map.addLayer({
        id: "route-arrows",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 2.5,
          "line-opacity": 0.5,
          "line-dasharray": [0, 4, 3],
        },
      });

      // ── Place markers ───────────────────────────────────────────────────────
      if (userLocation) placeMarker("user", userLocation, map);
      if (ambulanceLoc) placeMarker("ambulance", ambulanceLoc, map);
      if (hospitalLocation) placeMarker("hospital", hospitalLocation, map);

      // ── Initial camera: zoom in on ambulance ───────────────────────────────
      if (ambulanceLoc) {
        smartFit(map);
      } else if (userLocation) {
        map.easeTo({ center: [userLocation.longitude, userLocation.latitude], zoom: FOLLOW_ZOOM, duration: 800 });
      }

      // ── Initial route ──────────────────────────────────────────────────────
      scheduleRoute(map);
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
      map.remove();
      mapRef.current = null;
      markersRef.current = { user: null, ambulance: null, hospital: null };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function emptyGeojson() {
    return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
  }

  function placeMarker(type, loc, map) {
    const svg   = type === "user" ? USER_ICON_SVG : type === "ambulance" ? AMBULANCE_ICON_SVG : HOSPITAL_ICON_SVG;
    const size  = type === "ambulance" ? 56 : type === "hospital" ? 50 : 46;
    const anchor = type === "ambulance" ? "center" : "bottom";
    const popup = new mapboxgl.Popup({ offset: 28, closeButton: false })
      .setText(type === "user" ? "📍 Patient" : type === "ambulance" ? "🚑 Ambulance" : "🏥 Hospital");

    const marker = new mapboxgl.Marker({ element: buildMarkerEl(svg, size), anchor })
      .setLngLat([loc.longitude, loc.latitude])
      .setPopup(popup)
      .addTo(map);

    markersRef.current[type] = marker;
    if (type === "ambulance") prevAmbRef.current = { ...loc };
  }

  // Smart camera: if all 3 points are within LOCAL_FIT_MAX_KM, fitBounds.
  // Otherwise just zoom to ambulance (Uber behaviour — never show whole country).
  const smartFit = useCallback((mapInst) => {
    const map = mapInst || mapRef.current;
    if (!map) return;

    const pts = [
      ambulanceLoc && [ambulanceLoc.longitude, ambulanceLoc.latitude],
      userLocation  && [userLocation.longitude, userLocation.latitude],
      hospitalLocation && [hospitalLocation.longitude, hospitalLocation.latitude],
    ].filter(Boolean);

    if (pts.length === 0) return;

    // Check if all are within LOCAL_FIT_MAX_KM of ambulance
    const ambPt = ambulanceLoc || userLocation;
    const allClose = pts.every((p) => {
      const d = haversineDistance(ambPt.latitude, ambPt.longitude, p[1], p[0]);
      return d <= LOCAL_FIT_MAX_KM;
    });

    if (allClose && pts.length > 1) {
      const bounds = pts.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(pts[0], pts[0])
      );
      map.fitBounds(bounds, { padding: 90, maxZoom: 15, duration: 1200, pitch: 45 });
    } else {
      // Hospital is far — just center on ambulance, zoom 15
      const center = ambulanceLoc
        ? [ambulanceLoc.longitude, ambulanceLoc.latitude]
        : [userLocation.longitude, userLocation.latitude];
      map.easeTo({ center, zoom: FOLLOW_ZOOM, pitch: 45, duration: 1000 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambulanceLoc, userLocation, hospitalLocation]);

  // Smooth lerp animation for ambulance marker
  const animateMarker = useCallback((newLng, newLat) => {
    const marker = markersRef.current.ambulance;
    if (!marker) return;
    const prev = prevAmbRef.current;
    if (!prev) {
      marker.setLngLat([newLng, newLat]);
      prevAmbRef.current = { latitude: newLat, longitude: newLng };
      return;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    let step = 0;
    const animate = () => {
      step++;
      const t = step / ANIM_STEPS;
      marker.setLngLat([lerp(prev.longitude, newLng, t), lerp(prev.latitude, newLat, t)]);
      if (step < ANIM_STEPS) animFrameRef.current = requestAnimationFrame(animate);
      else prevAmbRef.current = { latitude: newLat, longitude: newLng };
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  // Fetch route from Mapbox Directions and draw it
  const drawRoute = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !ambulanceLoc) return;

    const patientPicked = ["PATIENT_PICKED", "HOSPITAL_REACHED"].includes(emergencyStatus);
    const ambCoord = [ambulanceLoc.longitude, ambulanceLoc.latitude];

    // Determine destination: before pickup → patient; after pickup → hospital
    let destCoord = null;
    if (!patientPicked && userLocation) {
      destCoord = [userLocation.longitude, userLocation.latitude];
    } else if (patientPicked && hospitalLocation) {
      destCoord = [hospitalLocation.longitude, hospitalLocation.latitude];
    } else if (userLocation) {
      destCoord = [userLocation.longitude, userLocation.latitude];
    }

    if (!destCoord) return;

    // Safety: if destination is > 200 km away, skip API call (data issue in DB)
    const dist = haversineDistance(ambCoord[1], ambCoord[0], destCoord[1], destCoord[0]);
    if (dist > 200) {
      // Clear route and just show ETA from haversine
      const source = map.getSource("route");
      if (source) source.setData(emptyGeojson());
      const etaMin = Math.round((dist / 40) * 60);
      setEtaInfo({
        eta: etaMin < 60 ? `${etaMin} min` : `${Math.floor(etaMin / 60)} hr ${etaMin % 60} min`,
        dist: formatDistance(dist),
        spd: speed != null ? `${Math.round(speed)} km/h` : "–",
      });
      return;
    }

    try {
      const url = `${DIRECTIONS_URL}/${ambCoord.join(",")};${destCoord.join(",")}?geometries=geojson&overview=full&steps=false&access_token=${mapboxgl.accessToken}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`Directions ${res.status}`);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return;

      const source = map.getSource("route");
      if (source) source.setData({ type: "Feature", properties: {}, geometry: route.geometry });

      const distKm  = route.distance / 1000;
      const durMin  = Math.round(route.duration / 60);
      setEtaInfo({
        eta: durMin < 1 ? "< 1 min" : durMin < 60 ? `${durMin} min` : `${Math.floor(durMin / 60)} hr ${durMin % 60} min`,
        dist: formatDistance(distKm),
        spd: speed != null ? `${Math.round(speed)} km/h` : "–",
      });
    } catch (err) {
      console.warn("Directions fetch failed:", err.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambulanceLoc, userLocation, hospitalLocation, emergencyStatus, speed]);

  function scheduleRoute(mapInst) {
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    routeTimerRef.current = setTimeout(() => drawRoute(mapInst), ROUTE_DEBOUNCE_MS);
  }

  // ── React: ambulance location update ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ambulanceLoc) return;

    // Create marker if not yet on map
    if (!markersRef.current.ambulance) {
      if (map.isStyleLoaded()) placeMarker("ambulance", ambulanceLoc, map);
      return;
    }

    // Smooth marker animation
    animateMarker(ambulanceLoc.longitude, ambulanceLoc.latitude);

    // On first real movement → do smartFit once, then always follow closely
    if (!hasMovedRef.current) {
      hasMovedRef.current = true;
      smartFit(map);
    } else {
      // Uber-style: smoothly follow ambulance at FOLLOW_ZOOM
      map.easeTo({
        center: [ambulanceLoc.longitude, ambulanceLoc.latitude],
        zoom: FOLLOW_ZOOM,
        pitch: 50,
        duration: ANIM_MS,
      });
    }

    // Debounced route redraw
    scheduleRoute(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambulanceLoc]);

  // ── React: user (patient) location ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    if (!markersRef.current.user) {
      if (map.isStyleLoaded()) placeMarker("user", userLocation, map);
    } else {
      markersRef.current.user.setLngLat([userLocation.longitude, userLocation.latitude]);
    }
  }, [userLocation]);

  // ── React: hospital location ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !hospitalLocation) return;
    if (!markersRef.current.hospital) {
      if (map.isStyleLoaded()) placeMarker("hospital", hospitalLocation, map);
    } else {
      markersRef.current.hospital.setLngLat([hospitalLocation.longitude, hospitalLocation.latitude]);
    }
  }, [hospitalLocation]);

  // ── React: speed update ───────────────────────────────────────────────────
  useEffect(() => {
    if (speed != null) {
      setEtaInfo((prev) => ({ ...prev, spd: `${Math.round(speed)} km/h` }));
    }
  }, [speed]);

  // ── Draw initial route once map + coords ready ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!ambulanceLoc || !map) return;
    const run = () => { scheduleRoute(map); };
    if (map.isStyleLoaded()) run();
    else map.once("load", run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Recenter button handler ───────────────────────────────────────────────
  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map || !ambulanceLoc) return;
    map.easeTo({
      center: [ambulanceLoc.longitude, ambulanceLoc.latitude],
      zoom: FOLLOW_ZOOM,
      pitch: 50,
      duration: 800,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", borderRadius: 20, overflow: "hidden" }}
      className="w-full shadow-2xl border border-slate-700/50">

      {/* Label badge */}
      {label && (
        <div style={{
          position: "absolute", top: 14, left: 14, zIndex: 10,
          background: "rgba(15,23,42,0.88)", backdropFilter: "blur(10px)",
          borderRadius: 10, padding: "6px 14px", fontSize: 13, fontWeight: 600,
          color: "#f8fafc", letterSpacing: "0.02em",
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "pulse 1.5s infinite" }} />
          {label}
        </div>
      )}

      {/* Map */}
      <div ref={mapContainerRef} style={{ width: "100%", height: mapHeight }} />

      {/* ── ETA Panel ── */}
      <div style={{
        position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
        zIndex: 10, background: "rgba(10,18,36,0.92)", backdropFilter: "blur(14px)",
        borderRadius: 18, padding: "12px 24px",
        display: "flex", alignItems: "center", gap: 20,
        border: "1px solid rgba(255,255,255,0.13)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)", minWidth: 280, justifyContent: "center",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "#64748b", marginBottom: 3, fontWeight: 600 }}>ETA</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#60A5FA", fontVariantNumeric: "tabular-nums" }}>{etaInfo.eta}</div>
        </div>
        <div style={{ width: 1, height: 34, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "#64748b", marginBottom: 3, fontWeight: 600 }}>DISTANCE</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#34D399", fontVariantNumeric: "tabular-nums" }}>{etaInfo.dist}</div>
        </div>
        <div style={{ width: 1, height: 34, background: "rgba(255,255,255,0.1)" }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "#64748b", marginBottom: 3, fontWeight: 600 }}>SPEED</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#FBBF24", fontVariantNumeric: "tabular-nums" }}>{etaInfo.spd}</div>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{
        position: "absolute", top: 14, right: 56, zIndex: 10,
        background: "rgba(15,23,42,0.88)", backdropFilter: "blur(10px)",
        borderRadius: 10, padding: "8px 12px",
        display: "flex", flexDirection: "column", gap: 5,
        border: "1px solid rgba(255,255,255,0.1)",
        fontSize: 11, color: "#e2e8f0", fontWeight: 600,
      }}>
        {[
          { color: "#EF4444", label: "Patient" },
          { color: "#3B82F6", label: "Ambulance" },
          { color: "#10B981", label: "Hospital" },
        ].map(({ color, label: l }) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
            {l}
          </div>
        ))}
      </div>

      {/* ── Recenter button ── */}
      <button
        onClick={handleRecenter}
        title="Recenter on ambulance"
        style={{
          position: "absolute", bottom: 80, right: 14, zIndex: 10,
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(15,23,42,0.92)", border: "1px solid rgba(255,255,255,0.15)",
          color: "#f8fafc", fontSize: 18, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          backdropFilter: "blur(8px)", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          transition: "transform 0.15s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.1)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      >
        🎯
      </button>

      {/* Pulse animation for the live dot */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
