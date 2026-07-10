import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import API from "../api/.api";
import { Truck, User, Phone, MapPin, Hospital, Clock, Flag, CheckCircle2 } from "lucide-react";

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadDriver = async () => {
    try {
      const response = await API.get("/driver/me");
      setDriver(response.data.driver);
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

  useEffect(() => {
    if (!driver) return;
    const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem("token") },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("join", `driver:${driver.id}`);
    });

    socket.on("driver_assignment", (payload) => {
      if (payload?.emergency) {
        setDriver((prev) => ({ ...prev, assignedEmergency: payload.emergency }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [driver]);

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
        return { label: "Reached Patient", endpoint: "reach-patient" };
      case "PATIENT_PICKED":
        return { label: "Reach Hospital", endpoint: "reach-hospital" };
      case "HOSPITAL_REACHED":
        return { label: "Complete Trip", endpoint: "complete" };
      default:
        return null;
    }
  })();

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

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex items-center gap-3 text-blue-300 mb-5">
              <Truck className="w-7 h-7" />
              <h2 className="text-lg font-semibold">Vehicle & Status</h2>
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
