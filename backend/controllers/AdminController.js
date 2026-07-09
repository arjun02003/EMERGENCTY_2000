const axios = require("axios");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Hospital = require("../models/Hospital");

exports.createHospital = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      address,
      emergencyTypes,
    } = req.body;

    if (!name || !email || !password || !phone || !address || !emergencyTypes) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const geocodingApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!geocodingApiKey) {
      return res.status(500).json({
        success: false,
        message: "Geocoding API key is not configured.",
      });
    }

    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${geocodingApiKey}`;
    const geocodeResponse = await axios.get(geocodeUrl);
    const geocodeData = geocodeResponse.data;

    if (!geocodeData || geocodeData.status !== "OK" || !geocodeData.results || geocodeData.results.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid address. Please enter a valid hospital address.",
      });
    }

    const location = geocodeData.results[0].geometry.location;
    const latitudeValue = Number(location.lat);
    const longitudeValue = Number(location.lng);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Hospital email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const hospitalUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "hospital",
      hospitalLocation: {
        latitude: latitudeValue,
        longitude: longitudeValue,
      },
      isOnline: true,
    });

    const hospitalDoc = await Hospital.create({
      user: hospitalUser._id,
      name,
      email,
      phone,
      address,
      location: {
        latitude: latitudeValue,
        longitude: longitudeValue,
      },
      isOnline: true,
      emergencyTypes: Array.isArray(emergencyTypes)
        ? emergencyTypes
        : typeof emergencyTypes === "string"
        ? emergencyTypes.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
    });

    return res.status(201).json({
      success: true,
      message: "Hospital created successfully",
      hospital: hospitalDoc,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
