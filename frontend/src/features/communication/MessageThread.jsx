import { useEffect, useRef } from "react";
import { ArrowLeft, MessageSquare, Plus, User } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { MessageComposer } from "./MessageComposer";

const formatMessageTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const MessageThread = ({
  selectedUserId,
  activeThread,
  currentUserId,
  threadLoading,
  threadError,
  onRetryThread,
  onBackToInbox,
  onOpenNewModal,
  messageText,
  onMessageTextChange,
  onSendMessage,
  sending,
  sendError,
  emptySelectionDescription,
  isMobileHidden,
}) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [activeThread?.messages?.length, selectedUserId]);

  return (
    <section
      aria-label="Message conversation"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        backgroundColor: "var(--color-page)",
      }}
      className={`messages-thread-pane ${isMobileHidden ? "mobile-hidden" : ""}`}
    >
      {!selectedUserId ? (
        <div style={{ margin: "auto", textAlign: "center", padding: "32px", maxWidth: "380px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "var(--color-primary-100)",
              color: "var(--color-primary-700)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px auto",
            }}
          >
            <MessageSquare size={26} aria-hidden="true" />
          </div>
          <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text)", marginBottom: "6px" }}>
            Select a conversation
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "var(--color-text-secondary)",
              lineHeight: 1.5,
              marginBottom: "16px",
            }}
          >
            {emptySelectionDescription}
          </p>
          <Button variant="primary" size="sm" icon={Plus} onClick={onOpenNewModal}>
            New Message
          </Button>
        </div>
      ) : threadLoading && !activeThread ? (
        <div style={{ margin: "auto", padding: "32px" }}>
          <LoadingSpinner message="Loading conversation..." />
        </div>
      ) : threadError && !activeThread ? (
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              onClick={onBackToInbox}
              className="mobile-back-btn"
            >
              Back
            </Button>
          </div>
          <ErrorBanner message={threadError} onRetry={onRetryThread} />
        </div>
      ) : activeThread ? (
        <>
          <div
            style={{
              padding: "12px 20px",
              backgroundColor: "var(--color-surface)",
              borderBottom: "1px solid var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <button
                type="button"
                onClick={onBackToInbox}
                className="mobile-back-btn"
                style={{
                  display: "none",
                  background: "transparent",
                  border: "none",
                  color: "var(--color-text)",
                  cursor: "pointer",
                  padding: "6px",
                  marginRight: "2px",
                  minWidth: "36px",
                  minHeight: "36px",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Back to messages inbox"
              >
                <ArrowLeft size={18} />
              </button>

              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: "var(--color-primary-100)",
                  color: "var(--color-primary-700)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: "14px",
                  flexShrink: 0,
                }}
              >
                {activeThread.recipient?.fullName?.charAt(0)?.toUpperCase() || <User size={16} aria-hidden="true" />}
              </div>

              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--color-text)",
                    lineHeight: 1.2,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeThread.recipient?.fullName}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {activeThread.recipient?.email}
                  </span>
                  {activeThread.recipient?.role && (
                    <Badge
                      variant="SUBMITTED"
                      label={activeThread.recipient.role}
                      size="sm"
                      showDot={false}
                    />
                  )}
                  {activeThread.recipient?.isActive === false && (
                    <Badge variant="INACTIVE" size="sm" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            role="log"
            aria-label="Message history"
            tabIndex={0}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              outline: "none",
            }}
          >
            {threadLoading ? (
              <LoadingSpinner message="Refreshing messages..." />
            ) : !activeThread.messages || activeThread.messages.length === 0 ? (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: "340px", color: "var(--color-text-muted)" }}>
                <MessageSquare size={32} style={{ margin: "0 auto 10px auto", color: "var(--color-border)" }} />
                <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text)" }}>
                  No messages yet with {activeThread.recipient?.fullName}
                </p>
                <p style={{ fontSize: "12px", marginTop: "4px" }}>
                  Send a message below to begin this conversation.
                </p>
              </div>
            ) : (
              activeThread.messages.map((msg) => {
                const senderId =
                  typeof msg.senderId === "object" && msg.senderId !== null
                    ? msg.senderId._id
                    : msg.senderId;
                const isOwnMessage = Boolean(currentUserId) && String(senderId) === String(currentUserId);
                const timestamp = formatMessageTimestamp(msg.sentAt);

                return (
                  <div
                    key={msg._id}
                    data-sender={isOwnMessage ? "self" : "other"}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isOwnMessage ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "75%",
                        padding: "12px 16px",
                        borderRadius: isOwnMessage ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                        backgroundColor: isOwnMessage ? "var(--color-primary-700)" : "var(--color-surface)",
                        color: isOwnMessage ? "#FFFFFF" : "var(--color-text)",
                        border: isOwnMessage ? "none" : "1px solid var(--color-border)",
                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
                        fontSize: "14px",
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {msg.content}
                    </div>

                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: "11px",
                        color: "var(--color-text-muted)",
                        marginTop: "4px",
                        padding: "0 4px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{timestamp}</span>
                      {isOwnMessage && (
                        <span>• {msg.isRead ? "Read" : "Sent"}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <MessageComposer
            recipientName={activeThread.recipient?.fullName}
            value={messageText}
            onChange={onMessageTextChange}
            onSubmit={onSendMessage}
            sending={sending}
            error={sendError || threadError}
            disabled={activeThread.canReply === false}
            disabledReason={
              activeThread.recipient?.isActive === false
                ? "This user's account is inactive and cannot receive new messages."
                : "You can no longer send new messages in this conversation because you no longer share an active course."
            }
          />
        </>
      ) : null}
    </section>
  );
};
