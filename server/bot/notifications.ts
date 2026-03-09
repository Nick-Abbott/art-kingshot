import { buildAssignmentsHeader, buildAssignmentsMessage } from "./handlers/vikings";

type Notification = {
  id: string;
  discordId: string;
  payload: string;
};

type NotificationSender = {
  sendDm: (discordId: string, message: string) => Promise<void>;
  updateStatus: (id: string, status: "sent" | "failed", error?: string) => Promise<void>;
  logger: Pick<typeof console, "error">;
};

export async function processAssignmentNotification(
  notification: Notification,
  sender: NotificationSender
): Promise<void> {
  const header = buildAssignmentsHeader();
  try {
    const assignment = JSON.parse(notification.payload) as Parameters<typeof buildAssignmentsMessage>[0];
    const message = buildAssignmentsMessage(assignment, header);
    await sender.sendDm(notification.discordId, message);
    await sender.updateStatus(notification.id, "sent");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send DM.";
    await sender.updateStatus(notification.id, "failed", errorMessage);
    sender.logger.error("Failed to send assignment DM.", error);
  }
}
