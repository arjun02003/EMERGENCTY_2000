const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,   // BUG FIX: normalise case so User@Ex.com != user@ex.com
    trim: true,
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

  // -------- User Medical Information --------

  bloodGroup: {
    type: String,
    default: "",
  },

  // BUG FIX: schema had a single emergencyContact:String field but
  // the frontend sends TWO separate fields (emergencyContactName &
  // emergencyContactNumber). Added both; kept old field for any
  // existing documents that may have used it.
  emergencyContactName: {
    type: String,
    default: "",
  },

  emergencyContactNumber: {
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
  timestamps: true, // provides createdAt + updatedAt automatically
}
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);