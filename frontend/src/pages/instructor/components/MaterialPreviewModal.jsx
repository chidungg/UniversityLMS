import { Download, FileCheck } from "lucide-react";
import { Modal } from "../../../components/ui/Modal";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { externalMaterialUrl } from "../../../utils/materialDownloads";
import { formatShortDate, formatFileSize } from "./formatters";

export const MaterialPreviewModal = ({ material, onClose, onDownload, downloading, error }) => {
  if (!material) return null;
  const link = externalMaterialUrl(material.fileUrl);

  return (
    <Modal
      isOpen={Boolean(material)}
      onClose={onClose}
      title={material.title}
      maxWidth="600px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          {material.fileUrl && (
            <Button
              variant="primary"
              size="sm"
              icon={Download}
              loading={downloading}
              onClick={() => onDownload(material)}
            >
              {link ? "Open Resource Link" : "Download Material"}
            </Button>
          )}
        </>
      }
    >
      <div className="lms-form-stack">
        {error && <ErrorBanner message={error} />}

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Badge variant={material.type} size="sm" />
          {material.courseId?.courseCode && (
            <span className="lms-course-code">{material.courseId.courseCode}</span>
          )}
          <span className="tabular-nums" style={{ fontSize: "13px" }}>
            Uploaded {formatShortDate(material.uploadedAt)}
          </span>
        </div>

        {material.description && (
          <div className="lms-info-box">
            <h4 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Description &amp; Study Notes
            </h4>
            <p style={{ fontSize: "14px", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>
              {material.description}
            </p>
          </div>
        )}

        <div
          className="lms-info-box"
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
        >
          <FileCheck size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span style={{ overflowWrap: "anywhere" }}>
            {material.fileName
              ? `Attached file: ${material.fileName}${material.fileSize ? ` (${formatFileSize(material.fileSize)})` : ""}`
              : link
                ? `Resource link: ${link}`
                : material.fileUrl
                  ? "Attached file"
                  : "No file or link attached."}
          </span>
        </div>
      </div>
    </Modal>
  );
};
