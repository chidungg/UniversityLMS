import { useMemo } from "react";
import { api } from "../../../services/api";
import { MessagesWorkspace } from "../../../features/communication/MessagesWorkspace";

export const MessagesPage = () => {
  const apiMethods = useMemo(
    () => ({
      getConversations: api.getConversations,
      getMessagesWithUser: api.getMessagesWithUser,
      sendMessage: api.sendMessage,
      getRecipients: api.getRecipients,
    }),
    []
  );

  return (
    <MessagesWorkspace
      basePath="/student/messages"
      breadcrumbs={[
        { label: "Dashboard", to: "/student/dashboard" },
        { label: "Messages" },
      ]}
      title="Student Communication & Messages"
      subtitle="Direct messaging channel with instructors assigned to your active courses."
      emptySelectionDescription="Choose an existing conversation on the left or compose a new message to contact your course instructor."
      recipientLabel="Select Instructor:"
      recipientPlaceholder="-- Choose an Instructor --"
      emptyRecipientsMessage="No eligible instructors available. You can message instructors once you are enrolled in an active course."
      helperText="Messages will be delivered directly to the instructor's LMS inbox."
      apiMethods={apiMethods}
    />
  );
};
