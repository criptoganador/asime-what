import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const requestNotificationPermissions = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const permission = await LocalNotifications.requestPermissions();
      return permission.display === 'granted';
    } catch (e) {
      console.error('Error requesting native notification permission', e);
      return false;
    }
  } else {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }
};

const scheduleNativeNotification = async (title: string, body: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: new Date().getTime(),
            schedule: { at: new Date(Date.now() + 100) },
            actionTypeId: '',
          }
        ]
      });
    } catch (e) {
      console.error('Native notification error', e);
    }
  } else {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.png'
      });
    }
  }
};

export const notifyMessage = async (title: string, body: string) => {
  await scheduleNativeNotification(title, body);
};

export const notifyCall = async (title: string, body: string) => {
  await scheduleNativeNotification(title, body);
};
