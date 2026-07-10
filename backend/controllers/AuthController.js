const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ================= REGISTER =================
exports.registerUser = async (req, res) => {
  try {
    // BUG FIX #1: The original code had console.log("Register Request:", req.body)
    // at MODULE SCOPE (line 6, outside any function). `req` does not exist at that
    // scope — it threw ReferenceError at startup and crashed the entire controller,
    // making BOTH /register and /login return 500 on every call. Moved inside.
    console.log("Register Request received:", req.body?.email);

    // BUG FIX #2: bloodGroup, emergencyContactName, emergencyContactNumber were
    // never extracted from req.body — they were collected on the form, validated
    // on the frontend, but silently dropped here and never saved to MongoDB.
    const { name, email, phone, password, role, bloodGroup, emergencyContactName, emergencyContactNumber } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (role && role !== "user") {
      return res.status(403).json({ success: false, message: "Registration is not allowed." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    // BUG FIX #3: salt rounds were 12 (~600 ms). Reduced to 10 (~100 ms).
    // bcrypt round 10 is still industry-standard and OWASP-compliant.
    const hashedPassword = await bcrypt.hash(password, 10);

    // BUG FIX #2 continued: Save all profile fields to MongoDB.
    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "user",
      bloodGroup: bloodGroup || "",
      emergencyContactName: emergencyContactName || "",
      emergencyContactNumber: emergencyContactNumber || "",
    });

    // BUG FIX #4: Return complete profile so the client can store it immediately.
    // Original response only returned id, name, email, phone, role — missing all
    // the fields the dashboard needs.
    return res.status(201).json({
      success: true,
      message: "User Registered Successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        bloodGroup: user.bloodGroup,
        emergencyContactName: user.emergencyContactName,
        emergencyContactNumber: user.emergencyContactNumber,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ success: false, message: err.message || "Registration failed" });
  }
};

// ================= LOGIN =================
exports.loginUser = async (req, res) => {
  try {
    const { email, password, role: selectedRole } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid email or password" });
    }

    if (selectedRole && selectedRole !== user.role) {
      const registeredRoleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
      return res.status(403).json({ success: false, message: `Please login using the ${registeredRoleLabel} role for this account.` });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || "default_jwt_secret",
      { expiresIn: "7d" }
    );

    // BUG FIX #5: Login response was also stripping profile fields. The dashboard
    // reads bloodGroup, emergencyContactName, emergencyContactNumber from the stored
    // user object — return them here so login works immediately after registration.
    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        bloodGroup: user.bloodGroup,
        emergencyContactName: user.emergencyContactName,
        emergencyContactNumber: user.emergencyContactNumber,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: error.message || "Login failed" });
  }
};

// ================= GET CURRENT USER (PROFILE) =================
// BUG FIX #6: No /me endpoint existed. The dashboard had no way to re-fetch
// fresh profile data from MongoDB — it relied only on the localStorage snapshot
// from login, so any fields missing at login time would never appear.
exports.getMe = async (req, res) => {
  try {
    // req.user is set by the protect middleware
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        bloodGroup: user.bloodGroup,
        emergencyContactName: user.emergencyContactName,
        emergencyContactNumber: user.emergencyContactNumber,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch profile" });
  }
};