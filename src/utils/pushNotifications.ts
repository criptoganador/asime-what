import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useChatStore } from '../features/sidebar/store/useChatStore';

export const initPushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications are only available on native platforms.');
    return;
  }

  // Solicitar permisos
  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === 'prompt') {
    permStatus = await PushNotifications.requestPermissions();
  }

  if (permStatus.receive !== 'granted') {
    console.log('User denied permissions for push notifications.');
    return;
  }

  // Registrar para recibir notificaciones
  await PushNotifications.register();

  // Escuchar cuando el registro es exitoso y obtenemos el token
  PushNotifications.addListener('registration', (token) => {
    console.log('Push registration success, token:', token.value);

    // Guardar el token en el servidor si el usuario está logueado
    const currentUser = useChatStore.getState().currentUser;
    if (currentUser?.id) {
      useChatStore.getState().updatePushToken(token.value);
    }
  });

  // Escuchar errores de registro
  PushNotifications.addListener('registrationError', (error) => {
    console.error('Error on push registration:', error);
  });

  // Escuchar cuando llega una notificación (app en primer plano)
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification);
  });

  // Escuchar cuando el usuario toca la notificación
  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification action performed:', notification);
  });
};
