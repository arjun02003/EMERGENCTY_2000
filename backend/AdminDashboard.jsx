import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { 
  Users, Hospital, AlertTriangle, Ambulance, 
  TrendingUp, Activity, LogOut, Shield, Clock 
} from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalHospitals: 0,
    activeEmergencies: 0,
    availableAmbulances: 0,
  });

  const [recentRequests] = useState([]);

  const [hospitals, setHospitals] = useState([]);
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [hospitalForm, setHospitalForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    emergencyTypes: "",
  });
  const [isSubmittingHospital, setIsSubmittingHospital] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const showSuccessToast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const fetchHospitals = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("http://https://suraksha-emergency-5.onrender.com:5000/api/hospital", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setHospitals(response.data.hospitals || []);
    } catch (error) {
      console.error("Failed to load hospitals", error);
    }
  };

  const handleHospitalChange = (e) => {
    const { name, value } = e.target;
    setHospitalForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateHospital = async (e) => {
    e.preventDefault();
    setIsSubmittingHospital(true);

    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...hospitalForm,
        emergencyTypes: hospitalForm.emergencyTypes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };

      await axios.post("https://suraksha-emergency-4.onrender.com/api/admin/create-hospital", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setHospitalForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        address: "",
        emergencyTypes: "",
      });
      setShowHospitalModal(false);
      await fetchHospitals();
      showSuccessToast("Hospital created successfully.");
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create hospital");
      console.error(error);
    } finally {
      setIsSubmittingHospital(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {showToast && (
        <div className="fixed top-5 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 rounded-3xl border border-emerald-500 bg-emerald-500/10 px-5 py-4 text-emerald-200 shadow-2xl backdrop-blur-xl">
          {toastMessage}
        </div>
      )}
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-red-500">🚑 SURAKSHA</h1>
            <div className="px-4 py-1 bg-slate-900 rounded-full text-sm font-medium text-slate-300">ADMIN PANEL</div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-slate-900 px-5 py-2 rounded-2xl">
              <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center">
                <Shield size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium">Admin</p>
                <p className="text-xs text-emerald-400">System Online</p>
              </div>
            </div>
            <Link
              to="/"
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 rounded-2xl transition-colors"
            >
              <LogOut size={18} />
              Logout
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex justify-between items-end mb-10">
          <div>
            <h2 className="text-4xl font-bold">System Overview</h2>
            <p className="text-slate-400 mt-1">Real-time Emergency Response Monitoring</p>
          </div>
          <div className="text-slate-400 text-sm">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
            <div className="flex justify-between">
              <div>
                <p className="text-slate-400">TOTAL USERS</p>
                <p className="text-5xl font-bold mt-4">{stats.totalUsers.toLocaleString()}</p>
              </div>
              <Users size={48} className="text-blue-500" />
            </div>
            <p className="text-emerald-400 text-sm mt-4 flex items-center gap-1">
              <TrendingUp size={16} /> +12% this month
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
            <div className="flex justify-between">
              <div>
                <p className="text-slate-400">REGISTERED HOSPITALS</p>
                <p className="text-5xl font-bold mt-4">{stats.totalHospitals}</p>
              </div>
              <Hospital size={48} className="text-emerald-500" />
            </div>
            <p className="text-emerald-400 text-sm mt-4 flex items-center gap-1">
              <TrendingUp size={16} /> +4 new this week
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
            <div className="flex justify-between">
              <div>
                <p className="text-slate-400">ACTIVE EMERGENCIES</p>
                <p className="text-5xl font-bold mt-4 text-red-500">{stats.activeEmergencies}</p>
              </div>
              <AlertTriangle size={48} className="text-red-500" />
            </div>
            <p className="text-slate-400 text-sm mt-4">Across all regions</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
            <div className="flex justify-between">
              <div>
                <p className="text-slate-400">AVAILABLE AMBULANCES</p>
                <p className="text-5xl font-bold mt-4 text-blue-400">{stats.availableAmbulances}</p>
              </div>
              <Ambulance size={48} className="text-blue-500" />
            </div>
            <p className="text-emerald-400 text-sm mt-4">82% fleet utilization</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 mb-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-semibold">Hospital Management</h3>
              <p className="text-slate-400 text-sm">Create and view hospital accounts</p>
            </div>
            <button
              onClick={() => setShowHospitalModal(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-2xl px-5 py-3 text-sm font-semibold"
            >
              + Add Hospital
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="py-4 px-3">Hospital Name</th>
                  <th className="py-4 px-3">Email</th>
                  <th className="py-4 px-3">Available Beds</th>
                  <th className="py-4 px-3">Available Ambulances</th>
                  <th className="py-4 px-3">Status</th>
                  <th className="py-4 px-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {hospitals.map((h) => (
                  <tr key={h._id} className="hover:bg-slate-800/50">
                    <td className="py-4 px-3 font-medium">{h.name}</td>
                    <td className="py-4 px-3 text-slate-400">{h.email}</td>
                    <td className="py-4 px-3">{h.availableBeds}/{h.totalBeds}</td>
                    <td className="py-4 px-3">{h.availableAmbulances}/{h.totalAmbulances}</td>
                    <td className="py-4 px-3">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${h.isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                        {h.isOnline ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="py-4 px-3">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-2xl border border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {hospitals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">No hospitals found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Recent Emergency Requests */}
          <div className="xl:col-span-7">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
              <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <Clock className="text-red-500" /> Recent Emergency Requests
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-sm">
                      <th className="text-left py-4">PATIENT</th>
                      <th className="text-left py-4">HOSPITAL</th>
                      <th className="text-left py-4">TYPE</th>
                      <th className="text-left py-4">TIME</th>
                      <th className="text-left py-4">SEVERITY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {recentRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-800/50">
                        <td className="py-5 font-medium">{req.patient}</td>
                        <td className="py-5 text-slate-400">{req.hospital}</td>
                        <td className="py-5">{req.type}</td>
                        <td className="py-5 text-sm text-slate-400">{req.time}</td>
                        <td className="py-5">
                          <span className={`px-4 py-1 text-xs font-medium rounded-full
                            ${req.status === "Critical" ? "bg-red-500/20 text-red-400" : 
                              req.status === "High" ? "bg-orange-500/20 text-orange-400" : 
                              "bg-yellow-500/20 text-yellow-400"}`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {showHospitalModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-3xl bg-slate-950 border border-slate-700 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-semibold">Add Hospital</h3>
                    <p className="text-slate-400 text-sm">Create a new hospital account for the system</p>
                  </div>
                  <button
                    onClick={() => setShowHospitalModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={handleCreateHospital} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Hospital Name</label>
                      <input
                        name="name"
                        value={hospitalForm.name}
                        onChange={handleHospitalChange}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Hospital Email</label>
                      <input
                        type="email"
                        name="email"
                        value={hospitalForm.email}
                        onChange={handleHospitalChange}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Hospital Password</label>
                      <input
                        type="password"
                        name="password"
                        value={hospitalForm.password}
                        onChange={handleHospitalChange}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Phone Number</label>
                      <input
                        name="phone"
                        value={hospitalForm.phone}
                        onChange={handleHospitalChange}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-slate-400 mb-2">Address</label>
                      <input
                        name="address"
                        value={hospitalForm.address}
                        onChange={handleHospitalChange}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-slate-400 mb-2">Emergency Types</label>
                      <input
                        name="emergencyTypes"
                        value={hospitalForm.emergencyTypes}
                        onChange={handleHospitalChange}
                        placeholder="Trauma, Cardiac, ICU"
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowHospitalModal(false)}
                      className="px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingHospital}
                      className="px-6 py-3 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
                    >
                      {isSubmittingHospital ? "Creating..." : "Create Hospital"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Analytics & System Health */}
          <div className="xl:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Emergency Trends Chart Placeholder */}
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold">Emergency Trends</h3>
                <div className="text-sm text-slate-400">Last 30 Days</div>
              </div>
              <div className="h-80 bg-slate-950 rounded-2xl flex items-center justify-center border border-dashed border-slate-700">
                <div className="text-center">
                  <TrendingUp size={64} className="mx-auto text-slate-500 mb-4" />
                  <p className="text-slate-400">Emergency Trends Chart</p>
                  <p className="text-xs text-slate-500 mt-2">Interactive Chart Integration Coming Soon</p>
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
              <h3 className="text-2xl font-semibold mb-8 flex items-center gap-3">
                <Activity className="text-emerald-500" /> System Health
              </h3>
              
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 bg-emerald-500 rounded-full animate-pulse" />
                    <span>Server Status</span>
                  </div>
                  <span className="text-emerald-400 font-medium">Healthy</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 bg-emerald-500 rounded-full animate-pulse" />
                    <span>Database Connection</span>
                  </div>
                  <span className="text-emerald-400 font-medium">Connected</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 bg-amber-500 rounded-full" />
                    <span>GPS Services</span>
                  </div>
                  <span className="text-amber-400 font-medium">Stable</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-5 h-5 bg-emerald-500 rounded-full animate-pulse" />
                    <span>Notification Service</span>
                  </div>
                  <span className="text-emerald-400 font-medium">Operational</span>
                </div>

                <div className="pt-6 border-t border-slate-700">
                  <p className="text-sm text-slate-400">Average Response Time: <span className="text-emerald-400 font-semibold">2.4 minutes</span></p>
                  <p className="text-xs text-slate-500 mt-1">Last updated just now</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}