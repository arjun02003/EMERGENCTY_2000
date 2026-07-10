const Emergency = require("../models/Emergency");
const Hospital = require("../models/Hospital");
const Ambulance = require("../models/Ambulance");
const { calculateDistance } = require("../utils/distance");

const HOSPITAL_SEARCH_RADIUS_KM = parseFloat(process.env.HOSPITAL_SEARCH_RADIUS_KM) || 20;

// Create Emergency: persist, build candidate queue, notify first hospital
exports.createEmergency = async (req, res) => {
  try {
    const { latitude, longitude, emergencyType } = req.body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({ success: false, message: "Latitude and Longitude are required and must be numbers" });
    }

    // Create base emergency record (PENDING)
    const emergency = await Emergency.create({
      user: req.user.id,
      latitude,
      longitude,
      status: "PENDING",
      emergencyType: emergencyType || "General",
    });

    // Find candidate hospitals within radius with required resources
    const hospitals = await Hospital.find({ isOnline: true, availableBeds: { $gt: 0 }, availableAmbulances: { $gt: 0 } });

    const candidates = [];
    for (const h of hospitals) {
      if (!h.location || typeof h.location.latitude !== "number" || typeof h.location.longitude !== "number") continue;
      const distance = calculateDistance(latitude, longitude, h.location.latitude, h.location.longitude);
      if (distance <= HOSPITAL_SEARCH_RADIUS_KM) candidates.push({ hospital: h, distance });
    }

    // Sort by distance asc, availableAmbulances desc, availableBeds desc
    candidates.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (b.hospital.availableAmbulances !== a.hospital.availableAmbulances) return b.hospital.availableAmbulances - a.hospital.availableAmbulances;
      return b.hospital.availableBeds - a.hospital.availableBeds;
    });

    const io = req.app.get("io");

    if (candidates.length === 0) {
      emergency.status = "NO_HOSPITAL_AVAILABLE";
      await emergency.save();
      if (io) io.to(`user:${req.user.id}`).emit("emergency_status", { status: emergency.status, emergency });
      return res.status(200).json({ success: false, message: "No hospital available within radius", emergency });
    }

    // Build searchQueue and persist
    emergency.searchQueue = candidates.map((c) => c.hospital._id);
    emergency.currentHospitalIndex = 0;
    emergency.status = "SEARCHING_HOSPITAL";
    await emergency.save();

    // notify user
    if (io) io.to(`user:${req.user.id}`).emit("emergency_status", { status: "SEARCHING_HOSPITAL", emergency });

    // notify first hospital
    const first = candidates[0].hospital;
    emergency.status = "WAITING_FOR_ACCEPTANCE";
    await emergency.save();
    if (io && first.user) {
      io.to(`hospital:${first.user}`).emit("new_emergency_request", {
        emergencyId: emergency._id,
        userId: req.user.id,
        latitude,
        longitude,
        distance: candidates[0].distance,
        emergencyType: emergency.emergencyType,
      });
    }

    return res.status(201).json({ success: true, message: "Emergency queued and first hospital notified", emergency });
  } catch (error) {
    console.error("Create Emergency Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create emergency" });
  }
};

