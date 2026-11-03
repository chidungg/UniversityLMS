import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import connectDB from "./config/db.js";

const app = express();

app.use(express.json());

// API kiểm tra kết nối backend + database
app.get("/api/health", async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();

    res.status(200).json({
      status: "success",
      backend: "connected",
      database: "connected",
      message: "University LMS API is running",
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
      message: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
  });
};

startServer();