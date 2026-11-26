import { useMemo } from "react";
import { api } from "../../../services/api";
import { MessagesWorkspace } from "../../../features/communication/MessagesWorkspace";

export const InstructorMessagesPage = () => {
  const apiMethods = useMemo(
    () => ({
      getConversations: api.getInstructorConversations,
      getMessagesWithUser: api.getInstructorMessagesWithUser,
      sendMessage: api.sendInstructorMessage,
      getRecipients: api.getInstructorRecipients,
    }),
    []
  );

  return (
    <MessagesWorkspace
      basePath="/instructor/messages"
      breadcrumbs={[
        { label: "Dashboard", to: "/instructor/dashboard" },
        { label: "Messages" },
      ]}
      title="Instructor Messages"
      subtitle="Direct messaging channel with students enrolled in your active courses."
      emptySelectionDescription="Choose an existing student thread on the left or compose a new message to reach an enrolled student."
      recipientLabel="Select Student:"
      recipientPlaceholder="-- Choose a Student --"
      emptyRecipientsMessage="No eligible students available yet. Students appear here once they are enrolled in your active assigned courses."
      helperText="Messages will be delivered directly to the student's LMS inbox."
      apiMethods={apiMethods}
    />
  );
};
