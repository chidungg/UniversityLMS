import { Search, User } from "lucide-react";
import { Input } from "../../components/ui/Input";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";

const formatShortDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

export const MessagesInbox = ({
  conversations,
  loading,
  searchQuery,
  onSearchChange,
  selectedUserId,
  onSelectConversation,
  isMobileHidden,
}) => {
  return (
    <aside
      aria-label="Conversations inbox"
      style={{
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-surface)",
        height: "100%",
        minHeight: 0,
        minWidth: 0,
      }}
      className={`messages-inbox-pane ${isMobileHidden ? "mobile-hidden" : ""}`}
    >
      <div style={{ padding: "14px", borderBottom: "1px solid var(--color-border-subtle)" }}>
        <Input
          icon={Search}
          aria-label="Search conversations"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ height: "38px" }}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ padding: "24px" }}>
            <LoadingSpinner message="Loading conversations..." />
          </div>
        ) : conversations.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {searchQuery.trim()
              ? "No matching conversations found."
              : "No conversations yet. Click 'New Message' to start a conversation."}
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = String(selectedUserId) === String(conv.user?._id);
            const dateLabel = formatShortDate(conv.lastMessage?.sentAt);

            return (
              <button
                key={conv.user?._id}
                type="button"
                onClick={() => onSelectConversation(conv.user._id)}
                aria-current={isSelected ? "true" : undefined}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "14px 16px",
                  border: "none",
                  borderBottom: "1px solid var(--color-border-subtle)",
                  borderLeft: isSelected ? "3px solid var(--color-primary-700)" : "3px solid transparent",
                  backgroundColor: isSelected ? "var(--color-primary-100)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background-color 0.12s ease",
                  width: "100%",
                }}
                className="lms-table-row"
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: isSelected ? "var(--color-primary-700)" : "var(--color-surface-soft)",
                    color: isSelected ? "#FFFFFF" : "var(--color-primary-700)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: "13px",
                    flexShrink: 0,
                  }}
                >
                  {conv.user?.fullName?.charAt(0)?.toUpperCase() || <User size={16} aria-hidden="true" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "2px",
                      gap: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: conv.unreadCount > 0 ? 700 : 600,
                        color: "var(--color-text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.user?.fullName || "User"}
                    </span>
                    {dateLabel && (
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: "11px",
                          color: isSelected ? "var(--color-text-secondary)" : "var(--color-text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        {dateLabel}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <p
                      style={{
                        fontSize: "12px",
                        fontWeight: conv.unreadCount > 0 ? 600 : 400,
                        color: conv.unreadCount > 0 ? "var(--color-text)" : "var(--color-text-secondary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: 1.4,
                        margin: 0,
                      }}
                    >
                      {conv.lastMessage ? conv.lastMessage.content : "No messages exchanged yet."}
                    </p>

                    {conv.unreadCount > 0 && (
                      <span
                        aria-label={`${conv.unreadCount} unread messages`}
                        className="tabular-nums"
                        style={{
                          backgroundColor: "var(--color-primary-700)",
                          color: "#FFFFFF",
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: "10px",
                          flexShrink: 0,
                        }}
                      >
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};
