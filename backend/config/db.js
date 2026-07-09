const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    console.error("\n⚠️  SOLUTION:");
    console.error("1. Update MONGO_URI in .env with valid credentials");
    console.error("2. Visit: https://www.mongodb.com/cloud/atlas");
    console.error("3. Create a free cluster and get connection string");
    console.error("4. Replace USERNAME:PASSWORD in .env");
    console.error("\nOr use local MongoDB:");
    console.error("- Install MongoDB from: https://www.mongodb.com/try/download/community");
    console.error("- Set MONGO_URI=mongodb://localhost:27017/suraksha\n");
    
    // Don't exit immediately - allow server to run without DB for now
    console.log("⚠️  Server will run but database features won't work");
  }
};

module.exports = connectDB;