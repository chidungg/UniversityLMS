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
      className={`lms-chat-inbox ${isMobileHidden ? "mobile-hidden" : ""}`}
    >
      <div className="lms-chat-inbox-search">
        <Input
          icon={Search}
          aria-label="Search conversations"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="lms-chat-inbox-list">
        {loading ? (
          <div style={{ padding: "20px" }}>
            <LoadingSpinner message="Loading conversations..." />
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ padding: "28px 16px", textAlign: "center", fontSize: "13px", lineHeight: 1.5 }}>
            {searchQuery.trim()
              ? "No matching conversations found."
              : "No conversations yet. Click 'New Message' to start one."}
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
                className={`lms-chat-inbox-item ${isSelected ? "is-selected" : ""}`}
              >
                <div className="lms-chat-avatar" aria-hidden="true">
                  {conv.user?.fullName?.charAt(0)?.toUpperCase() || <User size={15} />}
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
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.user?.fullName || "User"}
                    </span>
                    {dateLabel && (
                      <span className="tabular-nums" style={{ fontSize: "11px", flexShrink: 0 }}>
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
                        className="lms-chat-unread-count"
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
