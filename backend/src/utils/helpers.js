import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Escape special characters in string for safe regular expression use.
 * Prevents ReDoS attacks and regex syntax errors when users search characters like *, +, (, ), [, ], etc.
 */
export const escapeRegex = (string) => {
  if (!string || typeof string !== "string") return "";
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Resolve a file URL safely against allowed base directories.
 * Prevents directory traversal attacks (e.g., ../../etc/passwd).
 *
 * @param {string} fileUrl - The relative URL or path to the file (e.g. /demo-assets/... or /uploads/...)
 * @param {string[]} allowedDirs - List of absolute paths of permitted directories
 * @returns {{ isAllowed: boolean, resolvedPath: string | null, exists: boolean }}
 */
export const resolveSafeFilePath = (fileUrl, allowedDirs) => {
  if (!fileUrl || typeof fileUrl !== "string") {
    return { isAllowed: false, resolvedPath: null, exists: false };
  }

  // Normalize slashes
  const normalizedUrl = fileUrl.replace(/\\/g, "/").trim();

  for (const baseDir of allowedDirs) {
    const folderName = path.basename(baseDir);
    const prefixSlash = `/${folderName}/`;
    const prefixBare = `${folderName}/`;

    if (normalizedUrl.startsWith(prefixSlash) || normalizedUrl.startsWith(prefixBare)) {
      const relativePart = normalizedUrl.replace(new RegExp(`^\\/?${folderName}\\/`), "");
      const resolved = path.resolve(baseDir, relativePart);
      const normalizedBase = path.resolve(baseDir);

      // Verify resolved path is strictly within the allowed directory
      if (resolved.startsWith(normalizedBase + path.sep) || resolved === normalizedBase) {
        const exists = fs.existsSync(resolved);
        return { isAllowed: true, resolvedPath: resolved, exists };
      } else {
        // Path traversal attempted
        return { isAllowed: false, resolvedPath: null, exists: false };
      }
    }
  }

  return { isAllowed: false, resolvedPath: null, exists: false };
};
