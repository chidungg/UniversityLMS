import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { AlertTriangle } from "lucide-react";

export const ConfirmDeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  itemName,
  warningText = "This action cannot be undone.",
  confirmLabel = "Delete",
  loading = false,
  error,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!loading) onClose(); }}
      title={title}
      maxWidth="460px"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && <ErrorBanner message={error} />}
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginTop: error ? "12px" : undefined }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            backgroundColor: "var(--color-danger-bg)",
            color: "var(--color-danger)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={18} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <p style={{ fontSize: "14px", color: "var(--color-text)", lineHeight: 1.5 }}>
            Are you sure you want to delete{" "}
            {itemName ? <strong>"{itemName}"</strong> : "this item"}?
          </p>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            {warningText}
          </p>
        </div>
      </div>
    </Modal>
  );
};
