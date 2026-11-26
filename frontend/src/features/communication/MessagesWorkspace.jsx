import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../../app/AuthContext";
import { Breadcrumb } from "../../components/ui/Breadcrumb";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { MessagesInbox } from "./MessagesInbox";
import { MessageThread } from "./MessageThread";
import { NewMessageModal } from "./NewMessageModal";
import { MAX_MESSAGE_LENGTH } from "./MessageComposer";

export const MessagesWorkspace = ({
  basePath,
  breadcrumbs,
  title,
  emptySelectionDescription,
  recipientLabel,
  recipientPlaceholder,
  emptyRecipientsMessage,
  helperText,
  apiMethods,
}) => {
  const { user } = useAuth();
  const { userId } = useParams();
  const navigate = useNavigate();

  const selectedUserId = userId || "";

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeThread, setActiveThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState("");

  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const [showNewModal, setShowNewModal] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 820 : false
  );

  const threadRequestSeq = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 820px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiMethods.getConversations();
      if (res.status === "success") {
        setConversations(res.data || []);
        setError("");
      }
    } catch (err) {
      setError(err.message || "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  }, [apiMethods]);

  const fetchThread = useCallback(
    async (targetId) => {
      if (!targetId) {
        setActiveThread(null);
        setThreadError("");
        setThreadLoading(false);
        return;
      }

      const requestSeq = ++threadRequestSeq.current;
      setThreadLoading(true);
      setThreadError("");
      setSendError("");

      try {
        const res = await apiMethods.getMessagesWithUser(targetId);
        if (requestSeq !== threadRequestSeq.current) return;

        if (res.status === "success") {
          setActiveThread(res.data);
          setConversations((prev) =>
            prev.map((c) =>
              String(c.user?._id) === String(targetId) ? { ...c, unreadCount: 0 } : c
            )
          );
        }
      } catch (err) {
        if (requestSeq !== threadRequestSeq.current) return;
        setActiveThread(null);
        setThreadError(err.message || "Failed to load messages.");
      } finally {
        if (requestSeq === threadRequestSeq.current) {
          setThreadLoading(false);
        }
      }
    },
    [apiMethods]
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (selectedUserId) {
      setActiveThread(null);
      fetchThread(selectedUserId);
    } else {
      threadRequestSeq.current += 1;
      setActiveThread(null);
      setThreadError("");
      setThreadLoading(false);
    }
  }, [selectedUserId, fetchThread]);

  const handleSelectConversation = (contactId) => {
    setSendError("");
    navigate(`${basePath}/${contactId}`);
  };

  const handleBackToInbox = () => {
    setActiveThread(null);
    setThreadError("");
    setSendError("");
    navigate(basePath);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!selectedUserId || sending) return;

    const trimmed = messageText.trim();
    if (!trimmed) {
      setSendError("Message content cannot be empty.");
      return;
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Message content cannot exceed ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    setSending(true);
    setSendError("");

    try {
      const targetId = selectedUserId;
      const res = await apiMethods.sendMessage({
        recipientId: targetId,
        content: trimmed,
      });

      if (res.status === "success") {
        setMessageText("");
        await Promise.all([fetchThread(targetId), fetchConversations()]);
      }
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleCreateNewConversation = async ({ recipientId, content }) => {
    const res = await apiMethods.sendMessage({ recipientId, content });
    if (res.status === "success") {
      setShowNewModal(false);
      navigate(`${basePath}/${recipientId}`);
      await fetchConversations();
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
    <div className="lms-page">
      <Breadcrumb items={breadcrumbs} />

      <div className="lms-page-header">
        <div className="lms-page-header-left">
          <h1>{title}</h1>
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

      <div className="lms-chat-shell">
        <MessagesInbox
          conversations={filteredConversations}
          loading={loading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedUserId={selectedUserId}
          onSelectConversation={handleSelectConversation}
          isMobileHidden={isMobile && Boolean(selectedUserId)}
        />

        <MessageThread
          selectedUserId={selectedUserId}
          activeThread={activeThread}
          currentUserId={user?._id}
          threadLoading={threadLoading}
          threadError={threadError}
          onRetryThread={() => fetchThread(selectedUserId)}
          onBackToInbox={handleBackToInbox}
          onOpenNewModal={() => setShowNewModal(true)}
          messageText={messageText}
          onMessageTextChange={(val) => {
            setMessageText(val);
            if (sendError) setSendError("");
          }}
          onSendMessage={handleSendMessage}
          sending={sending}
          sendError={sendError}
          emptySelectionDescription={emptySelectionDescription}
          isMobileHidden={isMobile && !selectedUserId}
        />
      </div>

      <NewMessageModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        fetchRecipients={apiMethods.getRecipients}
        onSendMessage={handleCreateNewConversation}
        recipientLabel={recipientLabel}
        recipientPlaceholder={recipientPlaceholder}
        emptyRecipientsMessage={emptyRecipientsMessage}
        helperText={helperText}
      />
    </div>
  );
};
