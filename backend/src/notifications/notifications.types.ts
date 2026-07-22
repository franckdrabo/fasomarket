export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushNotification {
  userId: string;
  payload: NotificationPayload;
}
