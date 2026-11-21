import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { authError } from "../config/auth.js";
import { materialStorageDir, MAX_MATERIAL_FILE_SIZE } from "../utils/materialStorage.js";

const allowedExtensions = new Set([
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".csv", ".md",
  ".mp4", ".webm", ".mov", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".zip", ".rar", ".7z",
]);
const extension = (file) => path.extname(file.originalname).toLowerCase();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      mkdir(materialStorageDir, { recursive: true }).then(() => callback(null, materialStorageDir), callback);
    },
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${extension(file)}`),
  }),
  defParamCharset: "utf8",
  fileFilter: (_req, file, callback) => {
    if (!allowedExtensions.has(extension(file))) {
      return callback(authError(400, "INVALID_MATERIAL_FILE", "Choose a supported document, image, video, or archive."));
    }
    callback(null, true);
  },
  limits: { fileSize: MAX_MATERIAL_FILE_SIZE + 1, files: 1, fields: 4, fieldSize: 24 * 1024 },
}).single("file");

export function uploadMaterialFile(req, res, next) {
  upload(req, res, (error) => {
    if (error?.code === "LIMIT_FILE_SIZE") {
      return next(authError(413, "MATERIAL_FILE_TOO_LARGE", "File size exceeds the 50 MB limit."));
    }
    if (error instanceof multer.MulterError) {
      return next(authError(400, "INVALID_MATERIAL_UPLOAD", "Invalid material upload. Attach one file and check the form fields."));
    }
    next(error);
  });
}
