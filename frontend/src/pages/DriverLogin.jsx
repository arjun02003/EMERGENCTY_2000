import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/.api";
import { Eye, EyeOff, Truck } from "lucide-react";

export default function DriverLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      setIsLoading(true);
      const response = await API.post("/driver/login", { email, password });
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("driver", JSON.stringify(response.data.driver));
      navigate("/driver-dashboard");
    } catch (error) {
      alert(error.response?.data?.message || "Driver login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-700 rounded-3xl shadow-2xl p-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Driver Login</h1>
          <p className="text-slate-400 text-sm">Access your assigned emergency and update trip status</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
              placeholder="driver@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-white font-semibold hover:bg-blue-500 disabled:opacity-70"
          >
            {isLoading ? "Signing in..." : "Log In"}
          </button>
        </form>
      </div>
    </div>
  );
}
