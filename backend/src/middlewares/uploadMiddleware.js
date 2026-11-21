import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.resolve(__dirname, "../../uploads/submissions");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt",
  ".zip", ".rar", ".7z", ".tar", ".gz",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".csv", ".xlsx", ".xls", ".pptx", ".ppt",
  ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cpp", ".c", ".cs", ".html", ".css", ".json", ".sql", ".md"
]);

const DISALLOWED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".vbs", ".msi", ".dll", ".com", ".scr", ".bin", ".apk", ".app"
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ext || DISALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error("Unsupported file type. Executable or binary files are not permitted."));
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Unsupported file type '${ext}'. Please upload an academic document, code file, archive, or image.`));
  }
  cb(null, true);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueSuffix = Date.now() + "_" + Math.round(Math.random() * 1e9);
    cb(null, `${basename}_${uniqueSuffix}${ext}`);
  },
});

export const uploadSubmissionFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

/**
 * Express middleware wrapper to catch Multer errors and return clean 400 Bad Request responses.
 */
export const handleSubmissionUpload = (req, res, next) => {
  uploadSubmissionFile.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: "error",
          message: "File size exceeds the allowed limit of 25MB.",
        });
      }
      return res.status(400).json({
        status: "error",
        message: err.message || "File upload failed.",
      });
    }
    next();
  });
};
