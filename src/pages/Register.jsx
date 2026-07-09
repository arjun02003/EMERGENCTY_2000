import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react";
import axios from "axios";

export default function Register() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    fullName: "",
    hospitalName: "",
    email: "",
    phone: "",
    bloodGroup: "",
    emergencyContactName: "",
    emergencyContactNumber: "",
    hospitalAddress: "",
    totalBeds: "",
    availableBeds: "",
    availableAmbulances: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Common fields
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";

    if (!formData.phone) newErrors.phone = "Phone number is required";
    else if (formData.phone.length < 10) newErrors.phone = "Phone number must be at least 10 digits";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 6) newErrors.password = "Password must be at least 6 characters";

    if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm password";
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    if (!formData.fullName) newErrors.fullName = "Full name is required";
    if (!formData.bloodGroup) newErrors.bloodGroup = "Blood group is required";
    if (!formData.emergencyContactName) newErrors.emergencyContactName = "Emergency contact name is required";
    if (!formData.emergencyContactNumber) newErrors.emergencyContactNumber = "Emergency contact number is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await axios.post(
        "https://suraksha-emergency-4.onrender.com/api/auth/register",
        {
          name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: "user",
        }
      );

      alert(response.data.message);
      setSuccess(true);

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error) {
      alert(
        error.response?.data?.message || "Registration Failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-red-500">🚑 SURAKSHA</h1>
        </div>
        <Link
          to="/"
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Home
        </Link>
      </nav>

      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
        <div className="w-full max-w-2xl">
          {/* Glassmorphism Card */}
          <div className="bg-slate-900/70 backdrop-blur-xl border border-slate-700 rounded-3xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-2">User Registration</h2>
              <p className="text-slate-400 text-lg">
                Join the Smart Emergency Response Network as a user
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                      placeholder="John Doe"
                    />
                    {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Blood Group</label>
                      <select
                        name="bloodGroup"
                        value={formData.bloodGroup}
                        onChange={handleChange}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                      >
                        <option value="">Select Blood Group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                      {errors.bloodGroup && <p className="text-red-500 text-sm mt-1">{errors.bloodGroup}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Emergency Contact Name</label>
                    <input
                      type="text"
                      name="emergencyContactName"
                      value={formData.emergencyContactName}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                      placeholder="Jane Doe"
                    />
                    {errors.emergencyContactName && <p className="text-red-500 text-sm mt-1">{errors.emergencyContactName}</p>}
                  </div>

                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Emergency Contact Number</label>
                    <input
                      type="tel"
                      name="emergencyContactNumber"
                      value={formData.emergencyContactNumber}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                      placeholder="+91 98765 43210"
                    />
                    {errors.emergencyContactNumber && <p className="text-red-500 text-sm mt-1">{errors.emergencyContactNumber}</p>}
                  </div>

              {/* Common Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                    placeholder="+91 98765 43210"
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
                </div>
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-red-500"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-3.5 text-slate-400 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-700/50 transition-all py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 mt-8"
              >
                {isLoading ? (
                  <>Processing...</>
                ) : success ? (
                  <>
                    <CheckCircle size={24} /> Account Created Successfully
                  </>
                ) : (
                  "Register Now"
                )}
              </button>
            </form>

            <div className="text-center mt-6">
              <p className="text-slate-400">
                Already have an account?{" "}
                <Link to="/login" className="text-red-500 hover:underline font-medium">
                  Login here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
