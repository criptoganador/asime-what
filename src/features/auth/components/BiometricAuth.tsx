import React, { useState, useEffect } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, LogIn, Camera, User, Loader2 } from 'lucide-react';
import { API_URL } from '../../../config';
import { useChatStore, socket } from '../../sidebar/store/useChatStore';
import { generateECDHKeyPair, encryptPrivateKeyWithPIN, encryptPrivateKeyWithPhrase, decryptPrivateKeyWithPIN, hashRecoveryPhrase, decryptPrivateKeyWithPhrase } from '../../../utils/crypto';
import * as bip39 from 'bip39';
import { uploadImage } from '../../../utils/upload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth as NativeBiometric } from '@aparajita/capacitor-biometric-auth';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const verifyNativeBiometric = async () => {
  try {
    const info = await NativeBiometric.checkBiometry();
    if (!info.isAvailable) throw new Error('Biometría no disponible.');
    await NativeBiometric.authenticate({ reason: 'Por favor autentícate para continuar' });
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const generateHardwareKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
  );
  const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));
  const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
  return { publicKeyBase64, privateKeyJwk };
};

const signChallenge = async (privateKeyJwk: any, challengeHex: string) => {
  const privateKey = await window.crypto.subtle.importKey(
    'jwk', privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const challengeBuffer = new Uint8Array(challengeHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const signatureBuffer = await window.crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } }, privateKey, challengeBuffer
  );
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
};

