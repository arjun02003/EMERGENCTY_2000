const mongoose = require("mongoose");

const ambulanceSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    driverName: {
      type: String,
      required: true,
    },
    driverPhone: {
      type: String,
      required: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
    },
    vehicleType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Available", "Busy", "Offline"],
      default: "Available",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Ambulance || mongoose.model("Ambulance", ambulanceSchema);
