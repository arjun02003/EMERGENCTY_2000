import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Shield, User, Hospital, UserCog } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  
  const [selectedRole, setSelectedRole] = useState('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const roles = [
    { id: 'user', label: 'User', icon: User },
    { id: 'hospital', label: 'Hospital', icon: Hospital },
    { id: 'admin', label: 'Admin', icon: UserCog },
  ];

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      setIsLoading(true);

      const response = await axios.post(
        "https://suraksha-emergency-4.onrender.com/api/auth/login",
        {
          email,
          password,
          role: selectedRole,
        }
      );

      // Save JWT Token
      localStorage.setItem("token", response.data.token);

      // Save User
      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      alert(response.data.message);

      // Role Based Navigation
      if (response.data.user.role === "user") {
        navigate("/dashboard");
      } else if (response.data.user.role === "hospital") {
        navigate("/hospital-dashboard");
      } else {
        navigate("/admin-dashboard");
      }

    } catch (error) {
      alert(
        error.response?.data?.message || "Login Failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(at_50%_30%,rgba(59,130,246,0.08)_0%,transparent_50%)]"></div>
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Header */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tighter">SURAKSHA</h1>
              <p className="text-blue-400 text-sm -mt-1 font-medium">EMERGENCY RESPONSE</p>
            </div>
          </div>
          <p className="text-zinc-400 text-center max-w-xs">
            Secure access to India's unified emergency response platform
          </p>
        </div>

        {/* Glassmorphism Card */}
        <div className="backdrop-blur-xl bg-zinc-900/70 border border-zinc-700/80 rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-white">Sign In</h2>
            <p className="text-zinc-400 mt-1">Select your role to continue</p>
          </div>

          {/* Role Selection */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl transition-all duration-200 border ${
                    isSelected
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                  <span className="text-sm font-medium">{role.label}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl px-4 py-3.5 text-white placeholder:text-zinc-500 outline-none transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl px-4 py-3.5 text-white placeholder:text-zinc-500 outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-400">Remember me</span>
              </label>
              <a
                href="#"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Forgot Password?
              </a>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all font-semibold text-white py-4 rounded-2xl text-lg shadow-lg shadow-blue-500/40 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>

            {/* Footer Links */}
            <div className="text-center pt-4 border-t border-zinc-800">
              <p className="text-zinc-500 text-sm">
                Don't have an account?{' '}
                <a href="/register" className="text-blue-400 hover:text-blue-300 font-medium">
                  Register here
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Security Note */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-zinc-500 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" />
            SECURED BY 256-BIT ENCRYPTION • ISO 27001 CERTIFIED
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;