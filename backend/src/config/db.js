import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const dbName = process.env.MONGO_DB_NAME || "UniversityLMS";
    await mongoose.connect(process.env.MONGO_URI, {
      dbName,
    });

    console.log(`MongoDB connected successfully to database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
