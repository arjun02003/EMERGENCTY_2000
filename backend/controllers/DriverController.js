const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Ambulance = require("../models/Ambulance");
const Emergency = require("../models/Emergency");
const Hospital = require("../models/Hospital");

const signToken = (ambulance) => {
  return jwt.sign(
    {
      id: ambulance._id,
      role: "ambulance_driver",
      email: ambulance.driverEmail,
    },
    process.env.JWT_SECRET || "default_jwt_secret",
    { expiresIn: "7d" }
  );
};

const getAssignedEmergency = async (ambulanceId) => {
  return Emergency.findOne({
    ambulance: ambulanceId,
    status: {
      $in: [
        "AMBULANCE_ASSIGNED",
        "DRIVER_ACCEPTED",
        "DRIVER_ON_THE_WAY",
        "PATIENT_PICKED",
        "HOSPITAL_REACHED",
      ],
    },
  })
    .populate("user", "name phone bloodGroup emergencyContactName emergencyContactNumber")
    .populate("assignedHospital", "name address phone location")
    .populate("ambulance", "vehicleNumber vehicleType driverName driverPhone");
};

const buildDriverPayload = (ambulance, assignedEmergency) => ({
  id: ambulance._id,
  driverName: ambulance.driverName,
  driverPhone: ambulance.driverPhone,
  driverEmail: ambulance.driverEmail,
  vehicleNumber: ambulance.vehicleNumber,
  vehicleType: ambulance.vehicleType,
  status: ambulance.status,
  driverStatus: ambulance.driverStatus,
  hospitalId: ambulance.hospital,
  assignedEmergency: assignedEmergency
    ? {
        id: assignedEmergency._id,
        status: assignedEmergency.status,
        emergencyType: assignedEmergency.emergencyType,
        pickupLocation: {
          latitude: assignedEmergency.latitude,
          longitude: assignedEmergency.longitude,
        },
        patient: {
          name: assignedEmergency.user?.name || "Unknown",
          phone: assignedEmergency.user?.phone || "-",
          bloodGroup: assignedEmergency.user?.bloodGroup || "-",
          emergencyContactName: assignedEmergency.user?.emergencyContactName || "-",
          emergencyContactNumber: assignedEmergency.user?.emergencyContactNumber || "-",
        },
        assignedHospital: assignedEmergency.assignedHospital
          ? {
              id: assignedEmergency.assignedHospital._id,
              name: assignedEmergency.assignedHospital.name,
              address: assignedEmergency.assignedHospital.address,
              phone: assignedEmergency.assignedHospital.phone,
            }
          : null,
        createdAt: assignedEmergency.createdAt,
      }
    : null,
});

exports.loginDriver = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Driver email and password are required" });
    }

    const ambulance = await Ambulance.findOne({ driverEmail: email.toLowerCase().trim() });
    if (!ambulance || !ambulance.password) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, ambulance.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = signToken(ambulance);
    const assignedEmergency = await getAssignedEmergency(ambulance._id);

    return res.status(200).json({
      success: true,
      message: "Driver authenticated successfully",
      token,
      driver: buildDriverPayload(ambulance, assignedEmergency),
    });
  } catch (error) {
    console.error("Driver login error:", error);
    return res.status(500).json({ success: false, message: error.message || "Driver login failed" });
  }
};

exports.getDriverMe = async (req, res) => {
  try {
    const ambulance = await Ambulance.findById(req.user.id);
    if (!ambulance) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    const assignedEmergency = await getAssignedEmergency(ambulance._id);
    return res.status(200).json({ success: true, driver: buildDriverPayload(ambulance, assignedEmergency) });
  } catch (error) {
    console.error("Driver profile error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch driver profile" });
  }
};

const getCurrentEmergency = async (ambulanceId) => {
  return Emergency.findOne({
    ambulance: ambulanceId,
    status: {
      $in: [
        "AMBULANCE_ASSIGNED",
        "DRIVER_ACCEPTED",
        "DRIVER_ON_THE_WAY",
        "PATIENT_PICKED",
        "HOSPITAL_REACHED",
      ],
    },
  })
    .populate("user", "name phone bloodGroup emergencyContactName emergencyContactNumber")
    .populate("assignedHospital", "name address phone location");
};

