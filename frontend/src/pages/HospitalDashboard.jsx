import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/.api";
import { io } from "socket.io-client";
import { 
  Bed, Ambulance, AlertTriangle, User, CheckCircle, XCircle, LogOut, Bell, Edit, Trash 
} from "lucide-react";
import LiveTrackingMap from "../components/LiveTrackingMap";

export default function HospitalDashboard() {
  const [hospital, setHospital] = useState({
    name: "",
    status: "Online",
  });

  const [stats, setStats] = useState({
    availableBeds: 0,
    totalBeds: 0,
    availableAmbulances: 0,
    activeEmergencies: 0,
  });

  const [hospitalData, setHospitalData] = useState(null);
  const [resourceForm, setResourceForm] = useState({
    totalBeds: "",
    availableBeds: "",
    totalAmbulances: "",
    availableAmbulances: "",
  });
  const [isUpdatingResources, setIsUpdatingResources] = useState(false);

  const [ambulanceForm, setAmbulanceForm] = useState({
    driverName: "",
    driverPhone: "",
    driverEmail: "",
    password: "",
    vehicleNumber: "",
    vehicleType: "",
    status: "Available",
  });
  const [ambulances, setAmbulances] = useState([]);
  const [editingAmbulance, setEditingAmbulance] = useState(null);
  const [isSavingAmbulance, setIsSavingAmbulance] = useState(false);
  const [isDeletingAmbulance, setIsDeletingAmbulance] = useState(false);

  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState([]);

  // ── Live tracking state (hospital observes ambulance) ─────────────────────
  const [trackingAmbulanceLoc, setTrackingAmbulanceLoc] = useState(null);
  const [trackingPatientLoc, setTrackingPatientLoc] = useState(null);
  const [trackingHospitalLoc, setTrackingHospitalLoc] = useState(null);
  const [trackingStatus, setTrackingStatus] = useState(null);
  const [trackingSpeed, setTrackingSpeed] = useState(null);
  const [hasActiveLiveTrip, setHasActiveLiveTrip] = useState(false);

  // Fetch Pending Emergencies
  const fetchEmergencies = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await API.get(
        "/emergency/pending",
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const pendingEmergencies = res.data.emergencies || [];
      setEmergencies(pendingEmergencies);
      setStats((prev) => ({
        ...prev,
        activeEmergencies: pendingEmergencies.length,
      }));
    } catch (error) {
      console.error("Failed to fetch emergencies:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitalProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await API.get("/hospital/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const hospitalInfo = response.data.hospital;
      setHospitalData(hospitalInfo);
      setHospital({
        name: hospitalInfo.name,
        status: hospitalInfo.isOnline ? "Online" : "Offline",
      });
      setStats((prev) => ({
        ...prev,
        availableBeds: hospitalInfo.availableBeds,
        totalBeds: hospitalInfo.totalBeds,
        availableAmbulances: hospitalInfo.availableAmbulances,
      }));
      setResourceForm({
        totalBeds: hospitalInfo.totalBeds || "",
        availableBeds: hospitalInfo.availableBeds || "",
        totalAmbulances: hospitalInfo.totalAmbulances || "",
        availableAmbulances: hospitalInfo.availableAmbulances || "",
      });
    } catch (error) {
      console.error("Failed to load hospital profile:", error);
    }
  };

  const handleResourceChange = (e) => {
    const { name, value } = e.target;
    setResourceForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleResourceUpdate = async (e) => {
    e.preventDefault();
    if (!hospitalData) return;

    setIsUpdatingResources(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        totalBeds: Number(resourceForm.totalBeds),
        availableBeds: Number(resourceForm.availableBeds),
        totalAmbulances: Number(resourceForm.totalAmbulances),
        availableAmbulances: Number(resourceForm.availableAmbulances),
      };

      await API.put(`/hospital/${hospitalData._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await fetchHospitalProfile();
      alert("Resources updated successfully.");
    } catch (error) {
      console.error("Resource update failed:", error);
      alert(error.response?.data?.message || "Failed to update resources");
    } finally {
      setIsUpdatingResources(false);
    }
  };

  const fetchAmbulances = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await API.get("/ambulance/my-ambulances", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAmbulances(response.data.ambulances || []);
    } catch (error) {
      console.error("Failed to load ambulances:", error);
    }
  };

  const handleAmbulanceChange = (e) => {
    const { name, value } = e.target;
    setAmbulanceForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAmbulanceSubmit = async (e) => {
    e.preventDefault();
    setIsSavingAmbulance(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Please login again");

      const payload = {
        driverName: ambulanceForm.driverName,
        driverPhone: ambulanceForm.driverPhone,
        driverEmail: ambulanceForm.driverEmail,
        password: ambulanceForm.password,
        vehicleNumber: ambulanceForm.vehicleNumber,
        vehicleType: ambulanceForm.vehicleType,
        status: ambulanceForm.status,
      };

      if (editingAmbulance) {
        await API.put(`/ambulance/update/${editingAmbulance._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEditingAmbulance(null);
        alert("Ambulance updated successfully.");
      } else {
        await API.post("/ambulance/create", payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert("Ambulance added successfully.");
      }

      setAmbulanceForm({
        driverName: "",
        driverPhone: "",
        driverEmail: "",
        password: "",
        vehicleNumber: "",
        vehicleType: "",
        status: "Available",
      });
      await fetchAmbulances();
      await fetchHospitalProfile();
    } catch (error) {
      console.error("Ambulance save failed:", error);
      alert(error.response?.data?.message || error.message || "Failed to save ambulance");
    } finally {
      setIsSavingAmbulance(false);
    }
  };

  const handleAmbulanceEdit = (ambulance) => {
    setEditingAmbulance(ambulance);
    setAmbulanceForm({
      driverName: ambulance.driverName,
      driverPhone: ambulance.driverPhone,
      driverEmail: ambulance.driverEmail || "",
      password: "",
      vehicleNumber: ambulance.vehicleNumber,
      vehicleType: ambulance.vehicleType,
      status: ambulance.status,
    });
  };

  const handleAmbulanceDelete = async (id) => {
    if (!window.confirm("Delete this ambulance?")) return;
    setIsDeletingAmbulance(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Please login again");

      await API.delete(`/ambulance/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAmbulances();
      alert("Ambulance deleted successfully.");
    } catch (error) {
      console.error("Ambulance delete failed:", error);
      alert(error.response?.data?.message || error.message || "Failed to delete ambulance");
    } finally {
      setIsDeletingAmbulance(false);
    }
  };

  const renderAmbulanceStatus = (status) => {
    if (status === "Available") return "bg-emerald-500/15 text-emerald-300";
    if (status === "Busy") return "bg-amber-500/15 text-amber-300";
    return "bg-slate-500/15 text-slate-300";
  };

  useEffect(() => {
    const loadHospitalPage = async () => {
      await fetchHospitalProfile();
      await fetchAmbulances();
      await fetchEmergencies();
    };

    loadHospitalPage();
  }, []);

  // Socket.IO: listen for new emergency requests targeted to this hospital
  useEffect(() => {
    if (!hospitalData) return;
    const token = localStorage.getItem("token");
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const socket = io(socketUrl, { auth: { token }, transports: ["websocket"] });

    // join hospital room using current user id
    const storedUser = localStorage.getItem("user");
    let userId = null;
    if (storedUser) {
      try { userId = JSON.parse(storedUser)._id || JSON.parse(storedUser).id; } catch (_) { userId = null; }
    }
    if (userId) socket.emit("join", `hospital:${userId}`);

    socket.on("new_emergency_request", (payload) => {
      console.log("New emergency request via socket:", payload);
      fetchEmergencies();
    });

    // ── Live ambulance tracking update ────────────────────────────────────
    socket.on("ambulance_location_update", (payload) => {
      setHasActiveLiveTrip(true);
      setTrackingAmbulanceLoc({ latitude: payload.latitude, longitude: payload.longitude });
      setTrackingStatus(payload.emergencyStatus || null);
      if (payload.speed != null) setTrackingSpeed(payload.speed);
      if (payload.patientLatitude && payload.patientLongitude) {
        setTrackingPatientLoc({ latitude: payload.patientLatitude, longitude: payload.patientLongitude });
      }
      if (payload.hospitalLatitude && payload.hospitalLongitude) {
        setTrackingHospitalLoc({ latitude: payload.hospitalLatitude, longitude: payload.hospitalLongitude });
      }
    });

    return () => socket.disconnect();
  }, [hospitalData]);

  const handleAccept = async (id) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login again");
        return;
      }

      const response = await API.put(
        `/emergency/accept/${id}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.data.success) {
        alert(response.data.message || "No ambulance available.");
        return;
      }

      alert("Emergency Accepted Successfully");
      await fetchHospitalProfile();
      await fetchEmergencies(); // Refresh list

      const accepted = response.data.emergency;
      setQueue([
        ...queue,
        {
          id: Date.now(),
          patient: accepted.user?.name || "Unknown",
          status: accepted.status,
          ambulance: accepted.ambulance?.vehicleNumber || "Assigned",
          eta: accepted.eta || "15 mins",
        },
      ]);
    } catch (error) {
      console.error("Accept Error:", error);
      alert(error.response?.data?.message || "Failed to accept emergency");
    }
  };

  // Reject Emergency - Backend Call
  const handleReject = async (id) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login again");
        return;
      }

      await API.put(
        `/emergency/reject/${id}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      alert("Emergency Rejected");
      fetchEmergencies(); // Refresh list
    } catch (error) {
      console.error("Reject Error:", error);
      alert(error.response?.data?.message || "Failed to reject emergency");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <nav className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="text-3xl">🏥</div>
            <div>
              <h1 className="text-2xl font-bold">{hospital.name}</h1>
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${hospital.status === "Online" ? "bg-emerald-500" : "bg-red-500"} animate-pulse`} />
                <span className="text-emerald-400 font-medium">{hospital.status}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Bell size={22} className="cursor-pointer hover:text-red-400 transition-colors" />
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold">
                {emergencies.length}
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
        <div className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-4xl font-bold">Hospital Control Center</h2>
            <p className="text-slate-400 mt-1">Real-time Emergency Management</p>
          </div>
          <div className="text-slate-400">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm">AVAILABLE BEDS</p>
                <p className="text-5xl font-bold text-emerald-400 mt-3">{stats.availableBeds}</p>
              </div>
              <Bed size={42} className="text-emerald-500" />
            </div>
            <p className="text-xs text-slate-500 mt-4">Out of {stats.totalBeds} total beds</p>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm">AVAILABLE AMBULANCES</p>
                <p className="text-5xl font-bold text-blue-400 mt-3">{stats.availableAmbulances}</p>
              </div>
              <Ambulance size={42} className="text-blue-500" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm">ACTIVE EMERGENCIES</p>
                <p className="text-5xl font-bold text-red-500 mt-3">{emergencies.length || stats.activeEmergencies}</p>
              </div>
              <AlertTriangle size={42} className="text-red-500" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-sm">RESPONSE RATE</p>
                <p className="text-5xl font-bold text-amber-400 mt-3">94%</p>
              </div>
            </div>
            <p className="text-xs text-emerald-400 mt-6">↑ 3% from last week</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
            <div>
              <h3 className="text-2xl font-semibold">Resource Management</h3>
              <p className="text-slate-400 text-sm">Update beds and ambulances for your hospital account.</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm ${hospital.status === "Online" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
              {hospital.status}
            </span>
          </div>

          <form onSubmit={handleResourceUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Total Beds</label>
              <input
                type="number"
                name="totalBeds"
                value={resourceForm.totalBeds}
                onChange={handleResourceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                min={0}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Available Beds</label>
              <input
                type="number"
                name="availableBeds"
                value={resourceForm.availableBeds}
                onChange={handleResourceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                min={0}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Total Ambulances</label>
              <input
                type="number"
                name="totalAmbulances"
                value={resourceForm.totalAmbulances}
                onChange={handleResourceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                min={0}
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Available Ambulances</label>
              <input
                type="number"
                name="availableAmbulances"
                value={resourceForm.availableAmbulances}
                onChange={handleResourceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                min={0}
                required
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={isUpdatingResources}
                className="px-6 py-3 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {isUpdatingResources ? "Updating..." : "Update Resources"}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
            <div>
              <h3 className="text-2xl font-semibold">Ambulance Management</h3>
              <p className="text-slate-400 text-sm">Manage ambulances tied to your hospital account.</p>
            </div>
            <span className="text-slate-400 text-sm">{editingAmbulance ? "Edit Ambulance" : "Add New Ambulance"}</span>
          </div>

          <form onSubmit={handleAmbulanceSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Driver Name</label>
              <input
                type="text"
                name="driverName"
                value={ambulanceForm.driverName}
                onChange={handleAmbulanceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Driver Phone</label>
              <input
                type="text"
                name="driverPhone"
                value={ambulanceForm.driverPhone}
                onChange={handleAmbulanceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Driver Email</label>
              <input
                type="email"
                name="driverEmail"
                value={ambulanceForm.driverEmail}
                onChange={handleAmbulanceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                placeholder="driver@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Driver Password</label>
              <input
                type="password"
                name="password"
                value={ambulanceForm.password}
                onChange={handleAmbulanceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                placeholder="Leave blank to keep existing password"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Vehicle Number</label>
              <input
                type="text"
                name="vehicleNumber"
                value={ambulanceForm.vehicleNumber}
                onChange={handleAmbulanceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Vehicle Type</label>
              <input
                type="text"
                name="vehicleType"
                value={ambulanceForm.vehicleType}
                onChange={handleAmbulanceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Status</label>
              <select
                name="status"
                value={ambulanceForm.status}
                onChange={handleAmbulanceChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-white"
              >
                <option value="Available">Available</option>
                <option value="Busy">Busy</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
            <div className="lg:col-span-3 flex justify-end">
              {editingAmbulance && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAmbulance(null);
                    setAmbulanceForm({
                      driverName: "",
                      driverPhone: "",
                      vehicleNumber: "",
                      vehicleType: "",
                      status: "Available",
                    });
                  }}
                  className="px-6 py-3 rounded-2xl border border-slate-700 text-slate-300 hover:bg-slate-800 mr-3"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSavingAmbulance}
                className="px-6 py-3 rounded-2xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {isSavingAmbulance ? "Saving..." : editingAmbulance ? "Save Changes" : "Add Ambulance"}
              </button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700 text-left">
              <thead className="bg-slate-900">
                <tr>
                  <th className="py-4 px-4 text-sm text-slate-400">Driver</th>
                  <th className="py-4 px-4 text-sm text-slate-400">Phone</th>
                  <th className="py-4 px-4 text-sm text-slate-400">Vehicle</th>
                  <th className="py-4 px-4 text-sm text-slate-400">Type</th>
                  <th className="py-4 px-4 text-sm text-slate-400">Status</th>
                  <th className="py-4 px-4 text-sm text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ambulances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                      No ambulances added yet.
                    </td>
                  </tr>
                ) : (
                  ambulances.map((ambulance) => (
                    <tr key={ambulance._id} className="bg-slate-950">
                      <td className="py-4 px-4 text-sm text-white">{ambulance.driverName}</td>
                      <td className="py-4 px-4 text-sm text-slate-300">{ambulance.driverPhone}</td>
                      <td className="py-4 px-4 text-sm text-slate-300">{ambulance.vehicleNumber}</td>
                      <td className="py-4 px-4 text-sm text-slate-300">{ambulance.vehicleType}</td>
                      <td className="py-4 px-4 text-sm">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${renderAmbulanceStatus(ambulance.status)}`}>
                          {ambulance.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-300 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAmbulanceEdit(ambulance)}
                          className="rounded-2xl border border-slate-700 px-3 py-2 hover:bg-slate-800"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAmbulanceDelete(ambulance._id)}
                          disabled={isDeletingAmbulance}
                          className="rounded-2xl border border-red-500 px-3 py-2 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Incoming Requests */}
          <div className="xl:col-span-7">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 mb-6">
              <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <AlertTriangle className="text-red-500" /> 
                Incoming Emergency Requests ({emergencies.length})
              </h3>

              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-16">Loading emergencies...</div>
                ) : emergencies.length > 0 ? (
                  emergencies.map((emergency) => (
                    <div key={emergency._id} className="bg-slate-950 border border-slate-700 rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center">
                            <User size={28} className="text-red-400" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg">{emergency.user?.name || "Unknown Patient"}</h4>
                            <p className="text-slate-400">
                              {emergency.user?.phone || "-"} • {new Date(emergency.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-6 mt-5 text-sm">
                          <div>
                            <span className="text-slate-400">Blood:</span>{" "}
                            <span className="font-medium">{emergency.user?.bloodGroup || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Location:</span>{" "}
                            <span className="font-medium">{emergency.latitude}, {emergency.longitude}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button
                          onClick={() => handleReject(emergency._id)}
                          className="px-8 py-3 border border-red-500/30 hover:bg-red-500/10 text-red-400 rounded-2xl transition-colors flex items-center gap-2"
                        >
                          <XCircle size={18} /> Reject
                        </button>
                        <button
                          onClick={() => handleAccept(emergency._id)}
                          className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-2xl transition-colors flex items-center gap-2 font-semibold"
                        >
                          <CheckCircle size={18} /> Accept
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-slate-400">
                    No new emergency requests
                  </div>
                )}
              </div>
            </div>

            {/* Ambulance Fleet */}
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8">
              <h3 className="text-2xl font-semibold mb-6">Ambulance Fleet</h3>
              {/* ... same as before ... */}
            </div>
          </div>

          {/* Right Sidebar - Live Tracking + Queue */}
          <div className="xl:col-span-5 space-y-6">

            {/* ── LIVE AMBULANCE TRACKING MAP ─────────────────────────────── */}
            {hasActiveLiveTrip && trackingAmbulanceLoc ? (
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                  <h3 className="text-xl font-semibold">Live Ambulance Tracking</h3>
                  <span className="ml-auto text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-medium">LIVE</span>
                </div>
                <p className="text-slate-400 text-sm mb-4">Watching your ambulance in real time</p>
                <LiveTrackingMap
                  userLocation={trackingPatientLoc}
                  ambulanceLoc={trackingAmbulanceLoc}
                  hospitalLocation={trackingHospitalLoc}
                  emergencyStatus={trackingStatus}
                  speed={trackingSpeed}
                  mapHeight="380px"
                  label="🏥 Hospital View — Live"
                />
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xl font-semibold">Live Ambulance Tracking</h3>
                </div>
                <div className="rounded-2xl bg-slate-950 border border-slate-800 p-10 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <div className="text-4xl">🚑</div>
                  <p className="text-sm text-center">Live tracking will appear here once a driver starts their trip and begins broadcasting GPS.</p>
                </div>
              </div>
            )}

            {/* Queue */}
            {queue.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
                <h3 className="text-xl font-semibold mb-4">Active Queue</h3>
                <div className="space-y-3">
                  {queue.map((item) => (
                    <div key={item.id} className="bg-slate-950 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.patient}</p>
                        <p className="text-xs text-slate-400">{item.status}</p>
                      </div>
                      <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full">{item.ambulance}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}