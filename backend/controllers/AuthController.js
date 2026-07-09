const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ================= REGISTER =================
exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (role && role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Registration is not allowed.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "user",
    });

    return res.status(201).json({
      success: true,
      message: "User Registered Successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ================= LOGIN =================
exports.loginUser = async (req, res) => {
  try {
    const { email, password, role: selectedRole } = req.body;

    // Check if fields are empty
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and Password are required",
      });
    }

    // Find user
    const user = await User.findOne({ email });

    // User not registered
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not registered. Please register first.",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    // Wrong password
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Verify selected role matches registered role
    if (selectedRole && selectedRole !== user.role) {
      const registeredRoleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
      let message = `Access denied. This account is registered as ${registeredRoleLabel}. Please login using the ${registeredRoleLabel} role.`;

      if (selectedRole === "admin") {
        message += " Admin login is only available for registered administrators.";
      }

      return res.status(403).json({
        success: false,
        message,
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    // Login Success
    return res.status(200).json({
      success: true,
      message: "Login Successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};