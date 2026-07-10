const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getMe,
} = require("../controllers/AuthController");

const protect = require("../middleware/AuthMiddleware");

router.post("/register", registerUser);
router.post("/login", loginUser);

// BUG FIX: Added GET /me route so dashboard can fetch fresh profile data
// from MongoDB instead of relying solely on the localStorage snapshot.
router.get("/me", protect, getMe);

module.exports = router;