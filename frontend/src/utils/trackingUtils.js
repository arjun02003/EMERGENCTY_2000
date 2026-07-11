// ============================================================
// trackingUtils.js — shared helpers for the live tracking map
// ============================================================

/**
 * Haversine formula: great-circle distance between two lat/lng points in km.
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * ETA calculation from distance (km) and optional speed (km/h).
 * Returns a human-readable string like "6 min" or "1 hr 12 min".
 */
export function calculateETA(distanceKm, speedKmh = 40) {
  if (distanceKm == null || isNaN(distanceKm)) return "–";
  const totalMinutes = Math.round((distanceKm / speedKmh) * 60);
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/**
 * Format a distance (km) for display.
 */
export function formatDistance(km) {
  if (km == null || isNaN(km)) return "–";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/**
 * Linear interpolation between two coordinate sets — used for smooth animation.
 * t is in [0, 1].
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ============================================================
// SVG Icon strings for custom Mapbox markers
// ============================================================

export const USER_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="56" viewBox="0 0 44 56">
  <defs>
    <filter id="shadow-user" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
    </filter>
  </defs>
  <!-- Pin body -->
  <path d="M22 2C13.163 2 6 9.163 6 18c0 12.5 16 34 16 34s16-21.5 16-34c0-8.837-7.163-16-16-16z"
        fill="#EF4444" filter="url(#shadow-user)"/>
  <!-- Inner circle -->
  <circle cx="22" cy="18" r="7" fill="white" opacity="0.95"/>
  <!-- Person icon -->
  <circle cx="22" cy="15" r="3.2" fill="#EF4444"/>
  <path d="M14.5 26c0-4.142 3.358-7.5 7.5-7.5s7.5 3.358 7.5 7.5" 
        stroke="#EF4444" stroke-width="2.2" fill="none" stroke-linecap="round"/>
</svg>`;

export const AMBULANCE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <defs>
    <filter id="shadow-amb" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.45)"/>
    </filter>
  </defs>
  <!-- Outer circle -->
  <circle cx="26" cy="26" r="24" fill="#2563EB" filter="url(#shadow-amb)"/>
  <circle cx="26" cy="26" r="22" fill="#3B82F6"/>
  <!-- Ambulance body -->
  <rect x="12" y="19" width="28" height="16" rx="3" fill="white"/>
  <!-- Cab -->
  <rect x="29" y="20" width="9" height="11" rx="2" fill="#BFDBFE"/>
  <!-- Cross -->
  <rect x="19" y="23" width="10" height="3" rx="1.5" fill="#3B82F6"/>
  <rect x="23" y="19" width="3" height="10" rx="1.5" fill="#3B82F6"/>
  <!-- Wheels -->
  <circle cx="17" cy="36" r="3.5" fill="#1E3A8A"/>
  <circle cx="35" cy="36" r="3.5" fill="#1E3A8A"/>
  <circle cx="17" cy="36" r="1.8" fill="#93C5FD"/>
  <circle cx="35" cy="36" r="1.8" fill="#93C5FD"/>
  <!-- Siren light -->
  <rect x="18" y="16" width="16" height="4" rx="2" fill="#EF4444"/>
  <circle cx="22" cy="18" r="1.5" fill="#FCA5A5"/>
  <circle cx="30" cy="18" r="1.5" fill="#FCA5A5"/>
</svg>`;

export const HOSPITAL_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
  <defs>
    <filter id="shadow-hosp" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
    </filter>
  </defs>
  <!-- Pin body -->
  <path d="M24 2C15.163 2 8 9.163 8 18c0 12.5 16 34 16 34s16-21.5 16-34c0-8.837-7.163-16-16-16z"
        fill="#10B981" filter="url(#shadow-hosp)"/>
  <!-- Inner circle -->
  <circle cx="24" cy="18" r="8" fill="white" opacity="0.95"/>
  <!-- Hospital cross -->
  <rect x="20.5" y="12" width="7" height="12" rx="1.5" fill="#10B981"/>
  <rect x="17" y="15.5" width="14" height="7" rx="1.5" fill="#10B981"/>
</svg>`;
