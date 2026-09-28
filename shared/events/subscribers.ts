import { EventBus, Events } from "./index";
import { EmailQueue } from "../queues/email";

// Initialize subscribers
export function initializeSubscribers() {
  EventBus.on(Events.STAFF_CREATED, async (payload) => {
    console.log("[SUBSCRIBER] Received STAFF_CREATED", payload.user.email);
    // Bypass BullMQ to ensure the password is shown in the terminal even without Redis
    console.log(`
      ======================================================
      [MOCK EMAIL] TO: ${payload.user.email}
      Hello ${payload.user.name}, 
      Your temporary password is: ${payload.tempPassword}
      Please log in and change it.
      ======================================================
    `);
  });

  EventBus.on(Events.STAFF_DEACTIVATED, (payload) => {
    console.log("[SUBSCRIBER] Received STAFF_DEACTIVATED", payload.user.email);
    // e.g. invalidate active sessions, notify external systems
  });
}
