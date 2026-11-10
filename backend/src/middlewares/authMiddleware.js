import jwt from "jsonwebtoken";
import User from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "university_lms_secure_jwt_secret_token_2026";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required. Please log in.",
      });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        status: "error",
        message: "Session expired or invalid token. Please log in again.",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User account no longer exists.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        status: "error",
        message: "Your account is deactivated. Please contact an administrator.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Authentication error: " + error.message,
    });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to access this content.",
      });
    }

    next();
  };
};
