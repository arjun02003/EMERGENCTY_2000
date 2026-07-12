/**
 * EmergencyTracking.jsx
 * Full-screen Uber/Ola-style live ambulance tracking page.
 * Route: /tracking
 *
 * Reads state from localStorage (set by UserDashboard when SOS fires).
 * Connects to Socket.IO and receives live ambulance_location_update events.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import API from "../api/.api";
import { haversineDistance, formatDistance, lerp } from "../utils/trackingUtils";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

// ── SVG icons ─────────────────────────────────────────────────────────────────
const USER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="60" viewBox="0 0 48 60">
  <defs><filter id="su"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,.5)"/></filter></defs>
  <path d="M24 2C14.6 2 7 9.6 7 19c0 13.5 17 37 17 37s17-23.5 17-37C41 9.6 33.4 2 24 2z" fill="#EF4444" filter="url(#su)"/>
  <circle cx="24" cy="19" r="9" fill="white" opacity=".95"/>
  <circle cx="24" cy="16" r="3.5" fill="#EF4444"/>
  <path d="M15.5 28c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5" stroke="#EF4444" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`;

const AMB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs><filter id="sa"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="rgba(0,0,0,.5)"/></filter></defs>
  <circle cx="32" cy="32" r="30" fill="#1D4ED8" filter="url(#sa)"/>
  <circle cx="32" cy="32" r="27" fill="#2563EB"/>
  <rect x="14" y="24" width="36" height="20" rx="4" fill="white"/>
  <rect x="36" y="25" width="12" height="14" rx="3" fill="#BFDBFE"/>
  <rect x="22" y="28" width="13" height="4" rx="2" fill="#2563EB"/>
  <rect x="27" y="23" width="4" height="13" rx="2" fill="#2563EB"/>
  <circle cx="20" cy="46" r="4.5" fill="#1E3A8A"/>
  <circle cx="44" cy="46" r="4.5" fill="#1E3A8A"/>
  <circle cx="20" cy="46" r="2.2" fill="#93C5FD"/>
  <circle cx="44" cy="46" r="2.2" fill="#93C5FD"/>
  <rect x="20" y="18" width="20" height="5" rx="2.5" fill="#EF4444"/>
  <circle cx="26" cy="20.5" r="2" fill="#FCA5A5"/>
  <circle cx="38" cy="20.5" r="2" fill="#FCA5A5"/>
</svg>`;

const HOSP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
  <defs><filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,.5)"/></filter></defs>
  <path d="M26 2C16 2 8 10 8 20c0 14 18 40 18 40s18-26 18-40C44 10 36 2 26 2z" fill="#10B981" filter="url(#sh)"/>
  <circle cx="26" cy="20" r="10" fill="white" opacity=".95"/>
  <rect x="22" y="13" width="8" height="14" rx="2" fill="#10B981"/>
  <rect x="18" y="17" width="16" height="8" rx="2" fill="#10B981"/>
</svg>`;

function mkEl(svg, size) {
  const el = document.createElement("div");
  el.style.cssText = `width:${size}px;height:${size}px;cursor:pointer;`;
  el.innerHTML = svg;
  return el;
}

const STATUS_LABELS = {
  SEARCHING_HOSPITAL:    { text: "Searching for hospitals…",   color: "#F59E0B", pulse: true  },
  WAITING_FOR_ACCEPTANCE:{ text: "Waiting for hospital to accept", color: "#F59E0B", pulse: true  },
  AMBULANCE_ASSIGNED:    { text: "Ambulance has been assigned", color: "#3B82F6", pulse: true  },
  DRIVER_ACCEPTED:       { text: "Driver accepted — heading to you", color: "#3B82F6", pulse: true  },
  DRIVER_ON_THE_WAY:     { text: "🚑 Ambulance is on the way!",  color: "#10B981", pulse: true  },
  PATIENT_PICKED:        { text: "✅ Patient picked up — driving to hospital", color: "#10B981", pulse: false },
  HOSPITAL_REACHED:      { text: "🏥 Arrived at hospital",       color: "#10B981", pulse: false },
  COMPLETED:             { text: "✅ Emergency completed",        color: "#10B981", pulse: false },
};

export default function EmergencyTracking() {
  const navigate = useNavigate();

  // ── Read persisted state ───────────────────────────────────────────────────
  const raw = (() => {
    try { return JSON.parse(localStorage.getItem("activeEmergency") || "{}"); } catch { return {}; }
  })();

  const [emergencyData, setEmergencyData] = useState(raw);
  const [ambulanceLoc, setAmbulanceLoc]   = useState(null);
  const [liveSpeed, setLiveSpeed]         = useState(null);
  const [status, setStatus]               = useState(raw.status || "AMBULANCE_ASSIGNED");
  const [etaInfo, setEtaInfo]             = useState({ eta: "–", dist: "–" });
  const [routeReady, setRouteReady]       = useState(false);

  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef({ user: null, ambulance: null, hospital: null });
  const prevAmbRef      = useRef(null);
  const animRef         = useRef(null);
  const routeTimerRef   = useRef(null);
  const socketRef       = useRef(null);
  const hasFollowed     = useRef(false);

  const userLoc     = raw.patientLat && raw.patientLng
    ? { lat: raw.patientLat, lng: raw.patientLng } : null;
  const hospitalLoc = raw.hospitalLat && raw.hospitalLng
    ? { lat: raw.hospitalLat, lng: raw.hospitalLng } : null;

  // ── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center = userLoc
      ? [userLoc.lng, userLoc.lat]
      : [77.5946, 12.9716];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: new Date().getHours() >= 6 && new Date().getHours() < 18
        ? "mapbox://styles/mapbox/navigation-day-v1"
        : "mapbox://styles/mapbox/navigation-night-v1",
      center,
      zoom: 14,
      pitch: 50,
      bearing: 0,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      // Route source
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
      });

      // Glow
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3B82F6", "line-width": 14, "line-opacity": 0.2 },
      });

      // Main line
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2563EB", "line-width": 6, "line-opacity": 1 },
      });

      // Animated dash overlay (moving dashes = Uber feel)
      map.addLayer({
        id: "route-dash",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#FFFFFF",
          "line-width": 2.5,
          "line-opacity": 0.55,
          "line-dasharray": [0, 4, 3],
        },
      });

      // Place patient marker
      if (userLoc) {
        const popup = new mapboxgl.Popup({ offset: 30, closeButton: false }).setHTML(
          `<div style="font-weight:600;color:#EF4444">📍 Your Location</div>`
        );
        markersRef.current.user = new mapboxgl.Marker({ element: mkEl(USER_SVG, 48), anchor: "bottom" })
          .setLngLat([userLoc.lng, userLoc.lat])
          .setPopup(popup)
          .addTo(map);
      }

      // Place hospital marker
      if (hospitalLoc) {
        const popup = new mapboxgl.Popup({ offset: 30, closeButton: false }).setHTML(
          `<div style="font-weight:600;color:#10B981">🏥 ${raw.hospitalName || "Hospital"}</div>`
        );
        markersRef.current.hospital = new mapboxgl.Marker({ element: mkEl(HOSP_SVG, 52), anchor: "bottom" })
          .setLngLat([hospitalLoc.lng, hospitalLoc.lat])
          .setPopup(popup)
          .addTo(map);
      }

      // Zoom to patient immediately
      if (userLoc) {
        map.easeTo({ center: [userLoc.lng, userLoc.lat], zoom: 14, pitch: 50, duration: 1000 });
      }
    });

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket.IO ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user  = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
    const uid   = user._id || user.id;
    if (!uid || !token) return;

    const socket = io(import.meta.env.VITE_API_URL || "https://emergency-2000.onrender.com", {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("join", `user:${uid}`));

    socket.on("emergency_status", ({ status: s, emergency }) => {
      setStatus(s);
      if (emergency?.assignedHospital?.location) {
        const h = emergency.assignedHospital.location;
        updateLocalStore({ hospitalLat: h.latitude, hospitalLng: h.longitude, hospitalName: emergency.assignedHospital.name });
      }
    });

    socket.on("ambulance_location_update", (p) => {
      setAmbulanceLoc({ lat: p.latitude, lng: p.longitude });
      if (p.speed != null) setLiveSpeed(p.speed);
      setStatus(p.emergencyStatus || status);
      if (p.hospitalLatitude && p.hospitalLongitude && !hospitalLoc) {
        updateLocalStore({ hospitalLat: p.hospitalLatitude, hospitalLng: p.hospitalLongitude });
      }
    });

    return () => socket.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateLocalStore(patch) {
    const cur = (() => { try { return JSON.parse(localStorage.getItem("activeEmergency") || "{}"); } catch { return {}; } })();
    localStorage.setItem("activeEmergency", JSON.stringify({ ...cur, ...patch }));
  }

  // ── Ambulance marker + camera ──────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ambulanceLoc) return;

    // Create marker once
    if (!markersRef.current.ambulance) {
      if (!map.isStyleLoaded()) return;
      const popup = new mapboxgl.Popup({ offset: 32, closeButton: false }).setHTML(
        `<div style="font-weight:700;color:#2563EB;font-size:13px">🚑 ${raw.driverName || "Driver"}</div>
         <div style="color:#64748b;font-size:11px">${raw.vehicleNumber || ""}</div>`
      );
      markersRef.current.ambulance = new mapboxgl.Marker({
        element: mkEl(AMB_SVG, 64),
        anchor: "center",
        rotationAlignment: "map",
      })
        .setLngLat([ambulanceLoc.lng, ambulanceLoc.lat])
        .setPopup(popup)
        .addTo(map);
      prevAmbRef.current = { ...ambulanceLoc };
    } else {
      // Smooth lerp animation
      animateMarker(ambulanceLoc.lat, ambulanceLoc.lng);
    }

    // Camera: first time → fitBounds; after that → follow ambulance
    if (!hasFollowed.current) {
      hasFollowed.current = true;
      fitAll(map);
    } else {
      map.easeTo({
        center: [ambulanceLoc.lng, ambulanceLoc.lat],
        zoom: 15,
        pitch: 52,
        duration: 1000,
      });
    }

    // Debounce route redraw
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    routeTimerRef.current = setTimeout(() => fetchAndDrawRoute(), 4000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambulanceLoc]);

  // ── Fit bounds to all visible nearby points ────────────────────────────────
  function fitAll(map) {
    const pts = [];
    if (ambulanceLoc) pts.push([ambulanceLoc.lng, ambulanceLoc.lat]);
    if (userLoc)      pts.push([userLoc.lng, userLoc.lat]);

    const hosp = (() => {
      try { return JSON.parse(localStorage.getItem("activeEmergency") || "{}"); } catch { return {}; }
    })();
    const hLat = hosp.hospitalLat, hLng = hosp.hospitalLng;
    if (hLat && hLng && ambulanceLoc) {
      const d = haversineDistance(ambulanceLoc.lat, ambulanceLoc.lng, hLat, hLng);
      if (d <= 40) pts.push([hLng, hLat]);
    }

    if (pts.length < 2) {
      map.easeTo({ center: pts[0] || [77.5946, 12.9716], zoom: 15, pitch: 52, duration: 1200 });
      return;
    }
    const bounds = pts.reduce(
      (b, c) => b.extend(c),
      new mapboxgl.LngLatBounds(pts[0], pts[0])
    );
    map.fitBounds(bounds, { padding: { top: 100, bottom: 280, left: 60, right: 60 }, maxZoom: 15.5, duration: 1400, pitch: 50 });
  }

  // ── Lerp marker animation ─────────────────────────────────────────────────
  function animateMarker(newLat, newLng) {
    const marker = markersRef.current.ambulance;
    const prev   = prevAmbRef.current;
    if (!marker || !prev) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    let step = 0;
    const STEPS = 45;
    const go = () => {
      step++;
      const t = step / STEPS;
      const lat = lerp(prev.lat, newLat, t);
      const lng = lerp(prev.lng, newLng, t);
      marker.setLngLat([lng, lat]);
      if (step < STEPS) animRef.current = requestAnimationFrame(go);
      else prevAmbRef.current = { lat: newLat, lng: newLng };
    };
    animRef.current = requestAnimationFrame(go);
  }

  // ── Fetch route from Mapbox Directions ────────────────────────────────────
  async function fetchAndDrawRoute() {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !ambulanceLoc) return;

    const fresh = (() => { try { return JSON.parse(localStorage.getItem("activeEmergency") || "{}"); } catch { return {}; } })();
    const patientPicked = ["PATIENT_PICKED", "HOSPITAL_REACHED", "COMPLETED"].includes(status);

    const from = [ambulanceLoc.lng, ambulanceLoc.lat];
    let to = null;

    if (!patientPicked && userLoc) {
      to = [userLoc.lng, userLoc.lat];
    } else if (patientPicked && fresh.hospitalLat && fresh.hospitalLng) {
      to = [fresh.hospitalLng, fresh.hospitalLat];
    } else if (userLoc) {
      to = [userLoc.lng, userLoc.lat];
    }

    if (!to) return;

    const dist = haversineDistance(from[1], from[0], to[1], to[0]);

    if (dist > 150) {
      // Too far — show estimate only, no API call
      const estMin = Math.round((dist / 40) * 60);
      setEtaInfo({
        eta: estMin < 60 ? `${estMin} min` : `${Math.floor(estMin / 60)} hr ${estMin % 60} min`,
        dist: formatDistance(dist),
      });
      return;
    }

    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.join(",")};${to.join(",")}?geometries=geojson&overview=full&steps=false&access_token=${mapboxgl.accessToken}`;
      const res  = await fetch(url);
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return;

      const src = map.getSource("route");
      if (src) {
        src.setData({ type: "Feature", properties: {}, geometry: route.geometry });
        setRouteReady(true);
        animateDash(map);
      }

      const distKm = route.distance / 1000;
      const durMin = Math.round(route.duration / 60);
      setEtaInfo({
        eta: durMin < 1 ? "< 1 min" : durMin < 60 ? `${durMin} min` : `${Math.floor(durMin / 60)} hr ${durMin % 60} min`,
        dist: formatDistance(distKm),
      });
    } catch (e) {
      console.warn("Route fetch failed:", e.message);
    }
  }

  // ── Animate dashes along route ─────────────────────────────────────────────
  let dashStep = 0;
  function animateDash(map) {
    if (!map.getLayer("route-dash")) return;
    const dashArrays = [
      [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
      [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
    ];
    function step() {
      if (!mapRef.current || !mapRef.current.getLayer("route-dash")) return;
      mapRef.current.setPaintProperty("route-dash", "line-dasharray", dashArrays[dashStep % dashArrays.length]);
      dashStep++;
      setTimeout(step, 90);
    }
    step();
  }

  // ── Cancel emergency ──────────────────────────────────────────────────────
  const handleCancel = () => {
    localStorage.removeItem("activeEmergency");
    navigate("/dashboard");
  };

  // ── Status badge ──────────────────────────────────────────────────────────
  const statusMeta = STATUS_LABELS[status] || { text: status, color: "#94a3b8", pulse: false };
  const isCompleted = status === "COMPLETED";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#0f172a", display: "flex", flexDirection: "column", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes pulse-ring { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes slide-up { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fade-in { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes bounce-dot { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
      `}</style>

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        background: "linear-gradient(to bottom, rgba(10,18,36,.95) 70%, transparent)",
        padding: "16px 20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <button onClick={handleCancel}
          style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 12, padding: "8px 16px", color: "#e2e8f0", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, backdropFilter: "blur(8px)" }}>
          ← Dashboard
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🚑</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-.02em" }}>SURAKSHA</span>
        </div>

        <div style={{
          background: statusMeta.pulse ? "rgba(239,68,68,.15)" : "rgba(16,185,129,.15)",
          border: `1px solid ${statusMeta.pulse ? "rgba(239,68,68,.4)" : "rgba(16,185,129,.4)"}`,
          borderRadius: 20, padding: "4px 14px",
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, fontWeight: 700, color: statusMeta.pulse ? "#FCA5A5" : "#6EE7B7",
          letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusMeta.pulse ? "#EF4444" : "#10B981", display: "inline-block",
            animation: statusMeta.pulse ? "pulse-ring 1.2s infinite" : "none" }} />
          LIVE
        </div>
      </div>

      {/* ── MAP ─────────────────────────────────────────────────────────────── */}
      <div ref={mapContainerRef} style={{ flex: 1, width: "100%" }} />

      {/* Status badge on map */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -160%)",
        zIndex: 15,
        background: "rgba(10,18,36,.88)", backdropFilter: "blur(12px)",
        borderRadius: 24, padding: "10px 20px",
        fontSize: 13, fontWeight: 700, color: "#f1f5f9",
        border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "0 8px 32px rgba(0,0,0,.5)",
        display: "flex", alignItems: "center", gap: 9,
        whiteSpace: "nowrap",
        animation: "fade-in .5s ease",
      }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusMeta.color, display: "inline-block", flexShrink: 0,
          animation: statusMeta.pulse ? "pulse-ring 1.2s infinite" : "none" }} />
        {statusMeta.text}
      </div>

      {/* ── BOTTOM SHEET ───────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        zIndex: 20,
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        borderRadius: "28px 28px 0 0",
        padding: "20px 24px 32px",
        boxShadow: "0 -16px 60px rgba(0,0,0,.6)",
        border: "1px solid rgba(255,255,255,.08)",
        animation: "slide-up .4s ease",
      }}>
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,.15)", margin: "0 auto 18px" }} />

        {/* ETA + Distance row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          {/* ETA Card */}
          <div style={{
            flex: 1, background: "linear-gradient(135deg, #1D4ED8, #2563EB)",
            borderRadius: 18, padding: "14px 16px",
            boxShadow: "0 4px 20px rgba(37,99,235,.4)",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "rgba(255,255,255,.7)", fontWeight: 700 }}>ESTIMATED ARRIVAL</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "white", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {etaInfo.eta}
            </div>
          </div>

          {/* Distance + Speed */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 110 }}>
            <div style={{
              flex: 1, background: "rgba(255,255,255,.06)", borderRadius: 16, padding: "10px 14px",
              border: "1px solid rgba(255,255,255,.1)",
            }}>
              <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "#64748b", fontWeight: 700 }}>DISTANCE</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#34D399", marginTop: 2 }}>{etaInfo.dist}</div>
            </div>
            <div style={{
              flex: 1, background: "rgba(255,255,255,.06)", borderRadius: 16, padding: "10px 14px",
              border: "1px solid rgba(255,255,255,.1)",
            }}>
              <div style={{ fontSize: 9, letterSpacing: "0.1em", color: "#64748b", fontWeight: 700 }}>SPEED</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#FBBF24", marginTop: 2 }}>
                {liveSpeed != null ? `${Math.round(liveSpeed)} km/h` : "–"}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,.07)", margin: "0 0 16px" }} />

        {/* Driver info row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Avatar */}
          <div style={{
            width: 54, height: 54, borderRadius: 16, flexShrink: 0,
            background: "linear-gradient(135deg, #1D4ED8, #7C3AED)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24,
          }}>🧑‍✈️</div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {raw.driverName || "Driver"}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{ background: "rgba(255,255,255,.08)", borderRadius: 6, padding: "2px 8px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.04em" }}>
                {raw.vehicleNumber || "—"}
              </span>
              <span style={{ color: "#475569" }}>{raw.vehicleType || "Ambulance"}</span>
            </div>
          </div>

          {/* Call button */}
          {raw.driverPhone && (
            <a href={`tel:${raw.driverPhone}`}
              style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: "linear-gradient(135deg, #059669, #10B981)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, textDecoration: "none",
                boxShadow: "0 4px 16px rgba(16,185,129,.4)",
              }}>
              📞
            </a>
          )}
        </div>

        {/* Hospital name */}
        {raw.hospitalName && (
          <div style={{
            marginTop: 14, background: "rgba(16,185,129,.08)", borderRadius: 14, padding: "10px 14px",
            border: "1px solid rgba(16,185,129,.2)",
            display: "flex", alignItems: "center", gap: 10,
            fontSize: 13, color: "#6EE7B7", fontWeight: 600,
          }}>
            <span style={{ fontSize: 18 }}>🏥</span>
            <div>
              <div style={{ fontSize: 10, color: "#4B9560", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 2 }}>DESTINATION HOSPITAL</div>
              {raw.hospitalName}
            </div>
          </div>
        )}

        {/* Recenter + Cancel row */}
        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <button
            onClick={() => {
              const map = mapRef.current;
              if (!map || !ambulanceLoc) return;
              map.easeTo({ center: [ambulanceLoc.lng, ambulanceLoc.lat], zoom: 15, pitch: 52, duration: 700 });
            }}
            style={{
              flex: 1, padding: "12px", borderRadius: 16,
              background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)",
              color: "#e2e8f0", fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            🎯 Recenter
          </button>
          <button
            onClick={handleCancel}
            style={{
              flex: 1, padding: "12px", borderRadius: 16,
              background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)",
              color: "#FCA5A5", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
            ✕ Cancel Alert
          </button>
        </div>
      </div>

      {/* No ambulance yet — searching animation */}
      {!ambulanceLoc && (
        <div style={{
          position: "absolute", top: "42%", left: "50%", transform: "translate(-50%,-50%)",
          zIndex: 25, textAlign: "center",
          background: "rgba(10,18,36,.9)", backdropFilter: "blur(16px)",
          borderRadius: 24, padding: "32px 40px",
          border: "1px solid rgba(255,255,255,.1)",
          boxShadow: "0 20px 60px rgba(0,0,0,.6)",
          animation: "fade-in .5s ease",
        }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🚑</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 9, height: 9, borderRadius: "50%", background: "#3B82F6",
                animation: `bounce-dot 1.2s infinite ${i * 0.2}s`,
              }} />
            ))}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>Locating your ambulance</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>Driver will appear on map once trip starts</div>
        </div>
      )}
    </div>
  );
}
