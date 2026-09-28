import { EventBus, Events } from "./index";
import { EmailQueue } from "../queues/email";

// Initialize subscribers
export function initializeSubscribers() {
  EventBus.on(Events.STAFF_CREATED, async (payload) => {
    console.log("[SUBSCRIBER] Received STAFF_CREATED", payload.user.email);
    // Add job to BullMQ
    await EmailQueue.add("send-credentials", {
      to: payload.user.email,
      subject: "Welcome! Your Hotel Credentials",
      body: `Hello ${payload.user.name}, your temporary password is ${payload.tempPassword}. Please log in and change it.`,
    });
  });

  EventBus.on(Events.STAFF_DEACTIVATED, (payload) => {
    console.log("[SUBSCRIBER] Received STAFF_DEACTIVATED", payload.user.email);
    // e.g. invalidate active sessions, notify external systems
  });
}
