import { AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";

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
      <div className="lms-form-stack">
        {error && <ErrorBanner message={error} />}
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "4px",
              backgroundColor: "var(--color-danger-bg)",
              border: "1px solid #DC2626",
              color: "#111111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={17} aria-hidden="true" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <p style={{ fontSize: "14px", lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to delete{" "}
              {itemName ? <strong>&ldquo;{itemName}&rdquo;</strong> : "this item"}?
            </p>
            <p style={{ fontSize: "13px", lineHeight: 1.5, margin: 0 }}>{warningText}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
