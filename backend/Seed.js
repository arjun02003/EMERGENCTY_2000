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

    let adminUser = await User.findOne({ email: adminEmail });

    if (adminUser) {
      if (adminUser.role === "admin") {
        console.log("✅ Admin already exists, skipping creation");
      } else {
        console.log("⚠️ Existing user found with admin email but different role. Upgrading to admin.");
        adminUser.role = "admin";
        adminUser.name = adminName;
        adminUser.phone = adminPhone;
        adminUser.password = await bcrypt.hash(adminPassword, 10);
        await adminUser.save();
        console.log("✅ Existing user upgraded to admin");
      }
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

    // NOTE: Removed automatic hospital seeding.
    // Hospitals should only be created by an Admin via the application.
    console.log("ℹ️ Skipping hospital seed. Create hospitals via Admin.");

    console.log("🎉 Seed Completed Successfully");
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.connection.close();
  }
}

seedDatabase();
