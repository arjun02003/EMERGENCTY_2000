const express = require("express");
const router = express.Router();
const protect = require("../middleware/AuthMiddleware");
const driverOnly = protect.driverOnly;
const {
  loginDriver,
  getDriverMe,
  acceptTrip,
  startTrip,
  reachPatient,
  patientPicked,
  reachHospital,
  completeTrip,
} = require("../controllers/DriverController");

router.post("/login", loginDriver);
router.get("/me", protect, driverOnly, getDriverMe);
router.put("/accept", protect, driverOnly, acceptTrip);
router.put("/start", protect, driverOnly, startTrip);
router.put("/reach-patient", protect, driverOnly, reachPatient);
router.put("/patient-picked", protect, driverOnly, patientPicked);
router.put("/reach-hospital", protect, driverOnly, reachHospital);
router.put("/complete", protect, driverOnly, completeTrip);

module.exports = router;
