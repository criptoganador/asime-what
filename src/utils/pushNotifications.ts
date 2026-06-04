import { PushNotifications } from '@capacitor/push-notifications';
import { useChatStore } from '../features/sidebar/store/useChatStore';

export const initPushNotifications = async () => {
  try {
    // Pedir permisos en Android 13+ o iOS
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Permiso de notificaciones push denegado');
      return;
    }

    // Registrar en FCM
    await PushNotifications.register();

    // Evento: Al registrarse exitosamente, envía el token al backend a través de la tienda
    PushNotifications.addListener('registration', (token) => {
      console.log('Push registration success, token: ' + token.value);
      // Usar la tienda actual para enviar el token vía socket
      const { updatePushToken } = useChatStore.getState();
      updatePushToken(token.value);
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error al registrar push notifications: ' + JSON.stringify(error));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ' + JSON.stringify(notification));
      // Aquí se podrían actualizar listas de chats si la app está en primer plano
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
      // Aquí podríamos navegar a un chat específico si el usuario tocó la notificación
    });

  } catch (error) {
    console.error('Push Notifications setup failed:', error);
  }
};
