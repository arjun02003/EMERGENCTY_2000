const mongoose = require("mongoose");

mongoose.set("strictQuery", false);

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI?.trim();

  if (!mongoUri) {
    throw new Error("MONGO_URI is required in backend/.env");
  }

  const connectionUri = /[?&]retryWrites=/.test(mongoUri)
    ? mongoUri
    : `${mongoUri}${mongoUri.includes("?") ? "&" : "?"}retryWrites=true&w=majority`;

  try {
    const conn = await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      maxPoolSize: 10,
    });

    console.log("✅ MongoDB Connected:", conn.connection.host);
    console.log("Database:", conn.connection.name);
    return conn;
  } catch (error) {
    console.error("❌ MongoDB Atlas Connection Error:", error.message);
    console.error("Connection URI:", connectionUri.startsWith("mongodb+srv://") ? "[masked]" : connectionUri);
    throw error;
  }
};

module.exports = connectDB;