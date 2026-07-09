import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "../pages/Landing";
import Login from "../pages/Login";
import Register from "../pages/Register";
import SOS from "../pages/SOS";
import UserDashboard from "../pages/UserDashboard";
import HospitalDashboard from "../pages/HospitalDashboard";
import AdminDashboard from "../pages/AdminDashboard";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Direct SOS route so Landing's SOS link resolves */}
        <Route path="/sos" element={<SOS />} />

        {/* User */}
        <Route path="/dashboard" element={<UserDashboard />} />

        {/* Hospital */}
        <Route path="/hospital-dashboard" element={<HospitalDashboard />} />

        {/* Admin */}
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}