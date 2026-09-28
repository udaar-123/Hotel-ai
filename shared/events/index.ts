import { EventEmitter } from "events";

class AppEventBus extends EventEmitter {}

export const EventBus = new AppEventBus();

// Expose standard event names
export const Events = {
  STAFF_CREATED: "staff.created",
  STAFF_DEACTIVATED: "staff.deactivated",
};
