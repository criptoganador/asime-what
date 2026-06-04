import * as admin from 'firebase-admin';

// Reemplazar con la ruta de tu archivo de credenciales o usar variables de entorno
// const serviceAccount = require('../../firebase-adminsdk.json');

// Inicializar solo si hay credenciales disponibles (evitar crashes si no se configuran)
try {
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Reemplazar \n literales por saltos de línea reales si vienen de .env
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    });
    console.log('Firebase Admin SDK inicializado exitosamente.');
  } else {
    console.warn('Firebase Admin SDK no inicializado: Faltan variables de entorno.');
  }
} catch (error) {
  console.error('Error inicializando Firebase Admin SDK:', error);
}

export const sendPushNotification = async (token: string, title: string, body: string, data?: Record<string, string>) => {
  if (!admin.apps.length) {
    console.warn('Intento de enviar push notification pero Firebase no está inicializado.');
    return;
  }

  const message = {
    notification: {
      title,
      body,
    },
    data: data || {},
    token: token,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Push notification enviada con éxito:', response);
  } catch (error) {
    console.error('Error enviando push notification:', error);
  }
};
