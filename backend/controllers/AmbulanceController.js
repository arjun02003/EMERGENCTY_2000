const Ambulance = require("../models/Ambulance");
const Hospital = require("../models/Hospital");

exports.createAmbulance = async (req, res) => {
  try {
    if (req.user.role !== "hospital") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Hospitals only.",
      });
    }

    const hospital = await Hospital.findOne({ user: req.user.id });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    const { driverName, driverPhone, vehicleNumber, vehicleType, status } = req.body;
    if (!driverName || !driverPhone || !vehicleNumber || !vehicleType || !status) {
      return res.status(400).json({
        success: false,
        message: "All ambulance fields are required",
      });
    }

    const ambulance = await Ambulance.create({
      hospital: hospital._id,
      driverName,
      driverPhone,
      vehicleNumber,
      vehicleType,
      status,
    });

    res.status(201).json({
      success: true,
      message: "Ambulance created successfully",
      ambulance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getMyAmbulances = async (req, res) => {
  try {
    if (req.user.role !== "hospital") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Hospitals only.",
      });
    }

    const hospital = await Hospital.findOne({ user: req.user.id });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    const ambulances = await Ambulance.find({ hospital: hospital._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: ambulances.length,
      ambulances,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateAmbulance = async (req, res) => {
  try {
    if (req.user.role !== "hospital") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Hospitals only.",
      });
    }

    const hospital = await Hospital.findOne({ user: req.user.id });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    const ambulance = await Ambulance.findById(req.params.id);
    if (!ambulance) {
      return res.status(404).json({
        success: false,
        message: "Ambulance not found",
      });
    }

    if (ambulance.hospital.toString() !== hospital._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this ambulance",
      });
    }

    const { driverName, driverPhone, vehicleNumber, vehicleType, status } = req.body;
    const updates = {};
    if (driverName !== undefined) updates.driverName = driverName;
    if (driverPhone !== undefined) updates.driverPhone = driverPhone;
    if (vehicleNumber !== undefined) updates.vehicleNumber = vehicleNumber;
    if (vehicleType !== undefined) updates.vehicleType = vehicleType;
    if (status !== undefined) updates.status = status;

    const updatedAmbulance = await Ambulance.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    res.status(200).json({
      success: true,
      message: "Ambulance updated successfully",
      ambulance: updatedAmbulance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteAmbulance = async (req, res) => {
  try {
    if (req.user.role !== "hospital") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Hospitals only.",
      });
    }

    const hospital = await Hospital.findOne({ user: req.user.id });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found",
      });
    }

    const ambulance = await Ambulance.findById(req.params.id);
    if (!ambulance) {
      return res.status(404).json({
        success: false,
        message: "Ambulance not found",
      });
    }

    if (ambulance.hospital.toString() !== hospital._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this ambulance",
      });
    }

    await ambulance.remove();

    res.status(200).json({
      success: true,
      message: "Ambulance deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
