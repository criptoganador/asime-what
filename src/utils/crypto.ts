import CryptoJS from 'crypto-js';

// La clave secreta se basa en el ID del chat (UUID único e irrepetible)
export const getChatSecret = (chatId: string) => {
  return `asicme-e2e-${chatId}`;
};

// Cifra un mensaje
export const encryptMessage = (text: string, chatId: string) => {
  if (!text) return text;
  try {
    const secret = getChatSecret(chatId);
    return CryptoJS.AES.encrypt(text, secret).toString();
  } catch (error) {
    console.error('Error encrypting message:', error);
    return text;
  }
};

// Descifra un mensaje
export const decryptMessage = (ciphertext: string, chatId: string) => {
  if (!ciphertext) return ciphertext;
  
  // Si el mensaje no parece cifrado, retornamos el original
  if (!ciphertext.startsWith('U2FsdGVkX1')) {
    return ciphertext;
  }

  try {
    const secret = getChatSecret(chatId);
    const bytes = CryptoJS.AES.decrypt(ciphertext, secret);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    
    // Si el descifrado produce texto válido, lo retornamos
    if (originalText && originalText.length > 0) {
      return originalText;
    }
    
    // Si no pudo descifrar (clave antigua), mostramos un texto amigable
    return '🔒 Mensaje cifrado (clave anterior)';
  } catch (error) {
    return '🔒 Mensaje cifrado (clave anterior)';
  }
};
