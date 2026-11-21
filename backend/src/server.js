import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import adminRoutes from './routes/adminRoutes.js';
import { authenticate, requireRole } from './middlewares/authMiddleware.js';
import { allowedOrigins, protectMutation } from './middlewares/authSecurity.js';
import { jwtSecret } from './config/auth.js';
import { verifyAuthStorage } from './scripts/migrateAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      return callback(null, !origin || allowedOrigins().includes(origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', protectMutation);
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

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
app.use('/api/admin', adminRoutes);
// Protect the Instructor namespace now; academic endpoints belong to later modules.
app.use('/api/instructor', authenticate, requireRole('Instructor'));

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) console.error('Server error:', err.name);
  res.status(statusCode).json({
    status: "error",
    code: err.code && typeof err.code === 'string' ? err.code : 'SERVER_ERROR',
    message: statusCode >= 500 ? 'Hệ thống tạm thời không khả dụng. Vui lòng thử lại.' : err.message,
    ...(err.fields ? { fields: err.fields } : {}),
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  jwtSecret();
  await connectDB();
  await verifyAuthStorage();

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
