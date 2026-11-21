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
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const legacyName = material.fileUrl?.split(/[\\/]/).at(-1);
  anchor.download = material.fileName || legacyName || material.title || "material";
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
