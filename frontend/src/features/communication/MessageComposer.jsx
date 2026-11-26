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
    <div
      style={{
        padding: "16px 20px",
        backgroundColor: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      {disabled ? (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
            fontSize: "13px",
          }}
        >
          {disabledReason || "Replies are disabled for this conversation."}
        </div>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              style={{
                color: "var(--color-danger)",
                fontSize: "12px",
                marginBottom: "8px",
                fontWeight: 500,
              }}
            >
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
                placeholder={`Message ${recipientName || "recipient"}... (Press Enter to send)`}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${isOverLimit ? "var(--color-danger)" : "var(--color-border)"}`,
                  backgroundColor: "var(--color-page)",
                  color: "var(--color-text)",
                  fontSize: "13px",
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  lineHeight: 1.45,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: isOverLimit ? "var(--color-danger)" : "var(--color-text-muted)",
                }}
              >
                <span>Shift + Enter for a new line</span>
                <span className="tabular-nums">
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
