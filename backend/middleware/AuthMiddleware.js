const jwt = require("jsonwebtoken");

const protect = async (req, res, next) => {
  try {
    console.log("========== AUTH MIDDLEWARE ==========");
    console.log("Method:", req.method);
    console.log("URL:", req.originalUrl);
    console.log("Authorization Header:", req.headers.authorization);

    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];

      console.log("Token extracted:", token ? "Yes (hidden)" : "No");

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = {
        id: decoded.id,
        role: decoded.role,
      };

      console.log("✅ Auth Success - User ID:", req.user.id, "| Role:", req.user.role);

      next();
    } else {
      console.log("❌ No Bearer Token Found");
      return res.status(401).json({
        success: false,
        message: "Not Authorized",
      });
    }

  } catch (error) {
    console.error("❌ Auth Error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid Token",
    });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admins only.",
    });
  }

  next();
};

module.exports = protect;
module.exports.adminOnly = adminOnly;