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
      className={`lms-chat-thread ${isMobileHidden ? "mobile-hidden" : ""}`}
    >
      {!selectedUserId ? (
        <div style={{ margin: "auto", textAlign: "center", padding: "32px", maxWidth: "360px" }}>
          <div className="lms-empty-icon" style={{ margin: "0 auto 12px" }}>
            <MessageSquare size={22} aria-hidden="true" />
          </div>
          <h2 style={{ marginBottom: "6px" }}>Select a conversation</h2>
          <p style={{ fontSize: "13px", lineHeight: 1.5, marginBottom: "14px" }}>
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
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              onClick={onBackToInbox}
              className="lms-chat-back-btn"
            >
              Back
            </Button>
          </div>
          <ErrorBanner message={threadError} onRetry={onRetryThread} />
        </div>
      ) : activeThread ? (
        <>
          <div className="lms-chat-thread-head">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              <button
                type="button"
                onClick={onBackToInbox}
                className="lms-chat-back-btn lms-mobile-toggle"
                aria-label="Back to messages inbox"
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </button>

              <div className="lms-chat-avatar" aria-hidden="true">
                {activeThread.recipient?.fullName?.charAt(0)?.toUpperCase() || <User size={15} />}
              </div>

              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    fontSize: "15px",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeThread.recipient?.fullName}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "12px" }}>{activeThread.recipient?.email}</span>
                  {activeThread.recipient?.role && (
                    <Badge
                      variant="DEFAULT"
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
            className="lms-chat-thread-body"
          >
            {threadLoading ? (
              <LoadingSpinner message="Refreshing messages..." />
            ) : !activeThread.messages || activeThread.messages.length === 0 ? (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: "340px" }}>
                <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
                  No messages yet with {activeThread.recipient?.fullName}
                </p>
                <p style={{ fontSize: "12px", margin: 0 }}>
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
                      className={`lms-chat-bubble ${
                        isOwnMessage ? "lms-chat-bubble--self" : "lms-chat-bubble--other"
                      }`}
                      style={{ maxWidth: "75%" }}
                    >
                      {msg.content}
                    </div>

                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: "11px",
                        marginTop: "3px",
                        padding: "0 2px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{timestamp}</span>
                      {isOwnMessage && <span>· {msg.isRead ? "Read" : "Sent"}</span>}
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
