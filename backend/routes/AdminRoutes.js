const express = require("express");
const router = express.Router();

const protect = require("../middleware/AuthMiddleware");
const adminOnly = protect.adminOnly;

const { createHospital } = require("../controllers/AdminController");

router.post("/create-hospital", protect, adminOnly, createHospital);

module.exports = router;
