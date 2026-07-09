const dotenv = require("dotenv");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const User = require("./models/User");
const Hospital = require("./models/Hospital");

dotenv.config();

async function seedDatabase() {
  console.log("🚀 Seed script started...");

  try {
    await connectDB();
    console.log("✅ MongoDB Connected");

    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@suraksha.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
    const adminName = process.env.SEED_ADMIN_NAME || "Admin";
    const adminPhone = process.env.SEED_ADMIN_PHONE || "9999999999";

    let adminUser = await User.findOne({ email: adminEmail, role: "admin" });

    if (adminUser) {
      console.log("✅ Admin already exists, skipping creation");
    } else {
      const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
      adminUser = await User.create({
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
        password: hashedAdminPassword,
        role: "admin",
      });
      console.log("✅ Admin Created");
    }

    const hospitalUserEmail = process.env.SEED_HOSPITAL_USER_EMAIL || "hospital1@suraksha.com";
    const hospitalPassword = process.env.SEED_HOSPITAL_PASSWORD || "Hospital@123";
    const hospitalName = process.env.SEED_HOSPITAL_NAME || "Apollo Hospital";
    const hospitalPhone = process.env.SEED_HOSPITAL_PHONE || "8888888888";
    const hospitalAddress = process.env.SEED_HOSPITAL_ADDRESS || "123 Main Street, Bangalore";
    const hospitalLatitude = parseFloat(process.env.SEED_HOSPITAL_LATITUDE || "12.9716");
    const hospitalLongitude = parseFloat(process.env.SEED_HOSPITAL_LONGITUDE || "77.5946");
    const hospitalTotalBeds = parseInt(process.env.SEED_HOSPITAL_TOTAL_BEDS || "100", 10);
    const hospitalAvailableBeds = parseInt(process.env.SEED_HOSPITAL_AVAILABLE_BEDS || "50", 10);
    const hospitalTotalAmbulances = parseInt(process.env.SEED_HOSPITAL_TOTAL_AMBULANCES || "10", 10);
    const hospitalAvailableAmbulances = parseInt(process.env.SEED_HOSPITAL_AVAILABLE_AMBULANCES || "5", 10);

    let hospitalUser = await User.findOne({ email: hospitalUserEmail, role: "hospital" });

    if (hospitalUser) {
      console.log("✅ Hospital User already exists, skipping creation");
    } else {
      const hashedHospitalPassword = await bcrypt.hash(hospitalPassword, 10);
      hospitalUser = await User.create({
        name: hospitalName,
        email: hospitalUserEmail,
        phone: hospitalPhone,
        password: hashedHospitalPassword,
        role: "hospital",
        hospitalLocation: {
          latitude: hospitalLatitude,
          longitude: hospitalLongitude,
        },
        totalBeds: hospitalTotalBeds,
        availableBeds: hospitalAvailableBeds,
        totalAmbulances: hospitalTotalAmbulances,
        availableAmbulances: hospitalAvailableAmbulances,
      });
      console.log("✅ Hospital User Created");
    }

    const hospitalDetails = await Hospital.findOne({ user: hospitalUser._id });

    if (hospitalDetails) {
      console.log("✅ Hospital Details already exists, skipping creation");
    } else {
      await Hospital.create({
        user: hospitalUser._id,
        name: hospitalName,
        email: hospitalUserEmail,
        phone: hospitalPhone,
        address: hospitalAddress,
        location: {
          latitude: hospitalLatitude,
          longitude: hospitalLongitude,
        },
        totalBeds: hospitalTotalBeds,
        availableBeds: hospitalAvailableBeds,
        totalAmbulances: hospitalTotalAmbulances,
        availableAmbulances: hospitalAvailableAmbulances,
        emergencyTypes: ["Accident", "Cardiac", "Trauma"],
      });
      console.log("✅ Hospital Details Created");
    }

    console.log("🎉 Seed Completed Successfully");
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.connection.close();
  }
}

seedDatabase();
