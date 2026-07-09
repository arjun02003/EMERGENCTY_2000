const express = require("express");
const router = express.Router();

const protect = require("../middleware/AuthMiddleware");
const adminOnly = protect.adminOnly;

const {
  registerHospital,
  getHospitals,
  getHospitalMe,
  updateHospital,
} = require("../controllers/HospitalController");

// Register
router.post("/register", protect, adminOnly, registerHospital);

// Get All
router.get("/", getHospitals);

// Logged-in Hospital Profile
router.get("/me", protect, getHospitalMe);

// Update
router.put("/:id", protect, updateHospital);

module.exports = router;