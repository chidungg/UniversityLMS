import { Send } from "lucide-react";
import { Button } from "../../components/ui/Button";

export const MAX_MESSAGE_LENGTH = 2000;

export const MessageComposer = ({
  recipientName,
  value,
  onChange,
  onSubmit,
  sending,
  error,
  disabled = false,
  disabledReason = "",
}) => {
  const trimmedLength = value.trim().length;
  const isOverLimit = trimmedLength > MAX_MESSAGE_LENGTH;

  return (
    <div className="lms-chat-composer">
      {disabled ? (
        <div role="status" className="lms-info-box">
          {disabledReason || "Replies are disabled for this conversation."}
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="lms-field-error" style={{ marginBottom: "8px" }}>
              {error}
            </div>
          )}

          <form
            onSubmit={onSubmit}
            style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}
          >
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
              <textarea
                rows={2}
                aria-label={`Message ${recipientName || "recipient"}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e);
                  }
                }}
                disabled={sending}
                placeholder={`Message ${recipientName || "recipient"}... (Enter to send)`}
                className={`lms-chat-textarea ${isOverLimit ? "is-error" : ""}`}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <span>Shift + Enter for a new line</span>
                <span className="tabular-nums" style={{ fontWeight: isOverLimit ? 700 : 400 }}>
                  {trimmedLength} / {MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Send}
              loading={sending}
              disabled={sending}
              style={{ marginBottom: "18px" }}
            >
              Send
            </Button>
          </form>
        </>
      )}
    </div>
  );
};