const getDriverAndEmergency = async (req) => {
  const ambulance = await Ambulance.findById(req.user.id);
  if (!ambulance) {
    return { error: "Driver not found" };
  }

  const emergency = await getCurrentEmergency(ambulance._id);
  if (!emergency) {
    return { error: "No active emergency assigned" };
  }

  return { ambulance, emergency };
};

const respondWithDriverState = async (res, ambulance, emergency) => {
  await ambulance.save();
  await emergency.save();
  const assignedEmergency = await getAssignedEmergency(ambulance._id);
  return res.status(200).json({
    success: true,
    message: "Driver action completed",
    driver: buildDriverPayload(ambulance, assignedEmergency),
  });
};

exports.acceptTrip = async (req, res) => {
  try {
    const { ambulance, emergency, error } = await getDriverAndEmergency(req);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }

    if (emergency.status !== "AMBULANCE_ASSIGNED") {
      return res.status(400).json({ success: false, message: "Trip cannot be accepted in the current state" });
    }

    emergency.status = "DRIVER_ACCEPTED";
    ambulance.driverStatus = "Accepted";
    ambulance.status = "Busy";

    return respondWithDriverState(res, ambulance, emergency);
  } catch (error) {
    console.error("Accept trip error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to accept trip" });
  }
};

exports.startTrip = async (req, res) => {
  try {
    const { ambulance, emergency, error } = await getDriverAndEmergency(req);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }

    if (emergency.status !== "DRIVER_ACCEPTED") {
      return res.status(400).json({ success: false, message: "Trip cannot be started in the current state" });
    }

    emergency.status = "DRIVER_ON_THE_WAY";
    ambulance.driverStatus = "On the way";
    ambulance.status = "Busy";

    return respondWithDriverState(res, ambulance, emergency);
  } catch (error) {
    console.error("Start trip error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to start trip" });
  }
};

exports.reachPatient = async (req, res) => {
  try {
    const { ambulance, emergency, error } = await getDriverAndEmergency(req);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }

    if (emergency.status !== "DRIVER_ON_THE_WAY") {
      return res.status(400).json({ success: false, message: "Cannot mark patient arrival in the current state" });
    }

    ambulance.driverStatus = "Arrived at patient";
    ambulance.status = "Busy";

    return respondWithDriverState(res, ambulance, emergency);
  } catch (error) {
    console.error("Reach patient error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to reach patient" });
  }
};

exports.patientPicked = async (req, res) => {
  try {
    const { ambulance, emergency, error } = await getDriverAndEmergency(req);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }

    if (emergency.status !== "DRIVER_ON_THE_WAY") {
      return res.status(400).json({ success: false, message: "Cannot pick up patient in the current state" });
    }

    emergency.status = "PATIENT_PICKED";
    ambulance.driverStatus = "Patient picked up";
    ambulance.status = "Busy";

    return respondWithDriverState(res, ambulance, emergency);
  } catch (error) {
    console.error("Patient picked error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to mark patient pickup" });
  }
};

exports.reachHospital = async (req, res) => {
  try {
    const { ambulance, emergency, error } = await getDriverAndEmergency(req);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }

    if (emergency.status !== "PATIENT_PICKED") {
      return res.status(400).json({ success: false, message: "Cannot mark hospital arrival in the current state" });
    }

    emergency.status = "HOSPITAL_REACHED";
    ambulance.driverStatus = "Hospital reached";
    ambulance.status = "Busy";

    return respondWithDriverState(res, ambulance, emergency);
  } catch (error) {
    console.error("Reach hospital error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to mark hospital arrival" });
  }
};

exports.completeTrip = async (req, res) => {
  try {
    const { ambulance, emergency, error } = await getDriverAndEmergency(req);
    if (error) {
      return res.status(404).json({ success: false, message: error });
    }

    if (emergency.status !== "HOSPITAL_REACHED") {
      return res.status(400).json({ success: false, message: "Cannot complete trip in the current state" });
    }

    emergency.status = "COMPLETED";
    ambulance.driverStatus = "Idle";
    ambulance.status = "Available";

    const hospital = await Hospital.findById(ambulance.hospital);
    if (hospital) {
      hospital.availableAmbulances = Math.max((hospital.availableAmbulances || 0) + 1, 0);
      await hospital.save();
    }

    return respondWithDriverState(res, ambulance, emergency);
  } catch (error) {
    console.error("Complete trip error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to complete trip" });
  }
};
