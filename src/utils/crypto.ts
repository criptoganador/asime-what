import CryptoJS from 'crypto-js';

// La clave secreta se basa en el ID del chat (UUID único e irrepetible)
const getChatSecret = (chatId: string) => {
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


// --- ENCRIPTACIÓN DE LA LLAVE PRIVADA (SIMÉTRICA CON PIN) ---

export const encryptPrivateKeyWithPIN = (privateKeyJwk: string, pin: string): string => {
  return CryptoJS.AES.encrypt(privateKeyJwk, pin).toString();
};

export const decryptPrivateKeyWithPIN = (encryptedPrivateKey: string, pin: string): string | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, pin);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return null;
    return decrypted;
  } catch (error) {
    console.error('Error desencriptando la llave privada con el PIN', error);
    return null;
  }
};

// --- ENCRIPTACIÓN DE RESPALDO (CON FRASE DE 12 PALABRAS) ---

export const hashRecoveryPhrase = (phrase: string): string => {
  return CryptoJS.SHA256(phrase).toString();
};

export const encryptPrivateKeyWithPhrase = (privateKeyJwk: string, phrase: string): string => {
  return CryptoJS.AES.encrypt(privateKeyJwk, phrase).toString();
};

export const decryptPrivateKeyWithPhrase = (encryptedPrivateKey: string, phrase: string): string | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, phrase);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return null;
    return decrypted;
  } catch (error) {
    console.error('Error desencriptando la llave privada con la frase', error);
    return null;
  }
};

// --- CIFRADO DE EXTREMO A EXTREMO (ASIMÉTRICO ECDH + AES-GCM) ---

const ALGO_ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const ALGO_AES = { name: 'AES-GCM', length: 256 };

export const generateECDHKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(ALGO_ECDH, true, ['deriveKey', 'deriveBits']);
  const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return {
    publicKey: JSON.stringify(publicKeyJwk),
    privateKey: JSON.stringify(privateKeyJwk),
    rawKeyPair: keyPair
  };
};

export const importPrivateKey = async (privateKeyJwkString: string): Promise<CryptoKey> => {
  const jwk = JSON.parse(privateKeyJwkString);
  return await window.crypto.subtle.importKey('jwk', jwk, ALGO_ECDH, true, ['deriveKey', 'deriveBits']);
};

export const importPublicKey = async (publicKeyJwkString: string): Promise<CryptoKey> => {
  const jwk = JSON.parse(publicKeyJwkString);
  return await window.crypto.subtle.importKey('jwk', jwk, ALGO_ECDH, true, []);
};

export const deriveSharedKey = async (myPrivateKey: CryptoKey, theirPublicKey: CryptoKey): Promise<CryptoKey> => {
  return await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublicKey },
    myPrivateKey,
    ALGO_AES,
    true,
    ['encrypt', 'decrypt']
  );
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export const encryptMessageE2EE = async (text: string, sharedKey: CryptoKey) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, data);
  return JSON.stringify({
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(ciphertext)
  });
};

export const decryptMessageE2EE = async (encryptedPayloadString: string, sharedKey: CryptoKey) => {
  try {
    const payload = JSON.parse(encryptedPayloadString);
    if (!payload.iv || !payload.ciphertext) return encryptedPayloadString;
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ciphertext);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      sharedKey,
      ciphertext
    );
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    return encryptedPayloadString;
  }
};
