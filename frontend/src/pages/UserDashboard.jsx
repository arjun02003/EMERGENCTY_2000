import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/.api";
import { io } from "socket.io-client";
import { 
  User, Phone, Clock, MapPin, Hospital, AlertTriangle, 
  History, LogOut, Heart, Ambulance, Mail, Shield, Calendar, Droplets
} from "lucide-react";
import LiveTrackingMap from "../components/LiveTrackingMap";

export default function UserDashboard() {
  // BUG FIX: Original code initialised `user` with hardcoded fake data
  // (\"Rahul Sharma\", \"O+\", etc.). These defaults were always visible because
  // the real data from localStorage never matched the expected nested shape
  // (user.emergencyContact.name vs the flat fields the backend actually returns).
  // Initialise as null; show a loading state until real data is ready.
  const [user, setUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [assignedHospital, setAssignedHospital] = useState(null);
  const [currentEmergencyId, setCurrentEmergencyId] = useState(null);
  const [ambulanceInfo, setAmbulanceInfo] = useState({
    number: "KA-05-AB-6789",
    driver: "Ramesh Kumar",
    eta: "8 mins",
    status: "On the way",
    location: "2.3 km away"
  });

  const [showSOSModal, setShowSOSModal] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // ── Live-tracking state ──────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState(null);       // captured at SOS
  const [ambulanceLoc, setAmbulanceLoc] = useState(null);       // updated via socket
  const [hospitalLoc, setHospitalLoc] = useState(null);         // from emergency data
  const [emergencyStatus, setEmergencyStatus] = useState(null); // e.g. DRIVER_ON_THE_WAY
  const [liveSpeed, setLiveSpeed] = useState(null);

  const navigate = useNavigate();

  // BUG FIX: Load user from localStorage first (instant), then verify/refresh
  // from the GET /me endpoint so the dashboard always shows MongoDB-accurate data.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      // Not logged in — send to login
      navigate("/login");
      return;
    }

    // Seed from localStorage immediately so the UI isn't blank
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (_) {
        // Corrupt data — ignore; /me will populate it
      }
    }

    // Fetch authoritative profile from MongoDB
    API.get("/auth/me")
      .then((res) => {
        if (res.data?.user) {
          setUser(res.data.user);
          // Keep localStorage in sync
          localStorage.setItem("user", JSON.stringify(res.data.user));
        }
      })
      .catch((err) => {
        console.error("Failed to refresh profile:", err.message);
        // If /me fails with 401 the response interceptor already clears
        // localStorage and redirects to /login — nothing extra needed here.
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, [navigate]);

  // Socket.IO: connect when user is available
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    const socketUrl = import.meta.env.VITE_API_URL || "https://emergency-2000.onrender.com";
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("join", `user:${user._id || user.id}`);
    });

    socket.on("emergency_status", (payload) => {
      console.log("Socket emergency_status:", payload);
      const { status, emergency } = payload;
      setEmergencyStatus(status);

      if (status === "SEARCHING_HOSPITAL") {
        setIsEmergencyActive(true);
        setAssignedHospital({ name: "Searching for hospitals...", distance: "Finding..." });
      } else if (status === "WAITING_FOR_ACCEPTANCE") {
        setIsEmergencyActive(true);
        setAssignedHospital({ name: "Awaiting hospital response", distance: "Finding..." });
      } else if (status === "AMBULANCE_ASSIGNED") {
        setIsEmergencyActive(true);
        setAssignedHospital({
          name: emergency.assignedHospital?.name || "Assigned Hospital",
          distance: emergency.distance ? `${emergency.distance.toFixed(2)} km` : "-",
        });
        setAmbulanceInfo({
          number: emergency.ambulance?.vehicleNumber || "-",
          driver: emergency.ambulance?.driverName || "-",
          eta: "Calculating",
          status: "On the way",
        });
        // Grab hospital coordinates for the map
        const hosp = emergency.assignedHospital;
        if (hosp?.location?.latitude && hosp?.location?.longitude) {
          setHospitalLoc({ latitude: hosp.location.latitude, longitude: hosp.location.longitude });
        }

        // ── Save to localStorage and go to full-screen tracking ────────────
        const storedUserLoc = JSON.parse(localStorage.getItem("sosLocation") || "null");
        localStorage.setItem("activeEmergency", JSON.stringify({
          emergencyId: emergency._id,
          status: "AMBULANCE_ASSIGNED",
          driverName:    emergency.ambulance?.driverName    || "-",
          driverPhone:   emergency.ambulance?.driverPhone   || "",
          vehicleNumber: emergency.ambulance?.vehicleNumber || "-",
          vehicleType:   emergency.ambulance?.vehicleType   || "Ambulance",
          hospitalName:  hosp?.name || "-",
          hospitalLat:   hosp?.location?.latitude  || null,
          hospitalLng:   hosp?.location?.longitude || null,
          patientLat: storedUserLoc?.latitude  || null,
          patientLng: storedUserLoc?.longitude || null,
        }));
        navigate("/tracking");
      } else if (status === "NO_HOSPITAL_AVAILABLE") {
        setIsEmergencyActive(false);
        setAssignedHospital(null);
        alert("No hospital available within the configured radius.");
      }
    });

    // ── Live ambulance location updates ─────────────────────────────────────
    socket.on("ambulance_location_update", (payload) => {
      console.log("ambulance_location_update:", payload);
      setAmbulanceLoc({ latitude: payload.latitude, longitude: payload.longitude });
      setEmergencyStatus(payload.emergencyStatus || null);
      if (payload.speed != null) setLiveSpeed(payload.speed);

      // If we didn't have hospital coords yet, try from payload
      if (!hospitalLoc && payload.hospitalLatitude && payload.hospitalLongitude) {
        setHospitalLoc({ latitude: payload.hospitalLatitude, longitude: payload.hospitalLongitude });
      }
    });

    return () => {
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // No demo hospital history; real history should come from server-side emergencies
  const emergencyHistory = [];

  // BUG FIX: Logout was a plain <Link to="/"> that navigated home but never
  // cleared localStorage. The user would appear logged in on any return visit.
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  const handleSOS = async () => {
    try {
      setIsActivating(true);

      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login first");
        setIsActivating(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          // Store patient GPS for tracking page
          setUserLocation({ latitude, longitude });
          localStorage.setItem("sosLocation", JSON.stringify({ latitude, longitude }));

          const response = await API.post(
            "/emergency/create",
            { latitude, longitude },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          alert(response.data.message || "Emergency SOS Activated!");

          setIsEmergencyActive(true);
          setCurrentEmergencyId(response.data.emergency?._id || null);
          // show searching state until socket updates arrive
          setAssignedHospital({ name: "Searching for hospitals...", distance: "Finding..." });

          setShowSOSModal(false);
          setIsActivating(false);
        },
        (error) => {
          console.error("Location error:", error);
          alert("Location access denied. Please allow location permission.");
          setIsActivating(false);
        }
      );

    } catch (error) {
      console.error("SOS Error:", error);
      alert(
        error.response?.data?.message || 
        "Failed to activate emergency. Please try again."
      );
      setIsActivating(false);
    }
  };

  // Helper: format createdAt date nicely
  const formatJoinedDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (_) {
      return "—";
    }
  };

  // Determine whether to show the map
  const showMap = isEmergencyActive && ambulanceLoc;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-red-500">🚑 SURAKSHA</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-2xl">
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <User size={18} className="text-red-500" />
              </div>
              <div>
                {/* BUG FIX: was user?.name with no null guard on user */}
                <p className="text-sm font-medium">{user?.name || "User"}</p>
                <p className="text-xs text-slate-400">User</p>
              </div>
            </div>
            {/* BUG FIX: was <Link to="/"> which never cleared localStorage */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 rounded-2xl text-sm font-medium transition-colors"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-4xl font-bold">
              Welcome back, {user?.name ? user.name.split(" ")[0] : "User"}
            </h2>
            <p className="text-slate-400 mt-1">Your safety is our priority</p>
          </div>
          <div className="text-sm text-slate-400">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* SOS Button - Prominent — UNCHANGED */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-10 flex flex-col items-center justify-center h-full min-h-[420px] relative overflow-hidden">
              <div className="absolute inset-0 bg-red-500/5" />
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-1 rounded-full text-sm mb-4">
                  <AlertTriangle size={18} /> EMERGENCY SOS
                </div>
                <h3 className="text-3xl font-bold mb-2">Need Immediate Help?</h3>
                <p className="text-slate-400 max-w-xs">One tap connects you to the nearest hospital and ambulance</p>
              </div>

              <button
                onClick={() => setShowSOSModal(true)}
                className="relative w-48 h-48 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all duration-200 flex items-center justify-center shadow-2xl shadow-red-600/50 group"
              >
                <div className="absolute inset-0 rounded-full border-8 border-red-400/30 animate-ping" />
                <div className="absolute inset-4 rounded-full border-4 border-red-400/50" />
                <div className="text-center z-10">
                  <AlertTriangle size={64} className="mx-auto mb-2" />
                  <p className="text-2xl font-bold tracking-wider">SOS</p>
                </div>
              </button>

              <p className="text-xs text-slate-500 mt-8 text-center">Press and hold for 2 seconds in real app</p>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Medical Profile — expanded to show all required user info */}
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Heart size={42} />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold">Medical Profile</h3>

                  {profileLoading ? (
                    <p className="text-slate-400 mt-4 text-sm">Loading profile...</p>
                  ) : (
                    <>
                      {/* Row 1 — Blood Group / Emergency Status */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
                        <div>
                          <p className="text-xs text-slate-400">BLOOD GROUP</p>
                          <p className="text-4xl font-bold text-red-500 mt-1">
                            {/* BUG FIX: was user?.bloodGroup which worked, but user
                                could still be the hardcoded fake object */}
                            {user?.bloodGroup || "N/A"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">EMERGENCY CONTACT</p>
                          {/* BUG FIX: was user?.emergencyContact?.name — backend returns
                              flat fields emergencyContactName / emergencyContactNumber */}
                          <p className="font-medium mt-1">
                            {user?.emergencyContactName || "Not Added"}
                          </p>
                          <p className="text-red-400 text-sm">
                            {user?.emergencyContactNumber || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">CURRENT STATUS</p>
                          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm mt-2 ${isEmergencyActive ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {isEmergencyActive ? "🚨 Active Emergency" : "✅ Safe"}
                          </div>
                        </div>
                      </div>

                      {/* Row 2 — Full user profile details (required by spec) */}
                      <div className="mt-6 pt-6 border-t border-slate-800">
                        <p className="text-xs text-slate-400 mb-4 font-semibold tracking-widest">ACCOUNT DETAILS</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                              <User size={14} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Full Name</p>
                              <p className="text-sm font-medium">{user?.name || "—"}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Mail size={14} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Email</p>
                              <p className="text-sm font-medium break-all">{user?.email || "—"}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Phone size={14} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Phone</p>
                              <p className="text-sm font-medium">{user?.phone || "—"}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Shield size={14} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Role</p>
                              <p className="text-sm font-medium capitalize">{user?.role || "user"}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Calendar size={14} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Joined Date</p>
                              <p className="text-sm font-medium">{formatJoinedDate(user?.createdAt)}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Droplets size={14} className="text-slate-400" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Blood Group</p>
                              <p className="text-sm font-medium">{user?.bloodGroup || "—"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Emergency Status — UNCHANGED */}
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-3">
                <Clock size={22} className="text-red-500" />
                Emergency Status
              </h3>
              
              {isEmergencyActive && assignedHospital ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-400 font-medium">ACTIVE EMERGENCY</p>
                      <p className="text-2xl font-bold mt-1">Ambulance Dispatched</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsEmergencyActive(false);
                        setAssignedHospital(null);
                      }}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm"
                    >
                      Cancel Alert
                    </button>
                  </div>
                  <div className="mt-6 pt-6 border-t border-red-500/20">
                    <div className="flex items-center gap-4">
                      <Hospital className="text-red-500" size={28} />
                      <div>
                        <p className="font-semibold">{assignedHospital.name}</p>
                        <p className="text-sm text-slate-400">{assignedHospital.distance} • Assigned</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <div className="text-6xl mb-4">🛡️</div>
                  <p className="text-xl font-medium">No Active Emergency</p>
                  <p className="mt-2">You're currently safe. The SOS button is ready if needed.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── LIVE TRACKING MAP — shown when emergency is active ─────────── */}
          {showMap && (
            <div className="lg:col-span-12">
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <h3 className="text-xl font-semibold">Live Ambulance Tracking</h3>
                  <span className="ml-auto text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-medium">
                    LIVE
                  </span>
                </div>

                {/* Ambulance info bar */}
                {ambulanceInfo.number !== "KA-05-AB-6789" && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Ambulance", value: ambulanceInfo.number },
                      { label: "Driver", value: ambulanceInfo.driver },
                      { label: "Status", value: ambulanceInfo.status },
                      { label: "Hospital", value: assignedHospital?.name || "—" },
                    ].map((item) => (
                      <div key={item.label} className="bg-slate-800 rounded-xl p-3">
                        <p className="text-xs text-slate-400">{item.label}</p>
                        <p className="text-sm font-semibold mt-0.5 truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <LiveTrackingMap
                  userLocation={userLocation}
                  ambulanceLoc={ambulanceLoc}
                  hospitalLocation={hospitalLoc}
                  emergencyStatus={emergencyStatus}
                  speed={liveSpeed}
                  mapHeight="480px"
                  label="🚑 Ambulance is on the way"
                />
              </div>
            </div>
          )}

          {/* Emergency Contacts & History — UNCHANGED layout, fixed field names */}
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
              <h3 className="text-xl font-semibold mb-6">Emergency Contacts</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between bg-slate-950 p-5 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                      <Phone className="text-red-500" />
                    </div>
                    <div>
                      {/* BUG FIX: was user?.emergencyContact?.name (nested object)
                          but backend returns flat emergencyContactName */}
                      <p className="font-medium">{user?.emergencyContactName || "Not Added"}</p>
                      <p className="text-slate-400">{user?.emergencyContactNumber || "—"}</p>
                    </div>
                  </div>
                  <button className="text-red-500 hover:text-red-400">Call Now</button>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-3">
                <History size={22} /> Emergency History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 text-sm text-slate-400">
                      <th className="text-left py-4">DATE</th>
                      <th className="text-left py-4">HOSPITAL</th>
                      <th className="text-left py-4">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {emergencyHistory.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-800 last:border-0">
                        <td className="py-5">
                          {entry.date}<br />
                          <span className="text-xs text-slate-500">{entry.time}</span>
                        </td>
                        <td className="py-5">{entry.hospital}</td>
                        <td className="py-5">
                          <span className="px-4 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SOS Modal — UNCHANGED */}
      {showSOSModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full p-8">
            <div className="text-center">
              <div className="mx-auto w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6">
                <AlertTriangle size={48} className="text-red-500" />
              </div>
              <h3 className="text-3xl font-bold mb-3">Activate Emergency SOS?</h3>
              <p className="text-slate-400 mb-8">
                This will immediately notify nearby hospitals, dispatch an ambulance, and alert your emergency contacts.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowSOSModal(false)}
                className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSOS}
                disabled={isActivating}
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-700/70 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {isActivating ? "Activating..." : "YES, SEND SOS"}
              </button>
            </div>
            <p className="text-center text-xs text-slate-500 mt-6">This action cannot be undone</p>
          </div>
        </div>
      )}
    </div>
  );
}