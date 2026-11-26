import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Modal } from "../../components/ui/Modal";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { MAX_MESSAGE_LENGTH } from "./MessageComposer";

export const NewMessageModal = ({
  isOpen,
  onClose,
  fetchRecipients,
  onSendMessage,
  recipientLabel = "Select Recipient",
  recipientPlaceholder = "-- Choose a Recipient --",
  emptyRecipientsMessage = "No eligible recipients are available.",
  helperText = "Messages will be delivered to the recipient's LMS inbox.",
}) => {
  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientId, setRecipientId] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError("");
    setLoadingRecipients(true);

    fetchRecipients()
      .then((res) => {
        if (cancelled) return;
        const list = res?.data || [];
        setRecipients(list);
        setRecipientId((prev) => {
          if (prev && list.some((r) => String(r._id) === String(prev))) return prev;
          return list.length > 0 ? list[0]._id : "";
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setRecipients([]);
          setError(err.message || "Failed to load eligible recipients.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipients(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, fetchRecipients]);

  const handleClose = () => {
    if (sending) return;
    setError("");
    setContent("");
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setError("");

    if (!recipientId) {
      setError("Please select a recipient.");
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      setError("Message content cannot be empty.");
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setError(`Message content cannot exceed ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    setSending(true);
    try {
      await onSendMessage({ recipientId, content: trimmed });
      setContent("");
      setError("");
    } catch (err) {
      setError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Compose New Message"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Send}
            loading={sending}
            disabled={sending || loadingRecipients || recipients.length === 0}
            onClick={handleSubmit}
          >
            Send Message
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {error && (
          <div
            role="alert"
            style={{
              padding: "8px 12px",
              borderRadius: "4px",
              backgroundColor: "var(--color-danger-bg)",
              color: "var(--color-danger)",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {loadingRecipients ? (
          <LoadingSpinner message="Loading eligible recipients..." />
        ) : recipients.length === 0 ? (
          <div
            style={{
              padding: "14px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "var(--color-surface-soft)",
              border: "1px solid var(--color-border)",
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {emptyRecipientsMessage}
          </div>
        ) : (
          <>
            <Select
              id="new-message-recipient"
              label={recipientLabel}
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
            >
              <option value="">{recipientPlaceholder}</option>
              {recipients.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.fullName} ({r.courses && r.courses.length > 0 ? r.courses.join(", ") : r.email})
                </option>
              ))}
            </Select>

            <Textarea
              id="new-message-content"
              label="Message Content"
              rows={4}
              placeholder="Write your message..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              helperText={`${helperText} (${content.trim().length}/${MAX_MESSAGE_LENGTH} characters)`}
            />
          </>
        )}
      </form>
    </Modal>
  );
};
