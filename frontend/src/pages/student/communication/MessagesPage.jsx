import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Search,
  Send,
  Plus,
  User,
  ArrowLeft,
} from "lucide-react";
import { api } from "../../../services/api";
import { Breadcrumb } from "../../../components/ui/Breadcrumb";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Textarea } from "../../../components/ui/Textarea";
import { Select } from "../../../components/ui/Select";
import { Modal } from "../../../components/ui/Modal";
import { LoadingSpinner } from "../../../components/ui/LoadingSpinner";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";

export const MessagesPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Active Thread State
  const [selectedUserId, setSelectedUserId] = useState(userId || "");
  const [activeThread, setActiveThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");

  // Composer State
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  // New Message Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [newRecipientId, setNewRecipientId] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newModalError, setNewModalError] = useState("");
  const [newModalSending, setNewModalSending] = useState(false);

  const messagesEndRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.getConversations();
      if (res.status === "success") {
        setConversations(res.data);
        // If no user selected yet and on desktop, select first conversation
        if (!selectedUserId && res.data.length > 0 && window.innerWidth > 768) {
          setSelectedUserId(res.data[0].user._id);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  }, [selectedUserId]);

  const fetchThread = useCallback(async (targetId) => {
    if (!targetId) return;
    setThreadLoading(true);
    setThreadError("");
    try {
      const res = await api.getMessagesWithUser(targetId);
      if (res.status === "success") {
        setActiveThread(res.data);
      }
    } catch (err) {
      setThreadError(err.message || "Failed to load messages.");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const fetchRecipients = useCallback(async () => {
    try {
      const res = await api.getRecipients();
      if (res.status === "success") {
        setRecipients(res.data);
        if (res.data.length > 0 && !newRecipientId) {
          setNewRecipientId(res.data[0]._id);
        }
      }
    } catch (err) {
      console.error("Failed to load recipients:", err);
    }
  }, [newRecipientId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (userId) {
      setSelectedUserId(userId);
    }
  }, [userId]);

  useEffect(() => {
    if (selectedUserId) {
      fetchThread(selectedUserId);
    } else {
      setActiveThread(null);
    }
  }, [selectedUserId, fetchThread]);

  useEffect(() => {
    if (showNewModal) {
      fetchRecipients();
    }
  }, [showNewModal, fetchRecipients]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread]);

  const handleSelectConversation = (contactId) => {
    setSelectedUserId(contactId);
    navigate(`/student/messages/${contactId}`);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !selectedUserId || sending) return;

    setSending(true);
    try {
      const res = await api.sendMessage({
        recipientId: selectedUserId,
        content: messageText.trim(),
      });

      if (res.status === "success") {
        setMessageText("");
        // Refresh thread & conversations
        await fetchThread(selectedUserId);
        await fetchConversations();
      }
    } catch (err) {
      setThreadError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleCreateNewConversation = async (e) => {
    e.preventDefault();
    setNewModalError("");

    if (!newRecipientId) {
      setNewModalError("Please select an instructor to message.");
      return;
    }

    if (!newContent.trim()) {
      setNewModalError("Message content cannot be empty.");
      return;
    }

    setNewModalSending(true);
    try {
      const res = await api.sendMessage({
        recipientId: newRecipientId,
        content: newContent.trim(),
      });

      if (res.status === "success") {
        setShowNewModal(false);
        setNewContent("");
        setSelectedUserId(newRecipientId);
        navigate(`/student/messages/${newRecipientId}`);
        await fetchConversations();
        await fetchThread(newRecipientId);
      }
    } catch (err) {
      setNewModalError(err.message || "Failed to send message.");
    } finally {
      setNewModalSending(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (
      c.user?.fullName?.toLowerCase().includes(term) ||
      c.user?.email?.toLowerCase().includes(term) ||
      (c.lastMessage && c.lastMessage.content?.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <Breadcrumb
        items={[
          { label: "Dashboard", to: "/student/dashboard" },
          { label: "Messages" },
        ]}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          paddingBottom: "16px",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--color-text)", marginBottom: "4px" }}>
            Student Communication & Messages
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            Direct messaging channel with course instructors and teaching assistants.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setShowNewModal(true)}
        >
          New Message
        </Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchConversations} />}

      {/* Two-Column Chat Surface */}
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          height: "calc(100vh - 270px)",
          minHeight: "520px",
          overflow: "hidden",
        }}
        className="messages-container-grid"
      >
        {/* Left Pane: Conversations Inbox */}
        <aside
          style={{
            borderRight: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--color-surface)",
            height: "100%",
          }}
          className={`messages-inbox-pane ${selectedUserId && window.innerWidth <= 768 ? "mobile-hidden" : ""}`}
        >
          {/* Inbox Search Bar */}
          <div style={{ padding: "14px", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <Input
              icon={Search}
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: "36px" }}
            />
          </div>

          {/* Conversations List */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {loading ? (
              <div style={{ padding: "24px" }}>
                <LoadingSpinner message="Loading conversations..." />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: "13px" }}>
                {searchQuery ? "No matching conversations found." : "No messages yet. Click 'New Message' to start a conversation."}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedUserId === conv.user._id;
                const lastMsgDate = conv.lastMessage ? new Date(conv.lastMessage.sentAt) : null;

                return (
                  <button
                    key={conv.user._id}
                    type="button"
                    onClick={() => handleSelectConversation(conv.user._id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "14px 16px",
                      border: "none",
                      borderBottom: "1px solid var(--color-border-subtle)",
                      backgroundColor: isSelected ? "var(--color-primary-100)" : "transparent",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background-color 0.12s ease",
                      width: "100%",
                      position: "relative",
                    }}
                    className="lms-table-row"
                  >
                    {/* User Avatar */}
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
                      {conv.user.fullName?.charAt(0) || <User size={16} />}
                    </div>

                    {/* Meta & Preview */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {conv.user.fullName}
                        </span>
                        {lastMsgDate && (
                          <span className="tabular-nums" style={{ fontSize: "11px", color: "var(--color-text-muted)", flexShrink: 0, marginLeft: "6px" }}>
                            {lastMsgDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "var(--color-text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1.4,
                          }}
                        >
                          {conv.lastMessage ? conv.lastMessage.content : "No messages exchanged yet."}
                        </p>

                        {conv.unreadCount > 0 && (
                          <span
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

        {/* Right Pane: Conversation Thread */}
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            backgroundColor: "var(--color-page)",
          }}
          className={`messages-thread-pane ${!selectedUserId && window.innerWidth <= 768 ? "mobile-hidden" : ""}`}
        >
          {selectedUserId && activeThread ? (
            <>
              {/* Thread Header */}
              <div
                style={{
                  padding: "12px 20px",
                  backgroundColor: "var(--color-surface)",
                  borderBottom: "1px solid var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserId("");
                      navigate("/student/messages");
                    }}
                    className="mobile-back-btn"
                    style={{
                      display: "none",
                      background: "transparent",
                      border: "none",
                      color: "var(--color-text)",
                      cursor: "pointer",
                      padding: "4px",
                      marginRight: "4px",
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
                    }}
                  >
                    {activeThread.recipient?.fullName?.charAt(0) || <User size={16} />}
                  </div>

                  <div>
                    <h2 style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text)", lineHeight: 1.2 }}>
                      {activeThread.recipient?.fullName}
                    </h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                      <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                        {activeThread.recipient?.email || activeThread.recipient?.department || "Instructor"}
                      </span>
                      <Badge variant="SUBMITTED" label="Instructor" size="sm" showDot={false} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages Chat Scroll Area */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {threadLoading ? (
                  <LoadingSpinner message="Loading thread history..." />
                ) : activeThread.messages?.length === 0 ? (
                  <div style={{ margin: "auto", textAlign: "center", maxWidth: "340px", color: "var(--color-text-muted)" }}>
                    <MessageSquare size={32} style={{ margin: "0 auto 10px auto", color: "var(--color-border)" }} />
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-text)" }}>
                      No messages yet with {activeThread.recipient?.fullName}
                    </p>
                    <p style={{ fontSize: "12px", marginTop: "4px" }}>
                      Send your inquiry or project question below to begin this conversation.
                    </p>
                  </div>
                ) : (
                  activeThread.messages.map((msg) => {
                    const isStudentSender = msg.senderId === "1d0896ec8cc60f07c79dfeb1";
                    const sentDate = new Date(msg.sentAt);

                    return (
                      <div
                        key={msg._id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isStudentSender ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "75%",
                            padding: "12px 16px",
                            borderRadius: isStudentSender
                              ? "14px 14px 2px 14px"
                              : "14px 14px 14px 2px",
                            backgroundColor: isStudentSender
                              ? "var(--color-primary-700)"
                              : "var(--color-surface)",
                            color: isStudentSender ? "#FFFFFF" : "var(--color-text)",
                            border: isStudentSender ? "none" : "1px solid var(--color-border)",
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
                          }}
                        >
                          {sentDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div
                style={{
                  padding: "16px 20px",
                  backgroundColor: "var(--color-surface)",
                  borderTop: "1px solid var(--color-border)",
                }}
              >
                {threadError && (
                  <div style={{ color: "var(--color-danger)", fontSize: "12px", marginBottom: "8px" }}>
                    {threadError}
                  </div>
                )}
                <form
                  onSubmit={handleSendMessage}
                  style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}
                >
                  <textarea
                    rows={2}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Message ${activeThread.recipient?.fullName || "instructor"}... (Press Enter to send)`}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-border)",
                      backgroundColor: "var(--color-page)",
                      color: "var(--color-text)",
                      fontSize: "13px",
                      resize: "none",
                      outline: "none",
                      fontFamily: "inherit",
                    }}
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={Send}
                    loading={sending}
                    disabled={!messageText.trim()}
                  >
                    Send
                  </Button>
                </form>
              </div>
            </>
          ) : (
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
                <MessageSquare size={26} />
              </div>
              <h2 style={{ fontSize: "17px", fontWeight: 600, color: "var(--color-text)", marginBottom: "6px" }}>
                Select a conversation
              </h2>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: "16px" }}>
                Choose an existing message thread on the left or compose a new inquiry to communicate with your faculty instructors.
              </p>
              <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowNewModal(true)}>
                New Message
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* New Message Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Compose New Message"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowNewModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Send}
              loading={newModalSending}
              onClick={handleCreateNewConversation}
            >
              Send Message
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateNewConversation} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {newModalError && (
            <div style={{ padding: "8px 12px", borderRadius: "4px", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", fontSize: "13px" }}>
              {newModalError}
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 500, color: "var(--color-text)", marginBottom: "6px" }}>
              Select Instructor / Teaching Assistant:
            </label>
            <Select
              value={newRecipientId}
              onChange={(e) => setNewRecipientId(e.target.value)}
            >
              <option value="">-- Choose an Instructor --</option>
              {recipients.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.fullName} ({r.courses ? r.courses.join(", ") : r.email})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Textarea
              label="Message Content"
              rows={4}
              placeholder="State your question or inquiry clearly with course references..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              helperText="Messages will be routed directly to the instructor's LMS inbox."
            />
          </div>
        </form>
      </Modal>

      <style>{`
        @media (max-width: 768px) {
          .messages-container-grid {
            grid-template-columns: 1fr !important;
          }
          .mobile-hidden {
            display: none !important;
          }
          .mobile-back-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </div>
  );
};
