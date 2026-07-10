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
      enum: [
        "PENDING",
        "SEARCHING_HOSPITAL",
        "WAITING_FOR_ACCEPTANCE",
        "AMBULANCE_ASSIGNED",
        "DRIVER_ACCEPTED",
        "DRIVER_ON_THE_WAY",
        "PATIENT_PICKED",
        "HOSPITAL_REACHED",
        "COMPLETED",
        "NO_HOSPITAL_AVAILABLE",
      ],
      default: "PENDING",
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

    // Queue of hospital ids to attempt (ordered)
    searchQueue: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hospital",
      },
    ],

    // Index into searchQueue of current target
    currentHospitalIndex: {
      type: Number,
      default: 0,
    },

    emergencyType: {
      type: String,
      default: "General",
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