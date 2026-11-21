import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authError } from "../config/auth.js";
import { resolveSafeFilePath } from "./helpers.js";

// Uploaded materials are served only by the authorized Student/Instructor routes.
export const materialStorageDir = fileURLToPath(new URL("../../private-materials.local", import.meta.url));
export const MAX_MATERIAL_FILE_SIZE = 50 * 1024 * 1024;
const legacyRoots = ["demo-assets", "uploads"].map((dir) => fileURLToPath(new URL(`../../${dir}`, import.meta.url)));

function storedFilePath(key) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.[a-z0-9]+$/.test(key)) {
    throw authError(400, "INVALID_MATERIAL_LOCATION", "Invalid file location format or access denied.");
  }
  return path.join(materialStorageDir, key);
}

export async function removeStoredMaterial(key) {
  if (key) await rm(storedFilePath(key), { force: true });
}

export function materialExternalUrl(value) {
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {
    return null;
  }
  return null;
}

export async function sendMaterialResource(material, res) {
  if (material.storageKey) {
    const filePath = storedFilePath(material.storageKey);
    const file = await stat(filePath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
    if (!file?.isFile()) throw authError(404, "MATERIAL_FILE_NOT_FOUND", "The requested file could not be found on the server.");
    return res.download(filePath, material.fileName, { headers: { "X-Content-Type-Options": "nosniff" } });
  }

  const fileUrl = material.fileUrl?.trim();
  if (!fileUrl) throw authError(404, "MATERIAL_FILE_NOT_FOUND", "No original file is attached to this learning material.");
  const externalUrl = materialExternalUrl(fileUrl);
  if (externalUrl) return res.redirect(externalUrl);

  const legacyFile = resolveSafeFilePath(fileUrl, legacyRoots);
  if (!legacyFile.isAllowed) throw authError(400, "INVALID_MATERIAL_LOCATION", "Invalid file location format or access denied.");
  if (!legacyFile.exists) throw authError(404, "MATERIAL_FILE_NOT_FOUND", "The requested file could not be found on the server.");
  return res.download(legacyFile.resolvedPath, { headers: { "X-Content-Type-Options": "nosniff" } });
}
