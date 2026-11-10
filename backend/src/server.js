import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl) or matching client origin
      if (!origin || origin === clientOrigin || origin.startsWith("http://localhost:")) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static demo assets and uploads
const demoAssetsPath = path.resolve(__dirname, "../demo-assets");
const uploadsPath = path.resolve(__dirname, "../uploads");
app.use("/demo-assets", express.static(demoAssetsPath));
app.use("/uploads", express.static(uploadsPath));

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();

    res.status(200).json({
      status: "success",
      backend: "connected",
      database: "connected",
      dbName: mongoose.connection.name,
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

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "error",
    message: err.message || "An unexpected internal server error occurred.",
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
  });
};

// Export app for testing
export { app, startServer };

// If run directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  startServer();
}
