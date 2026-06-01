import React, { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, LogIn, Camera, User, Loader2 } from 'lucide-react';
import { API_URL } from '../../../config';
import { useChatStore } from '../../sidebar/store/useChatStore';
import { generateECDHKeyPair, encryptPrivateKeyWithPIN, encryptPrivateKeyWithPhrase, decryptPrivateKeyWithPIN } from '../../../utils/crypto';
import { uploadImage } from '../../../utils/upload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const BiometricAuth: React.FC = () => {
  const [step, setStep] = useState<'auth' | 'profile'>('auth');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tempUser, setTempUser] = useState<any>(null);
  const [tempDecryptedKey, setTempDecryptedKey] = useState<string | null>(null);

  // PIN virtual para compatibilidad E2EE
  const virtualPIN = '123456'; 

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

      const keys = await generateECDHKeyPair();
      const encryptedPrivateKey = encryptPrivateKeyWithPIN(keys.privateKey, virtualPIN);
      const recoveryEncryptedPrivateKey = encryptPrivateKeyWithPhrase(keys.privateKey, 'dummy_recovery_phrase');

      const verificationResp = await fetch(`${API_URL}/api/auth/verify-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(),
          body: attResp,
          publicKey: keys.publicKey,
          encryptedPrivateKey,
          recoveryEncryptedPrivateKey
        })
      });

      const verificationJSON = await verificationResp.json();
      if (verificationJSON.verified) {
        setTempUser(verificationJSON.user);
        setName(verificationJSON.user.username);
        setTempDecryptedKey(keys.privateKey);
        setStep('profile'); // En lugar de loguear directo, pasamos al perfil
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

      const verificationJSON = await verificationResp.json();
      if (verificationJSON.verified) {
        useChatStore.setState({ 
          currentUser: verificationJSON.user,
          isAuthenticated: true,
        });
        localStorage.setItem('asicme_user', JSON.stringify(verificationJSON.user));
        
        const decrypted = decryptPrivateKeyWithPIN(verificationJSON.user.encryptedPrivateKey, virtualPIN);
        if (decrypted) {
          useChatStore.setState({ privateKeyJWK: decrypted });
          sessionStorage.setItem('asicme_private_key', decrypted);
        }
      } else {
        throw new Error(verificationJSON.error || 'Error de verificación de login');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
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

      if (!response.ok) throw new Error('Error al guardar el perfil');
      const updatedUser = await response.json();

      useChatStore.setState({ 
        currentUser: updatedUser,
        isAuthenticated: true,
        privateKeyJWK: tempDecryptedKey
      });
      localStorage.setItem('asicme_user', JSON.stringify(updatedUser));
      sessionStorage.setItem('asicme_private_key', tempDecryptedKey);
      
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
          </div>
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
