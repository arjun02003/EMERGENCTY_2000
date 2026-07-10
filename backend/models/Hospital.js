const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema(
  {
    // New Field - Link to User Collection
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    phone: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
    },

    location: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
    },

    totalBeds: {
      type: Number,
      default: 0,
    },

    availableBeds: {
      type: Number,
      default: 0,
    },

    totalAmbulances: {
      type: Number,
      default: 0,
    },

    availableAmbulances: {
      type: Number,
      default: 0,
    },

    isOnline: {
      type: Boolean,
      default: true,
    },

    emergencyContactName: {
      type: String,
      default: "",
    },

    emergencyContactNumber: {
      type: String,
      default: "",
    },

    emergencyTypes: [{
      type: String
    }],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Hospital || mongoose.model("Hospital", hospitalSchema);