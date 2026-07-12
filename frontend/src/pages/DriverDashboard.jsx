import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import API from "../api/.api";
import { Truck, CheckCircle2 } from "lucide-react";
import LiveTrackingMap from "../components/LiveTrackingMap";

// How often to push GPS to the backend (ms).
// watchPosition fires as fast as the device allows — we rate-limit the API call.
const LOCATION_PUSH_INTERVAL_MS = 3000;

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Live tracking state ──────────────────────────────────────────────────
  const [driverLoc, setDriverLoc] = useState(null);      // driver's own GPS
  const [patientLoc, setPatientLoc] = useState(null);    // patient pickup location
  const [hospitalLoc, setHospitalLoc] = useState(null);  // destination hospital
  const [liveSpeed, setLiveSpeed] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  // Refs so callbacks always see latest values without re-subscribing
  const watchIdRef = useRef(null);
  const lastPushRef = useRef(0);
  const socketRef = useRef(null);
  const driverRef = useRef(null);

  // Keep driverRef in sync
  useEffect(() => { driverRef.current = driver; }, [driver]);

  const loadDriver = async () => {
    try {
      const response = await API.get("/driver/me");
      const d = response.data.driver;
      setDriver(d);

      // Seed patient + hospital locations from initial fetch
      if (d?.assignedEmergency?.pickupLocation) {
        setPatientLoc({
          latitude: d.assignedEmergency.pickupLocation.latitude,
          longitude: d.assignedEmergency.pickupLocation.longitude,
        });
      }
      if (d?.assignedEmergency?.assignedHospital) {
        // Hospital location is not always in the driver payload;
        // we'll try to get it from socket payloads as they arrive.
      }
    } catch (error) {
      console.error("Failed to load driver profile", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/driver-login");
      return;
    }
    loadDriver();
  }, [navigate]);

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!driver) return;
    const socketUrl = import.meta.env.VITE_API_URL || "https://emergency-2000.onrender.com";
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem("token") },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", `driver:${driver.id}`);
    });

    socket.on("driver_assignment", (payload) => {
      if (payload?.emergency) {
        setDriver((prev) => ({ ...prev, assignedEmergency: payload.emergency }));

        // Update map locations
        const em = payload.emergency;
        if (em.latitude && em.longitude) {
          setPatientLoc({ latitude: em.latitude, longitude: em.longitude });
        }
        if (em.assignedHospital?.location) {
          setHospitalLoc({
            latitude: em.assignedHospital.location.latitude,
            longitude: em.assignedHospital.location.longitude,
          });
        }
      }
    });

    // Driver receives their own location echo (optional UX confirmation)
    socket.on("ambulance_location_update", (payload) => {
      if (payload.hospitalLatitude && payload.hospitalLongitude && !hospitalLoc) {
        setHospitalLoc({ latitude: payload.hospitalLatitude, longitude: payload.hospitalLongitude });
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driver?.id]);

  // ── GPS watchPosition — continuous, never getCurrentPosition ─────────────
  const pushLocation = useCallback(async (lat, lng, spd) => {
    const now = Date.now();
    if (now - lastPushRef.current < LOCATION_PUSH_INTERVAL_MS) return; // rate-limit
    lastPushRef.current = now;

    try {
      await API.put("/driver/location", {
        latitude: lat,
        longitude: lng,
        speed: spd,
      });
    } catch (err) {
      // Non-fatal: log and continue
      console.warn("Location push failed:", err?.response?.data?.message || err.message);
    }
  }, []);

  useEffect(() => {
    if (!driver) return;

    const tripActive =
      driver.assignedEmergency &&
      [
        "AMBULANCE_ASSIGNED",
        "DRIVER_ACCEPTED",
        "DRIVER_ON_THE_WAY",
        "PATIENT_PICKED",
        "HOSPITAL_REACHED",
      ].includes(driver.assignedEmergency.status);

    if (!tripActive) {
      // Stop watching if trip ended or no trip
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by this browser.");
      return;
    }

    // Already watching
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        const speedKmh = speed != null ? speed * 3.6 : null; // m/s → km/h

        setDriverLoc({ latitude, longitude });
        setGpsError(null);
        if (speedKmh != null) setLiveSpeed(speedKmh);

        pushLocation(latitude, longitude, speedKmh);
      },
      (err) => {
        console.error("GPS watch error:", err);
        setGpsError("GPS access denied. Please enable location.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [driver, pushLocation]);

  const handleAction = async (endpoint) => {
    if (!driver) return;
    setActionLoading(true);
    try {
      const response = await API.put(`/driver/${endpoint}`);
      setDriver(response.data.driver);
    } catch (error) {
      alert(error.response?.data?.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    localStorage.removeItem("token");
    localStorage.removeItem("driver");
    navigate("/driver-login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-16 w-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p>Loading driver dashboard…</p>
        </div>
      </div>
    );
  }

  const emergency = driver?.assignedEmergency;
  const tripStatus = emergency?.status || "No Assignment";

  const nextAction = (() => {
    switch (tripStatus) {
      case "AMBULANCE_ASSIGNED":
        return { label: "Accept Trip", endpoint: "accept" };
      case "DRIVER_ACCEPTED":
        return { label: "Start Trip", endpoint: "start" };
      case "DRIVER_ON_THE_WAY":
        if (driver?.driverStatus === "Arrived at patient") {
          return { label: "Start Drive to Hospital", endpoint: "patient-picked" };
        }
        return { label: "Reached Patient Location", endpoint: "reach-patient" };
      case "PATIENT_PICKED":
        return { label: "Reach Hospital", endpoint: "reach-hospital" };
      case "HOSPITAL_REACHED":
        return { label: "Complete Trip", endpoint: "complete" };
      default:
        return null;
    }
  })();

  const showMap =
    !!emergency &&
    !!driverLoc &&
    [
      "DRIVER_ACCEPTED",
      "DRIVER_ON_THE_WAY",
      "PATIENT_PICKED",
      "HOSPITAL_REACHED",
    ].includes(tripStatus);

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Driver Dashboard</p>
            <h1 className="text-4xl font-bold text-white">Welcome, {driver?.driverName || "Driver"}</h1>
            <p className="text-slate-400 mt-2">Keep the emergency on track and update your trip milestones in real time.</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-2xl border border-slate-700 px-5 py-3 text-sm text-white hover:bg-slate-900"
          >
            Logout
          </button>
        </header>

        {/* GPS Status Banner */}
        {gpsError && (
          <div className="rounded-2xl bg-yellow-500/10 border border-yellow-500/30 px-5 py-3 text-yellow-400 text-sm">
            ⚠️ {gpsError}
          </div>
        )}
        {driverLoc && (
          <div className="rounded-2xl bg-green-500/10 border border-green-500/30 px-5 py-3 text-green-400 text-sm flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            GPS Active — Broadcasting location every {LOCATION_PUSH_INTERVAL_MS / 1000}s
            {liveSpeed != null && (
              <span className="ml-auto text-green-300 font-medium">{Math.round(liveSpeed)} km/h</span>
            )}
          </div>
        )}

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-3 text-blue-300 mb-5">
              <Truck className="w-7 h-7" />
              <h2 className="text-lg font-semibold">Vehicle &amp; Status</h2>
            </div>
            <div className="space-y-4 text-slate-300">
              <div>
                <p className="text-slate-400 text-sm">Vehicle Number</p>
                <p className="text-lg font-semibold">{driver?.vehicleNumber || "-"}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Vehicle Type</p>
                <p className="text-lg font-semibold">{driver?.vehicleType || "-"}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Current Status</p>
                <p className="text-lg font-semibold">{driver?.driverStatus || "Idle"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 xl:col-span-2">
            <div className="flex items-center gap-3 text-green-300 mb-5">
              <CheckCircle2 className="w-7 h-7" />
              <h2 className="text-lg font-semibold">Live Trip Overview</h2>
            </div>
            {emergency ? (
              <div className="grid gap-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/70 p-4 border border-slate-800">
                    <p className="text-slate-400 text-sm">Patient Name</p>
                    <p className="text-lg font-semibold">{emergency.patient.name}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/70 p-4 border border-slate-800">
                    <p className="text-slate-400 text-sm">Patient Phone</p>
                    <p className="text-lg font-semibold">{emergency.patient.phone}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/70 p-4 border border-slate-800">
                    <p className="text-slate-400 text-sm">Emergency Type</p>
                    <p className="text-lg font-semibold">{emergency.emergencyType}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/70 p-4 border border-slate-800">
                    <p className="text-slate-400 text-sm">Destination Hospital</p>
                    <p className="text-lg font-semibold">{emergency.assignedHospital?.name || "-"}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-950/70 p-4 border border-slate-800">
                    <p className="text-slate-400 text-sm">Pickup Location</p>
                    <p className="text-lg font-semibold">{emergency.pickupLocation.latitude}, {emergency.pickupLocation.longitude}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/70 p-4 border border-slate-800">
                    <p className="text-slate-400 text-sm">Assigned Hospital Phone</p>
                    <p className="text-lg font-semibold">{emergency.assignedHospital?.phone || "-"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-950/70 p-6 border border-slate-800 text-slate-400">
                <p>No assigned emergency found. You will see the latest assignment immediately after hospital assignment.</p>
              </div>
            )}
          </div>
        </section>

        {/* ── LIVE MAP ─────────────────────────────────────────────────────── */}
        {showMap && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              <h2 className="text-xl font-semibold text-white">Live Navigation</h2>
              <span className="ml-auto text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-medium">
                GPS ACTIVE
              </span>
            </div>

            {/* Phase indicator */}
            <div className="mb-4 flex gap-3">
              <div className={`flex-1 rounded-xl p-3 text-center text-xs font-semibold border ${
                tripStatus === "DRIVER_ON_THE_WAY" || tripStatus === "DRIVER_ACCEPTED"
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                  : "bg-slate-800 border-slate-700 text-slate-500"
              }`}>
                Phase 1: Drive to Patient
              </div>
              <div className={`flex-1 rounded-xl p-3 text-center text-xs font-semibold border ${
                tripStatus === "PATIENT_PICKED" || tripStatus === "HOSPITAL_REACHED"
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-500"
              }`}>
                Phase 2: Drive to Hospital
              </div>
            </div>

            <LiveTrackingMap
              userLocation={patientLoc}
              ambulanceLoc={driverLoc}
              hospitalLocation={hospitalLoc}
              emergencyStatus={tripStatus}
              speed={liveSpeed}
              mapHeight="460px"
              label={
                tripStatus === "PATIENT_PICKED" || tripStatus === "HOSPITAL_REACHED"
                  ? "🏥 Navigating to Hospital"
                  : "📍 Navigating to Patient"
              }
            />
          </section>
        )}

        {/* Trip status & action buttons */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-slate-400 text-sm">Current Trip Status</p>
              <p className="text-2xl font-semibold text-white">{tripStatus}</p>
            </div>
            {nextAction ? (
              <button
                onClick={() => handleAction(nextAction.endpoint)}
                disabled={actionLoading}
                className="rounded-2xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:opacity-70"
              >
                {actionLoading ? "Updating…" : nextAction.label}
              </button>
            ) : (
              <div className="rounded-2xl bg-slate-950/80 px-6 py-3 text-slate-400">No action available</div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Driver Name", value: driver?.driverName },
              { label: "Driver Phone", value: driver?.driverPhone },
              { label: "Vehicle Number", value: driver?.vehicleNumber },
              { label: "Vehicle Type", value: driver?.vehicleType },
              { label: "Assigned Hospital", value: emergency?.assignedHospital?.name || "-" },
              { label: "Assigned Emergency", value: emergency ? emergency.id : "-" },
              { label: "Patient Name", value: emergency?.patient.name || "-" },
              { label: "Patient Phone", value: emergency?.patient.phone || "-" },
              { label: "Emergency Type", value: emergency?.emergencyType || "-" },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl bg-slate-950/70 p-5 border border-slate-800">
                <p className="text-slate-400 text-sm">{item.label}</p>
                <p className="text-lg font-semibold mt-2">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
