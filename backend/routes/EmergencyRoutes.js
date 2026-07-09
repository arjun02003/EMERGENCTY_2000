const express = require("express");
const router = express.Router();

const protect = require("../middleware/AuthMiddleware");

const {
  createEmergency,
  getPendingEmergencies,
  acceptEmergency,
  rejectEmergency
} = require("../controllers/EmergencyController");

// Test Route
router.get("/test", (req, res) => {
  res.send("Emergency Routes Working ✅");
});

// Temporary Test Route for Accept
router.put("/accept/test", (req, res) => {
  res.json({
    success: true,
    message: "Accept Route Working ✅"
  });
});

// Existing Routes
router.post("/create", protect, createEmergency);
router.get("/pending", protect, getPendingEmergencies);

// New Routes
router.put("/accept/:id", protect, acceptEmergency);
router.put("/reject/:id", protect, rejectEmergency);

module.exports = router;