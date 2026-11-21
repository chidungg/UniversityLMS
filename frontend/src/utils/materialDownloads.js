import { downloadBlob } from "./downloadBlob";

export function externalMaterialUrl(value) {
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {
    return null;
  }
  return null;
}

export async function openMaterialResource(material, loadBlob) {
  const link = externalMaterialUrl(material.fileUrl);
  if (link) {
    window.open(link, "_blank", "noopener,noreferrer");
    return;
  }

  const blob = await loadBlob(material._id);
  const legacyName = material.fileUrl?.split(/[\\/]/).at(-1);
  downloadBlob(blob, material.fileName || legacyName || material.title || "material");
}
