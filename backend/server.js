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
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "https://emergency-2000.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    // Dynamic checks
    const isAllowed = 
      allowedOrigins.includes(origin) ||
      origin.endsWith(".vercel.app") ||
      /^https:\/\/(emergency-2000|emergencty-2000).*\.vercel\.app$/.test(origin) ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1");

    if (isAllowed) {
      return callback(null, true);
    }

    console.warn(`⚠️ CORS blocked origin: ${origin}`);
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
  optionsSuccessStatus: 200,
};

// 1) Apply CORS headers to all routes
app.use(cors(corsOptions));

// 2) Catch preflight OPTIONS requests globally and return 200 immediately
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

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