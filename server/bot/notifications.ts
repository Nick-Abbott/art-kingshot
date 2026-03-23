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

type AssignmentEnvelope = {
  assignment?: Parameters<typeof buildAssignmentsMessage>[0];
  vikingNextTime?: string;
};

function isAssignmentEnvelope(payload: unknown): payload is AssignmentEnvelope {
  return !!payload && typeof payload === "object" && "assignment" in payload;
}

export async function processAssignmentNotification(
  notification: Notification,
  sender: NotificationSender
): Promise<void> {
  try {
    const parsed = JSON.parse(notification.payload) as
      | AssignmentEnvelope
      | Parameters<typeof buildAssignmentsMessage>[0];
    const assignment = isAssignmentEnvelope(parsed) ? parsed.assignment : parsed;
    if (!assignment) {
      throw new Error("Assignment payload missing.");
    }
    const header = buildAssignmentsHeader(
      undefined,
      isAssignmentEnvelope(parsed) ? parsed.vikingNextTime : undefined
    );
    const message = buildAssignmentsMessage(assignment, header);
    await sender.sendDm(notification.discordId, message);
    await sender.updateStatus(notification.id, "sent");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send DM.";
    await sender.updateStatus(notification.id, "failed", errorMessage);
    sender.logger.error("Failed to send assignment DM.", error);
  }
}
