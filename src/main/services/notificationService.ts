import { Notification } from 'electron';

export function notifyLongJobComplete(title: string, body: string): void {
  if (!Notification.isSupported()) {
    return;
  }

  new Notification({
    title,
    body
  }).show();
}