// Get Pending Emergencies: for hospital return those targeted to it
exports.getPendingEmergencies = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user.id });
    let query = {};
    if (hospital) {
      query = {
        status: "WAITING_FOR_ACCEPTANCE",
        $expr: {
          $eq: [ { $arrayElemAt: ["$searchQueue", "$currentHospitalIndex"] }, hospital._id ]
        }
      };
    } else {
      query = { status: "WAITING_FOR_ACCEPTANCE" };
    }

    const emergencies = await Emergency.find(query).populate("user", "name bloodGroup phone emergencyContactName emergencyContactNumber").populate("searchQueue");
    return res.status(200).json({ success: true, count: emergencies.length, emergencies });
  } catch (error) {
    console.error("Get Pending Emergencies Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Hospital accepts current emergency request
exports.acceptEmergency = async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: "Emergency not found" });
    if (emergency.status !== "WAITING_FOR_ACCEPTANCE") return res.status(400).json({ success: false, message: "Emergency not awaiting acceptance" });

    const hospital = await Hospital.findOne({ user: req.user.id });
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    const currentHospitalId = emergency.searchQueue?.[emergency.currentHospitalIndex];
    if (!currentHospitalId || currentHospitalId.toString() !== hospital._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to accept this emergency" });
    }

    const ambulance = await Ambulance.findOne({ hospital: hospital._id, status: "Available" }).sort({ createdAt: 1 });
    if (!ambulance) return res.status(200).json({ success: false, message: "No ambulance available." });

    ambulance.status = "Busy";
    await ambulance.save();

    hospital.availableAmbulances = Math.max(hospital.availableAmbulances - 1, 0);
    await hospital.save();

    emergency.status = "AMBULANCE_ASSIGNED";
    emergency.ambulance = ambulance._id;
    emergency.ambulanceAssigned = true;
    emergency.assignedHospital = hospital._id;
    emergency.acceptedAt = Date.now();
    await emergency.save();

    const populatedEmergency = await Emergency.findById(emergency._id).populate("assignedHospital").populate("ambulance").populate("user", "name phone bloodGroup");

    const io = req.app.get("io");
    if (io) {
      io.to(`user:${emergency.user.toString()}`).emit("emergency_status", { status: emergency.status, emergency: populatedEmergency });
      io.to(`hospital:${req.user.id}`).emit("emergency_update", { status: emergency.status, emergency: populatedEmergency });
      const assignedDriverId = populatedEmergency.ambulance?._id;
      if (assignedDriverId) {
        io.to(`driver:${assignedDriverId}`).emit("driver_assignment", { status: populatedEmergency.status, emergency: populatedEmergency });
      }
    }

    return res.status(200).json({ success: true, message: "Emergency Accepted and ambulance assigned", emergency: populatedEmergency });
  } catch (error) {
    console.error("Accept Emergency Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Hospital rejects current emergency request — move to next candidate
exports.rejectEmergency = async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) return res.status(404).json({ success: false, message: "Emergency not found" });
    if (emergency.status !== "WAITING_FOR_ACCEPTANCE") return res.status(400).json({ success: false, message: "Emergency is not awaiting acceptance" });

    const hospital = await Hospital.findOne({ user: req.user.id });
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    const currentHospitalId = emergency.searchQueue?.[emergency.currentHospitalIndex];
    if (!currentHospitalId || currentHospitalId.toString() !== hospital._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to reject this emergency" });
    }

    emergency.currentHospitalIndex = (emergency.currentHospitalIndex || 0) + 1;

    const io = req.app.get("io");

    if (emergency.currentHospitalIndex >= (emergency.searchQueue?.length || 0)) {
      emergency.status = "NO_HOSPITAL_AVAILABLE";
      emergency.rejectedAt = Date.now();
      await emergency.save();
      if (io) io.to(`user:${emergency.user.toString()}`).emit("emergency_status", { status: emergency.status, emergency });
      return res.status(200).json({ success: true, message: "No hospitals left to try", emergency });
    }

    const nextHospitalId = emergency.searchQueue[emergency.currentHospitalIndex];
    const nextHospital = await Hospital.findById(nextHospitalId);
    emergency.status = "WAITING_FOR_ACCEPTANCE";
    await emergency.save();

    if (io && nextHospital && nextHospital.user) {
      const distance = calculateDistance(emergency.latitude, emergency.longitude, nextHospital.location.latitude, nextHospital.location.longitude);
      io.to(`hospital:${nextHospital.user}`).emit("new_emergency_request", {
        emergencyId: emergency._id,
        userId: emergency.user,
        latitude: emergency.latitude,
        longitude: emergency.longitude,
        distance,
        emergencyType: emergency.emergencyType,
      });
    }

    return res.status(200).json({ success: true, message: "Emergency forwarded to next hospital", emergency });
  } catch (error) {
    console.error("Reject Emergency Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
