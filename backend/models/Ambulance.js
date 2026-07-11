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
    driverEmail: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      default: "",
    },
    driverStatus: {
      type: String,
      default: "Idle",
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
    // Live GPS coordinates updated by driver during active trip
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Ambulance || mongoose.model("Ambulance", ambulanceSchema);
