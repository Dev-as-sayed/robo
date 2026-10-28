import type { DeviceServerMessage } from "@robo/shared/realtime";

type DeviceNotifier = (userId: string, message: DeviceServerMessage) => number;

let notifier: DeviceNotifier | null = null;

export function setDeviceNotifier(next: DeviceNotifier | null): void {
  notifier = next;
}

/** Returns the number of connected sockets that accepted the message. */
export function notifyDevice(userId: string, message: DeviceServerMessage): number {
  return notifier?.(userId, message) ?? 0;
}