export const BiometricAuth: React.FC = () => {
  useEffect(() => {
    // Si llegamos a esta pantalla, aseguramos que la sesión local esté limpia para evitar cruces
    localStorage.removeItem('asicme_user');
    sessionStorage.removeItem('asicme_private_key');
  }, []);
  const [step, setStep] = useState<'auth' | 'seed-phrase' | 'recover' | 'profile'>('auth');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [inputRecoveryPhrase, setInputRecoveryPhrase] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tempUser, setTempUser] = useState<any>(null);
  const [tempDecryptedKey, setTempDecryptedKey] = useState<string | null>(null);

  // PIN virtual único por cuenta para compatibilidad E2EE (Mejorado desde 123456)
  const getVirtualPIN = (user: string) => `${user.trim().toLowerCase()}#AsicmE_2026`;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('¡Ups! Esta foto pesa más de 2MB. Por favor elige una más ligera.');
        return;
      }
      setIsUploadingAvatar(true);
      try {
        const imageUrl = await uploadImage(file);
        setAvatar(imageUrl);
      } catch (error: any) {
        alert(error.message || 'Error al subir la foto.');
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  const handleRegister = async () => {
    if (!username.trim()) {
      setError('Por favor ingresa un @username');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const isMobile = Capacitor.isNativePlatform();
      let keys = await generateECDHKeyPair();
      
      let phrase = bip39.generateMnemonic();
      setRecoveryPhrase(phrase);
      let hashedPhrase = hashRecoveryPhrase(phrase);
      
      let encryptedPrivateKey = encryptPrivateKeyWithPIN(keys.privateKey, getVirtualPIN(username));
      let recoveryEncryptedPrivateKey = encryptPrivateKeyWithPhrase(keys.privateKey, phrase);
      
      let verificationJSON;

      if (isMobile) {
        // --- NATIVE MOBILE REGISTRATION ---
        const authResult = await verifyNativeBiometric();
        if (!authResult) throw new Error('Autenticación biométrica fallida o cancelada.');

        const { publicKeyBase64, privateKeyJwk } = await generateHardwareKeyPair();
        
        const storageKey = `hardware_private_key_${username.trim().toLowerCase()}`;
        await SecureStoragePlugin.set({ key: storageKey, value: JSON.stringify(privateKeyJwk) });

        const verificationResp = await fetch(`${API_URL}/api/auth/mobile-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: username.trim(),
            hardwarePublicKey: publicKeyBase64,
            publicKey: keys.publicKey,
            encryptedPrivateKey,
            recoveryEncryptedPrivateKey,
            hashedRecoveryPhrase: hashedPhrase
          })
        });

        if (!verificationResp.ok) {
          const errData = await verificationResp.json().catch(() => ({}));
          throw new Error(errData.error || 'Fallo de conexión al registrar. Intenta nuevamente.');
        }
        verificationJSON = await verificationResp.json();
      } else {
        // --- WEBAUTHN REGISTRATION ---
        const resp = await fetch(`${API_URL}/api/auth/generate-registration-options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim() })
        });
        const options = await resp.json();

        if (!resp.ok) throw new Error(options.error || 'Error al obtener opciones');

        let attResp;
        try {
          attResp = await startRegistration({ optionsJSON: options });
        } catch (err: any) {
          if (err.name === 'InvalidStateError') throw new Error('Ya tienes un dispositivo registrado en esta cuenta.');
          if (err.name === 'NotAllowedError') throw new Error('Cancelaste la solicitud biométrica.');
          throw err;
        }

        const verificationResp = await fetch(`${API_URL}/api/auth/verify-registration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: username.trim(),
            body: attResp,
            publicKey: keys.publicKey,
            encryptedPrivateKey,
            recoveryEncryptedPrivateKey,
            hashedRecoveryPhrase: hashedPhrase
          })
        });

        verificationJSON = await verificationResp.json();
      }

      if (verificationJSON.verified) {
        if (verificationJSON.token) {
          localStorage.setItem('asicme_token', verificationJSON.token);
        }
        setTempUser(verificationJSON.user);
        setName(verificationJSON.user.username);
        setTempDecryptedKey(keys.privateKey);
        setStep('seed-phrase');
      } else {
        throw new Error(verificationJSON.error || 'Fallo en la verificación del registro');
      }
    } catch (err: any) {
      setError(err.message || 'Error desconocido al registrar');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      setError('Por favor ingresa un @username');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const isMobile = Capacitor.isNativePlatform();
      let verificationJSON;

      if (isMobile) {
        // --- NATIVE MOBILE LOGIN ---
        const authResult = await verifyNativeBiometric();
        if (!authResult) throw new Error('Autenticación biométrica fallida o cancelada.');

        const challengeResp = await fetch(`${API_URL}/api/auth/mobile-login-challenge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim() })
        });
        const challengeData = await challengeResp.json();
        if (!challengeResp.ok) throw new Error(challengeData.error || 'Usuario no encontrado');

        let storedKeyStr;
        try {
          const storageKey = `hardware_private_key_${username.trim().toLowerCase()}`;
          const res = await SecureStoragePlugin.get({ key: storageKey });
          storedKeyStr = res.value;
        } catch (e) {
          throw new Error('No se encontraron las llaves en este teléfono. ¿Desinstalaste la app? Registra un nuevo usuario por ahora.');
        }
        if (!storedKeyStr) throw new Error('Credenciales de hardware no encontradas en este dispositivo.');
        
        const signatureBase64 = await signChallenge(JSON.parse(storedKeyStr), challengeData.challenge);

        const verificationResp = await fetch(`${API_URL}/api/auth/mobile-verify-signature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), signature: signatureBase64 })
        });
        
        if (!verificationResp.ok) {
          const errData = await verificationResp.json().catch(() => ({}));
          throw new Error(errData.error || 'Error de conexión con el servidor al iniciar sesión.');
        }
        verificationJSON = await verificationResp.json();
      } else {
        // --- WEBAUTHN LOGIN ---
        const resp = await fetch(`${API_URL}/api/auth/generate-authentication-options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim() })
        });
        const options = await resp.json();

        if (!resp.ok) throw new Error(options.error || 'Usuario no encontrado');

        let asseResp;
        try {
          asseResp = await startAuthentication({ optionsJSON: options });
        } catch (err: any) {
          if (err.name === 'NotAllowedError') throw new Error('Autenticación cancelada o denegada.');
          throw err;
        }

        const verificationResp = await fetch(`${API_URL}/api/auth/verify-authentication`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), body: asseResp })
        });

        verificationJSON = await verificationResp.json();
      }

      if (verificationJSON.verified) {
        useChatStore.setState({ 
          currentUser: verificationJSON.user,
          isAuthenticated: true,
        });
        localStorage.setItem('asicme_user', JSON.stringify(verificationJSON.user));
        
        const decrypted = decryptPrivateKeyWithPIN(verificationJSON.user.encryptedPrivateKey, getVirtualPIN(username));
        if (decrypted) {
          useChatStore.setState({ privateKeyJWK: decrypted });
          sessionStorage.setItem('asicme_private_key', decrypted);
        }
        
        if (verificationJSON.token) {
          localStorage.setItem('asicme_token', verificationJSON.token);
          socket.auth = { token: verificationJSON.token };
          if (!socket.connected) socket.connect();
        }
        socket.emit('user_connected', verificationJSON.user.id);
      } else {
        throw new Error(verificationJSON.error || 'Error de verificación de login');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async () => {
    if (!username.trim() || !inputRecoveryPhrase.trim()) {
      setError('Por favor ingresa tu username y la frase de recuperación');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hashedPhrase = hashRecoveryPhrase(inputRecoveryPhrase.trim());
      const response = await fetch(`${API_URL}/api/auth/recover-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), hashedRecoveryPhrase: hashedPhrase })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fallo en la recuperación');

      const user = data.user;
      if (!user.recoveryEncryptedPrivateKey) throw new Error('Este usuario no tiene llaves de respaldo');

      const rawPrivateKey = decryptPrivateKeyWithPhrase(user.recoveryEncryptedPrivateKey, inputRecoveryPhrase.trim());
      if (!rawPrivateKey) throw new Error('La frase no pudo desencriptar la llave. Comprueba las palabras.');

      // Como la cuenta fue recuperada exitosamente, necesitamos registrar el nuevo hardware local
      const isMobile = Capacitor.isNativePlatform();
      let encryptedPrivateKey = encryptPrivateKeyWithPIN(rawPrivateKey, getVirtualPIN(username));
      
      if (isMobile) {
        const authResult = await verifyNativeBiometric();
        if (!authResult) throw new Error('Autenticación biométrica fallida o cancelada.');
        const { publicKeyBase64, privateKeyJwk } = await generateHardwareKeyPair();
        const storageKey = `hardware_private_key_${username.trim().toLowerCase()}`;
        await SecureStoragePlugin.set({ key: storageKey, value: JSON.stringify(privateKeyJwk) });

        const verificationResp = await fetch(`${API_URL}/api/auth/mobile-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: username.trim(),
            hardwarePublicKey: publicKeyBase64,
            publicKey: user.publicKey,
            encryptedPrivateKey,
            recoveryEncryptedPrivateKey: user.recoveryEncryptedPrivateKey,
            hashedRecoveryPhrase: hashedPhrase
          })
        });
        if (!verificationResp.ok) throw new Error('Fallo al re-registrar hardware');
        const verificationJSON = await verificationResp.json();
        
        // Login exitoso
        useChatStore.setState({ 
          currentUser: verificationJSON.user,
          isAuthenticated: true,
        });
        localStorage.setItem('asicme_user', JSON.stringify(verificationJSON.user));
        
        const decrypted = rawPrivateKey;
        useChatStore.setState({ privateKeyJWK: decrypted });
        sessionStorage.setItem('asicme_private_key', decrypted);

        if (verificationJSON.token) {
          localStorage.setItem('asicme_token', verificationJSON.token);
          socket.auth = { token: verificationJSON.token };
          if (!socket.connected) socket.connect();
        }
        socket.emit('user_connected', verificationJSON.user.id);
      } else {
        throw new Error('La recuperación solo está disponible desde dispositivos móviles por ahora.');
      }
    } catch (err: any) {
      setError(err.message || 'Error recuperando cuenta');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    if (!name.trim() || !tempUser || !tempDecryptedKey) return;
    setLoading(true);
    setError(null);
    try {
      const finalAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;
      
      const response = await fetch(`${API_URL}/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tempUser.id, name, avatar: finalAvatar, about: '¡Hola! Estoy usando Asicme Chat.' })
      });

      let updatedUser = tempUser;
      if (response.ok) {
        updatedUser = await response.json();
      } else {
        console.warn('Fallo guardando el perfil remoto, procediendo con datos locales.');
        updatedUser = { ...tempUser, name, avatar: finalAvatar };
      }

      useChatStore.setState({ 
        currentUser: updatedUser,
        isAuthenticated: true,
        privateKeyJWK: tempDecryptedKey
      });
      localStorage.setItem('asicme_user', JSON.stringify(updatedUser));
      sessionStorage.setItem('asicme_private_key', tempDecryptedKey);
      
      const token = localStorage.getItem('asicme_token');
      if (token) {
        socket.auth = { token };
        if (!socket.connected) socket.connect();
      }
      socket.emit('user_connected', updatedUser.id);
      
    } catch (err: any) {
      setError(err.message || 'Error guardando perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {step === 'auth' && (
        <motion.div key="auth" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col gap-6">
          <div className="space-y-4">
            <label className="text-[12px] text-[#6366f1] font-bold uppercase tracking-widest">
              Nombre de usuario
            </label>
            <div className="flex gap-2">
              <div className="relative group min-w-[50px] sm:min-w-[60px] flex items-center justify-center bg-slate-50/50 rounded-xl border-2 border-slate-200/60 text-slate-500 font-bold">
                @
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="juanperez"
                className="flex-1 w-full bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 outline-none py-3 sm:py-3.5 px-3 sm:px-4 text-[16px] sm:text-[17px] rounded-xl transition-all duration-300 font-medium placeholder-slate-400"
              />
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm font-medium mt-1"
              >
                {error}
              </motion.p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogin}
              disabled={loading || !username}
              className="w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold text-[16px] hover:bg-[#4f46e5] active:scale-[0.98] transition-all duration-200 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" /> Iniciar Sesión con Huella
                </>
              )}
            </button>
            
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">O si eres nuevo</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              onClick={handleRegister}
              disabled={loading || !username}
              className="w-full bg-white text-[#6366f1] py-4 rounded-xl font-bold text-[16px] border-2 border-[#6366f1]/20 hover:border-[#6366f1] hover:bg-indigo-50 active:scale-[0.98] transition-all duration-200 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                 <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Fingerprint className="w-5 h-5" /> Registrar Dispositivo
                </>
              )}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">¿Problemas?</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <button
              onClick={() => setStep('recover')}
              className="text-sm font-medium text-slate-500 hover:text-[#6366f1] transition-colors"
            >
              Perdí mi teléfono / Recuperar cuenta
            </button>
          </div>
        </motion.div>
      )}

      {step === 'recover' && (
        <motion.div key="recover" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col gap-6">
          <div className="space-y-4">
            <h3 className="text-[20px] font-bold text-slate-800">Recuperar Cuenta</h3>
            <p className="text-[14px] text-slate-500 font-medium">Ingresa tu usuario y tu frase secreta de 12 palabras para restaurar el acceso.</p>
            <label className="text-[12px] text-[#6366f1] font-bold uppercase tracking-widest">
              Nombre de usuario
            </label>
            <div className="flex gap-2">
              <div className="relative group min-w-[50px] sm:min-w-[60px] flex items-center justify-center bg-slate-50/50 rounded-xl border-2 border-slate-200/60 text-slate-500 font-bold">
                @
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="juanperez"
                className="flex-1 w-full bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 outline-none py-3.5 px-4 text-[16px] rounded-xl transition-all font-medium"
              />
            </div>
            <label className="text-[12px] text-[#6366f1] font-bold uppercase tracking-widest mt-4">
              Frase de 12 palabras
            </label>
            <textarea
              value={inputRecoveryPhrase}
              onChange={(e) => setInputRecoveryPhrase(e.target.value)}
              placeholder="palabra1 palabra2 palabra3..."
              rows={3}
              className="w-full bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 outline-none py-3.5 px-4 text-[16px] rounded-xl transition-all font-medium resize-none"
            />
            {error && <p className="text-red-500 text-sm font-medium mt-1">{error}</p>}
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleRecover}
              disabled={loading || !username || !inputRecoveryPhrase}
              className="w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold text-[16px] hover:bg-[#4f46e5] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Restaurar Cuenta"}
            </button>
            <button
              onClick={() => { setStep('auth'); setError(null); }}
              disabled={loading}
              className="w-full bg-white text-slate-500 py-4 rounded-xl font-bold text-[16px] hover:bg-slate-50 active:scale-[0.98] transition-all"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      )}

      {step === 'seed-phrase' && (
        <motion.div key="seed-phrase" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
              <Fingerprint size={32} />
            </div>
            <h3 className="text-[20px] font-bold text-slate-800">Copia estas 12 palabras</h3>
            <p className="text-[14px] text-slate-500 font-medium">Si desinstalas la app o pierdes el teléfono, <b className="text-slate-800">esta es tu ÚNICA forma de recuperar tu cuenta</b> y tus mensajes.</p>
          </div>
          
          <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
            <p className="font-mono text-slate-800 text-[16px] leading-relaxed select-all text-center font-bold tracking-wide">
              {recoveryPhrase}
            </p>
          </div>
          
          <div className="flex bg-yellow-50 text-yellow-800 p-3 rounded-lg text-[13px] font-medium border border-yellow-200">
            ⚠️ Asicme NO guarda estas palabras. Si las pierdes, tu cuenta se perderá para siempre.
          </div>

          <button
            onClick={() => setStep('profile')}
            className="w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold text-[16px] hover:bg-[#4f46e5] active:scale-[0.98] transition-all shadow-md mt-2"
          >
            Ya las guardé, Continuar
          </button>
        </motion.div>
      )}

      {step === 'profile' && (
        <motion.div key="profile" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }} className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-4 mb-4">
            <h3 className="text-[20px] font-bold text-slate-800">Casi listo</h3>
            <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
              <input type="file" id="avatar-upload" accept="image/*" className="hidden" onChange={handleImageUpload} />
              <div className={cn(
                "w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 overflow-hidden border-4 border-white shadow-xl group-hover:border-[#6366f1]/30 transition-all relative",
                isUploadingAvatar && "opacity-50"
              )}>
                {avatar ? <img src={avatar} alt="Preview" className="w-full h-full object-cover" /> : <User size={48} />}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                    <Loader2 size={32} className="text-[#6366f1] animate-spin" />
                  </div>
                )}
              </div>
              <div className="absolute bottom-1 right-1 w-10 h-10 bg-[#6366f1] text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border-2 border-white">
                <Camera size={18} />
              </div>
            </div>
            <p className="text-[13px] text-slate-500 font-medium">Sube una foto de perfil</p>
          </div>
          
          <div className="space-y-4">
            <label className="text-[12px] text-[#6366f1] font-bold uppercase tracking-widest">
              Tu Nombre
            </label>
            <input 
              type="text" 
              maxLength={25}
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="¿Cómo te llamas?" 
              className="w-full bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 outline-none py-3.5 px-4 rounded-xl text-[16px] text-slate-700 font-medium transition-all duration-300 shadow-sm" 
            />
            {error && (
              <p className="text-red-500 text-sm font-medium">{error}</p>
            )}
          </div>

          <button
            onClick={handleCompleteProfile}
            disabled={loading || !name.trim() || isUploadingAvatar}
            className="w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold text-[16px] hover:bg-[#4f46e5] active:scale-[0.98] transition-all duration-200 shadow-md flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              "Comenzar a chatear"
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
