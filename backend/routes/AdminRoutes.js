const express = require("express");
const router = express.Router();

const protect = require("../middleware/AuthMiddleware");
const adminOnly = protect.adminOnly;

const { createHospital, updateHospital, deleteHospital, resetHospitalPassword } = require("../controllers/AdminController");

router.post("/create-hospital", protect, adminOnly, createHospital);
router.put("/hospital/:id", protect, adminOnly, updateHospital);
router.delete("/hospital/:id", protect, adminOnly, deleteHospital);
router.post("/hospital/:id/reset-password", protect, adminOnly, resetHospitalPassword);

module.exports = router;
