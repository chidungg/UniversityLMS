import { Download, FileCheck } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { formatShortDate, formatFileSize } from "./formatters";

export const MaterialPreviewModal = ({ material, onClose, onDownload, downloading }) => {
  if (!material) return null;

  return (
    <Modal
      isOpen={Boolean(material)}
      onClose={onClose}
      title={material.title}
      maxWidth="620px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Download}
            loading={downloading}
            onClick={() => onDownload(material)}
          >
            Download Material
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Badge variant={material.type} />
          {material.courseId?.courseCode && (
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-primary-700)" }}>
              {material.courseId.courseCode}
            </span>
          )}
          <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
            Uploaded {formatShortDate(material.uploadedAt)}
          </span>
        </div>

        <div
          style={{
            backgroundColor: "var(--color-surface-soft)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
            padding: "16px",
          }}
        >
          <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)", marginBottom: "8px" }}>
            Description & Study Notes
          </h4>
          <p style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {material.description || "No description provided for this material."}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 14px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--color-primary-100)",
            color: "var(--color-primary-700)",
            fontSize: "13px",
          }}
        >
          <FileCheck size={18} style={{ flexShrink: 0 }} />
          <span>
            {material.fileName
              ? `Attached file: ${material.fileName}${material.fileSize ? ` (${formatFileSize(material.fileSize)})` : ""}`
              : material.fileUrl
                ? `Resource link: ${material.fileUrl}`
                : "Student view displays this material summary and download button."}
          </span>
        </div>
      </div>
    </Modal>
  );
};
