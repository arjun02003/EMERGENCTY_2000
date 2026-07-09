const Emergency = require("../models/Emergency");
const Hospital = require("../models/Hospital");
const Ambulance = require("../models/Ambulance");
const { calculateDistance } = require("../utils/distance");

// Create Emergency
exports.createEmergency = async (req, res) => {
  console.log("Emergency Controller Hit");
  console.log("Request Body:", req.body);
  console.log("User from JWT:", req.user);

  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and Longitude are required",
      });
    }

    // Find available hospitals
    const hospitals = await Hospital.find({
      isOnline: true,
      availableBeds: { $gt: 0 },
      availableAmbulances: { $gt: 0 },
    });

    let nearestHospital = null;
    let minDistance = Infinity;

    for (const hospital of hospitals) {
      const distance = calculateDistance(
        latitude,
        longitude,
        hospital.location.latitude,
        hospital.location.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestHospital = hospital;
      }
    }

    // Logging for debugging
    console.log("Nearest Hospital:", nearestHospital ? nearestHospital.name : "None Found");
    console.log("Distance:", minDistance);

    // Create Emergency
    const emergency = await Emergency.create({
      user: req.user.id,
      latitude,
      longitude,
      status: "pending",
      assignedHospital: nearestHospital ? nearestHospital._id : null,
      distance: nearestHospital ? minDistance : 0,
    });

    return res.status(201).json({
      success: true,
      message: "Emergency Request Sent Successfully",
      emergency,
      assignedHospital: nearestHospital,
    });

  } catch (error) {
    console.error("Create Emergency Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create emergency",
    });
  }
};

// Get Pending Emergencies
exports.getPendingEmergencies = async (req, res) => {
  try {
    const emergencies = await Emergency.find({
      status: "pending",
    })
      .populate("user", "name bloodGroup phone emergencyContact")
      .populate(
        "assignedHospital",
        "name address availableBeds availableAmbulances location"
      );

    res.status(200).json({
      success: true,
      count: emergencies.length,
      emergencies,
    });

  } catch (error) {
    console.error("Get Pending Emergencies Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Accept Emergency
exports.acceptEmergency = async (req, res) => {
  console.log("===== ACCEPT CONTROLLER HIT =====");
  console.log("Emergency ID:", req.params.id);
  console.log("Hospital User from JWT:", req.user);

  try {
    const emergency = await Emergency.findById(req.params.id);
    console.log("Emergency Found in DB:", emergency);

    if (!emergency) {
      console.log("❌ Emergency Not Found");
      return res.status(404).json({
        success: false,
        message: "Emergency not found",
      });
    }

    if (emergency.status !== "pending") {
      console.log("❌ Emergency already processed. Current status:", emergency.status);
      return res.status(400).json({
        success: false,
        message: "Emergency is already processed",
      });
    }

    const hospital = await Hospital.findOne({ user: req.user.id });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    const ambulance = await Ambulance.findOne({
      hospital: hospital._id,
      status: "Available",
    }).sort({ createdAt: 1 });

    if (!ambulance) {
      return res.status(200).json({
        success: false,
        message: "No ambulance available.",
      });
    }

    ambulance.status = "Busy";
    await ambulance.save();

    hospital.availableAmbulances = Math.max(hospital.availableAmbulances - 1, 0);
    await hospital.save();

    emergency.status = "Ambulance Assigned";
    emergency.hospital = req.user.id;
    emergency.ambulance = ambulance._id;
    emergency.driverStatus = "Assigned";
    emergency.ambulanceAssigned = true;
    emergency.assignedHospital = hospital._id;
    emergency.acceptedAt = Date.now();

    await emergency.save();

    const populatedEmergency = await Emergency.findById(emergency._id)
      .populate("assignedHospital")
      .populate("ambulance")
      .populate("user", "name phone bloodGroup");

    console.log("✅ Emergency Accepted and ambulance assigned successfully");

    res.status(200).json({
      success: true,
      message: "Emergency Accepted Successfully",
      emergency: populatedEmergency,
    });

  } catch (error) {
    console.error("Accept Emergency Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Reject Emergency
exports.rejectEmergency = async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: "Emergency not found",
      });
    }

    if (emergency.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Emergency is already processed",
      });
    }

    emergency.status = "rejected";
    emergency.rejectedAt = Date.now();

    await emergency.save();

    res.status(200).json({
      success: true,
      message: "Emergency Rejected",
      emergency,
    });

  } catch (error) {
    console.error("Reject Emergency Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};