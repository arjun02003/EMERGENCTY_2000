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
      latitude,
      longitude,
      totalBeds,
      availableBeds,
      totalAmbulances,
      availableAmbulances,
      isOnline,
      emergencyContactName,
      emergencyContactNumber,
    } = req.body;

    if (!name || !email || !password || !phone || !address || !emergencyTypes) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Allow passing latitude/longitude directly; otherwise attempt to geocode the address.
    let latitudeValue = null;
    let longitudeValue = null;
    if (latitude !== undefined && longitude !== undefined) {
      latitudeValue = Number(latitude);
      longitudeValue = Number(longitude);
    } else if (address) {
      // Try Google Geocoding first if API key provided
      const geocodingApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (geocodingApiKey) {
        try {
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${geocodingApiKey}`;
          const geocodeResponse = await axios.get(geocodeUrl);
          const geocodeData = geocodeResponse.data;
          if (geocodeData && geocodeData.status === "OK" && geocodeData.results && geocodeData.results.length > 0) {
            const location = geocodeData.results[0].geometry.location;
            latitudeValue = Number(location.lat);
            longitudeValue = Number(location.lng);
          }
        } catch (err) {
          console.warn("Google geocode failed, will try OSM fallback", err?.message);
        }
      }

      // If Google didn't produce a result, try Mapbox if token available
      const mapboxToken = process.env.MAPBOX_TOKEN;
      if ((latitudeValue === null || longitudeValue === null) && mapboxToken) {
        try {
          const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&access_token=${mapboxToken}`;
          const mapRes = await axios.get(mapboxUrl);
          if (mapRes.data && Array.isArray(mapRes.data.features) && mapRes.data.features.length > 0) {
            const feat = mapRes.data.features[0];
            if (feat.center && feat.center.length >= 2) {
              longitudeValue = Number(feat.center[0]);
              latitudeValue = Number(feat.center[1]);
            }
          }
        } catch (err) {
          console.warn("Mapbox geocode failed, will try OSM fallback", err?.message);
        }
      }

      // Fallback to OpenStreetMap Nominatim (no API key required)
      if ((latitudeValue === null || longitudeValue === null) && address) {
        try {
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
          const nomRes = await axios.get(nominatimUrl, { headers: { 'User-Agent': 'SURAKSHA-App/1.0' } });
          if (Array.isArray(nomRes.data) && nomRes.data.length > 0) {
            latitudeValue = Number(nomRes.data[0].lat);
            longitudeValue = Number(nomRes.data[0].lon);
          }
        } catch (err) {
          console.warn("OSM geocode failed", err?.message);
        }
      }
    }

    if (latitudeValue === null || longitudeValue === null) {
      return res.status(400).json({
        success: false,
        message: "Unable to determine coordinates for the provided address. Provide valid address or latitude/longitude.",
      });
    }

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
      isOnline: isOnline === undefined ? true : Boolean(isOnline),
      totalBeds: totalBeds !== undefined ? Number(totalBeds) : 0,
      availableBeds: availableBeds !== undefined ? Number(availableBeds) : 0,
      totalAmbulances: totalAmbulances !== undefined ? Number(totalAmbulances) : 0,
      availableAmbulances: availableAmbulances !== undefined ? Number(availableAmbulances) : 0,
      emergencyContactName: emergencyContactName || "",
      emergencyContactNumber: emergencyContactNumber || "",
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
      isOnline: isOnline === undefined ? true : Boolean(isOnline),
      totalBeds: totalBeds !== undefined ? Number(totalBeds) : 0,
      availableBeds: availableBeds !== undefined ? Number(availableBeds) : 0,
      totalAmbulances: totalAmbulances !== undefined ? Number(totalAmbulances) : 0,
      availableAmbulances: availableAmbulances !== undefined ? Number(availableAmbulances) : 0,
      emergencyContactName: emergencyContactName || "",
      emergencyContactNumber: emergencyContactNumber || "",
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

// Update hospital (admin)
exports.updateHospital = async (req, res) => {
  try {
    const hospitalId = req.params.id;
    const updates = req.body || {};

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }

    // Update fields on Hospital
    const allowed = [
      "name",
      "email",
      "phone",
      "address",
      "totalBeds",
      "availableBeds",
      "totalAmbulances",
      "availableAmbulances",
      "isOnline",
      "emergencyContactName",
      "emergencyContactNumber",
      "emergencyTypes",
      "location",
    ];

    allowed.forEach((key) => {
      if (updates[key] !== undefined) hospital[key] = updates[key];
    });

    // If location fields provided separately
    if (updates.latitude !== undefined && updates.longitude !== undefined) {
      hospital.location = { latitude: Number(updates.latitude), longitude: Number(updates.longitude) };
    }

    await hospital.save();

    // Also sync to User doc where applicable
    const user = await User.findById(hospital.user);
    if (user) {
      const syncFields = ["availableBeds", "availableAmbulances", "totalBeds", "totalAmbulances", "isOnline"];
      syncFields.forEach((k) => {
        if (hospital[k] !== undefined) user[k] = hospital[k];
      });
      if (hospital.location) user.hospitalLocation = hospital.location;
      await user.save();
    }

    res.status(200).json({ success: true, message: "Hospital updated", hospital });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete hospital (admin)
exports.deleteHospital = async (req, res) => {
  try {
    const hospitalId = req.params.id;
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    // Remove hospital doc
    await Hospital.findByIdAndDelete(hospitalId);

    // Remove associated user account
    if (hospital.user) {
      await User.findByIdAndDelete(hospital.user);
    }

    res.status(200).json({ success: true, message: "Hospital deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reset hospital password (admin)
exports.resetHospitalPassword = async (req, res) => {
  try {
    const hospitalId = req.params.id;
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: "Password is required" });

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    const user = await User.findById(hospital.user);
    if (!user) return res.status(404).json({ success: false, message: "Hospital user not found" });

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    await user.save();

    res.status(200).json({ success: true, message: "Hospital password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
