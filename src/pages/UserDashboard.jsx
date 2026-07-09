import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  User, Phone, Clock, MapPin, Hospital, AlertTriangle, 
  History, LogOut, Heart, Ambulance 
} from "lucide-react";

export default function UserDashboard() {
  const [user, setUser] = useState({
    name: "Rahul Sharma",
    bloodGroup: "O+",
    emergencyContact: { name: "Priya Sharma", phone: "+91 98765 43210" }
  });

  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [assignedHospital, setAssignedHospital] = useState(null);
  const [ambulanceInfo, setAmbulanceInfo] = useState({
    number: "KA-05-AB-6789",
    driver: "Ramesh Kumar",
    eta: "8 mins",
    status: "On the way",
    location: "2.3 km away"
  });

  const [showSOSModal, setShowSOSModal] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const emergencyHistory = [
    {
      id: 1,
      date: "18 Jun 2026",
      hospital: "Apollo Hospital, Bangalore",
      status: "Resolved",
      time: "14:32"
    },
    {
      id: 2,
      date: "05 May 2026",
      hospital: "Fortis Hospital",
      status: "Resolved",
      time: "09:15"
    },
  ];

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

          const response = await axios.post(
            "https://suraksha-emergency-4.onrender.com/api/emergency/create",
            { latitude, longitude },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          alert(response.data.message || "Emergency SOS Activated!");

          setIsEmergencyActive(true);
          
          // ✅ Updated according to your new backend response structure
          setAssignedHospital({
            name:
              response.data.assignedHospital?.name || "Nearest Hospital",
            distance:
              response.data.emergency?.distance
                ? `${response.data.emergency.distance.toFixed(2)} km`
                : "Finding...",
          });

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
                <p className="text-sm font-medium">{user?.name || "User"}</p>
                <p className="text-xs text-slate-400">User</p>
              </div>
            </div>
            <Link
              to="/"
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 rounded-2xl text-sm font-medium transition-colors"
            >
              <LogOut size={18} />
              Logout
            </Link>
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
          {/* SOS Button - Prominent */}
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

          {/* Medical Profile */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Heart size={42} />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-semibold">Medical Profile</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
                    <div>
                      <p className="text-xs text-slate-400">BLOOD GROUP</p>
                      <p className="text-4xl font-bold text-red-500 mt-1">
                        {user?.bloodGroup || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">EMERGENCY CONTACT</p>
                      <p className="font-medium mt-1">
                        {user?.emergencyContact?.name || "Not Added"}
                      </p>
                      <p className="text-red-400 text-sm">
                        {user?.emergencyContact?.phone || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">CURRENT STATUS</p>
                      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm mt-2 ${isEmergencyActive ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {isEmergencyActive ? "🚨 Active Emergency" : "✅ Safe"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Status */}
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

          {/* Emergency Contacts & History */}
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
                      <p className="font-medium">{user?.emergencyContact?.name || "Not Added"}</p>
                      <p className="text-slate-400">{user?.emergencyContact?.phone || "-"}</p>
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

      {/* SOS Modal */}
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