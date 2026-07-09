const mongoose = require("mongoose");

const emergencySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed", "Ambulance Assigned"],
      default: "pending",
    },

    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    ambulanceAssigned: {
      type: Boolean,
      default: false,
    },

    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance",
    },

    driverStatus: {
      type: String,
      default: "Pending",
    },

    // New Fields

    assignedHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },

    distance: {
      type: Number,
      default: 0,
    },

    eta: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Emergency", emergencySchema);