const jwt = require("jsonwebtoken");

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];

      // BUG FIX: Original middleware used process.env.JWT_SECRET with NO fallback,
      // but the login controller signed tokens with `|| "default_jwt_secret"`.
      // If JWT_SECRET env var is missing, verify would throw "secretOrPublicKey
      // must have a value" and every authenticated request would return 401,
      // even when the token itself is valid. Added the same fallback here.
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_jwt_secret");

      req.user = {
        id: decoded.id,
        role: decoded.role,
      };

      next();
    } else {
      return res.status(401).json({
        success: false,
        message: "Not Authorized",
      });
    }

  } catch (error) {
    console.error("Auth middleware error:", error.message);
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

const driverOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "ambulance_driver") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Drivers only.",
    });
  }

  next();
};

module.exports = protect;
module.exports.adminOnly = adminOnly;
module.exports.driverOnly = driverOnly;