import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Navbar */}
      <nav className="fixed top-0 w-full bg-slate-950/95 backdrop-blur-md border-b border-slate-800 z-50">
        <div className="max-w-xl mx-auto px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-2xl flex items-center justify-center text-2xl">
              🚑
            </div>
            <h1 className="text-2xl font-bold text-red-500 tracking-tight">SURAKSHA</h1>
          </div>
          
          <div className="flex gap-3">
            <Link to="/login">
              <button className="px-5 py-2 text-sm rounded-xl border border-slate-700 hover:bg-slate-900">Login</button>
            </Link>
            <Link to="/register">
              <button className="px-5 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-xl font-medium">Sign Up</button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-12 px-5 text-center max-w-xl mx-auto">
        <div className="mb-6 inline-block bg-red-900/30 text-red-400 text-xs font-medium px-4 py-2 rounded-3xl border border-red-500/30">
          24×7 EMERGENCY NETWORK
        </div>

        <h1 className="text-5xl font-bold leading-tight tracking-tighter mb-6">
          Ek Tap Mein<br />
          <span className="text-red-500">Madad Mil Jayegi</span>
        </h1>

        <p className="text-gray-400 text-lg mb-10">
          Ambulance • Nearest Hospital • Live Tracking • Family Alert
        </p>

        {/* Big SOS Button */}
        <Link to="/sos" className="block mb-4">
          <button className="w-full py-8 bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-3xl text-3xl font-bold shadow-2xl shadow-red-600/60 transition-all active:scale-[0.97] flex items-center justify-center gap-4">
            🚨 SOS BUTTON
          </button>
        </Link>

        <p className="text-xs text-gray-500">Average response time: 7 minutes</p>
      </section>

      {/* Features */}
      <section className="px-5 pb-20 max-w-xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Key Features</h2>

        <div className="space-y-4">
          {[
            { icon: "🚨", title: "One Tap SOS", desc: "Live location, photo & voice note automatically bhejta hai" },
            { icon: "🏥", title: "Smart Hospital Finder", desc: "Aapke case ke hisaab se best hospital + bed availability" },
            { icon: "🚑", title: "Real-time Tracking", desc: "Ambulance ko live track karo with ETA" },
            { icon: "📍", title: "Automatic GPS", desc: "Offline mode mein bhi location share karta hai" },
            { icon: "👨‍👩‍👧", title: "Instant Family Alert", desc: "Emergency contacts ko SMS + Call" }
          ].map((f, i) => (
            <div key={i} className="bg-slate-900 rounded-3xl p-5 flex gap-4 border border-slate-800 hover:border-red-500/30 transition-all">
              <div className="text-4xl flex-shrink-0">{f.icon}</div>
              <div className="text-left">
                <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                <p className="text-gray-400 text-[15px]">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <div className="px-5 pb-10 max-w-xl mx-auto">
        <Link to="/register" className="block">
          <button className="w-full py-6 bg-white text-slate-950 font-bold text-xl rounded-3xl active:scale-95 transition-all">
            FREE Mein Shuru Karo →
          </button>
        </Link>
        <p className="text-center text-xs text-gray-500 mt-4">50,000+ Indians already using Suraksha</p>
      </div>
    </div>
  );
}