const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const emergencyRoutes = require("./routes/EmergencyRoutes");
const authRoutes = require("./routes/AuthRoutes");
const hospitalRoutes = require("./routes/HospitalRoutes");
const ambulanceRoutes = require("./routes/AmbulanceRoutes");
const adminRoutes = require("./routes/AdminRoutes");
const driverRoutes = require("./routes/DriverRoutes");

const app = express();

// ── CORS Configuration (Production-Ready) ─────────────────────────────────────
const allowedOrigins = [
  // Local development
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  // Production (Vercel)
  "https://emergency-2000.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Exact match
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow any Vercel preview deployment (e.g. emergency-2000-***.vercel.app)
    if (/^https:\/\/emergency-2000.*\.vercel\.app$/.test(origin)) return callback(null, true);

    // Reject — but do NOT throw an Error. Throwing causes Express error handler
    // to fire WITHOUT CORS headers, which makes the browser show the generic
    // "No Access-Control-Allow-Origin" message instead of a clean rejection.
    console.warn(`⚠️  CORS blocked origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11) choke on 204
};

// 1) CORS middleware — MUST be first, before body parsers and routes
app.use(cors(corsOptions));

// 2) Explicit preflight handler for ALL routes — guarantees OPTIONS works
//    even if Render's reverse proxy or a middleware short-circuits the request
//    Express 5 requires named wildcard params instead of '*'
app.options("{*path}", cors(corsOptions));

// 3) Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4) Request logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// 5) Health check
app.get("/", (req, res) => {
  res.send("🚑 SURAKSHA Backend Running Successfully");
});

// 6) API Routes
app.use("/api/emergency", emergencyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/hospital", hospitalRoutes);
app.use("/api/ambulance", ambulanceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);

// 7) 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Endpoint not found" });
});

// 8) Error handler
app.use((err, req, res, next) => {
  console.error("Express error:", err.message);
  res.status(500).json({ success: false, message: err.message || "Server error" });
});

const PORT = parseInt(process.env.PORT, 10) || 5000;

const http = require("http");
const { Server } = require("socket.io");

const startServer = async () => {
  try {
    await connectDB();
    const server = http.createServer(app);

    const io = new Server(server, {
      cors: {
        origin: corsOptions.origin,
        methods: corsOptions.methods,
        allowedHeaders: corsOptions.allowedHeaders,
        credentials: true,
      },
    });

    // Simple rooms: user:<userId>, hospital:<userId>
    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);

      socket.on("join", (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined ${room}`);
      });

      socket.on("leave", (room) => {
        socket.leave(room);
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
      });
    });

    // attach io to app for controller access
    app.set("io", io);

    server.listen(PORT, () => {
      console.log(`✅ Server + Socket.IO running on port ${PORT}`);
      console.log(`🌐 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();