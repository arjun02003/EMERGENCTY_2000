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

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/", (req, res) => {
  res.send("🚑 SURAKSHA Backend Running Successfully");
});

app.use("/api/emergency", emergencyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/hospital", hospitalRoutes);
app.use("/api/ambulance", ambulanceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Endpoint not found" });
});

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
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT"],
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