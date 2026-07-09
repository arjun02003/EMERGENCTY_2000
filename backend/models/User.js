const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  phone: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["user", "hospital", "admin"],
    default: "user",
  },

  // -------- User Information --------

  bloodGroup: {
    type: String,
    default: "",
  },

  emergencyContact: {
    type: String,
    default: "",
  },

  // -------- Hospital Information --------

  hospitalLocation: {
    latitude: {
      type: Number,
      default: 0,
    },
    longitude: {
      type: Number,
      default: 0,
    },
  },

  availableBeds: {
    type: Number,
    default: 0,
  },

  availableAmbulances: {
    type: Number,
    default: 0,
  },

  totalBeds: {
    type: Number,
    default: 0,
  },

  totalAmbulances: {
    type: Number,
    default: 0,
  },

  isOnline: {
    type: Boolean,
    default: true,
  },

},
{
  timestamps: true,
}
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);