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
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});
