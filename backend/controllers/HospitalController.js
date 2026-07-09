const Hospital = require("../models/Hospital");
const User = require("../models/User");

// Register Hospital
exports.registerHospital = async (req, res) => {
  try {
    const hospital = await Hospital.create(req.body);

    res.status(201).json({
      success: true,
      message: "Hospital Registered Successfully",
      hospital,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get All Hospitals
exports.getHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find();

    res.status(200).json({
      success: true,
      count: hospitals.length,
      hospitals,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get current logged-in Hospital profile
exports.getHospitalMe = async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ user: req.user.id });

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital profile not found",
      });
    }

    res.status(200).json({
      success: true,
      hospital,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Hospital Resources
exports.updateHospital = async (req, res) => {
  try {
    if (req.user.role !== "hospital") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Hospitals only.",
      });
    }

    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    if (hospital.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own hospital profile",
      });
    }

    const {
      totalBeds,
      availableBeds,
      totalAmbulances,
      availableAmbulances,
    } = req.body;

    const updates = {};
    if (totalBeds !== undefined) updates.totalBeds = Number(totalBeds);
    if (availableBeds !== undefined) updates.availableBeds = Number(availableBeds);
    if (totalAmbulances !== undefined) updates.totalAmbulances = Number(totalAmbulances);
    if (availableAmbulances !== undefined) updates.availableAmbulances = Number(availableAmbulances);

    const updatedHospital = await Hospital.findByIdAndUpdate(
      hospital._id,
      updates,
      { new: true }
    );

    await User.findByIdAndUpdate(hospital.user, updates, { new: true });

    res.status(200).json({
      success: true,
      message: "Hospital resources updated successfully",
      hospital: updatedHospital,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};