type SessionExpiredHandler = () => void;

let handler: SessionExpiredHandler | null = null;

export function registerSessionExpiredHandler(next: SessionExpiredHandler): void {
  handler = next;
}

export function notifySessionExpired(): void {
  handler?.();
}
