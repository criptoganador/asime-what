import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import { X, Shield, PhoneOff, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { API_URL } from '../config';

interface CallViewProps {
  roomName: string;
  participantName: string;
  chatName: string;
  chatAvatar: string;
  onClose: () => void;
  video: boolean;
}

export const CallView = ({ roomName, participantName, chatName, chatAvatar, onClose, video }: CallViewProps) => {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState('Verificando hardware...');
  const [error, setError] = useState<string | null>(null);
  const [hardwareOk, setHardwareOk] = useState(false);
  const serverUrl = 'wss://asicme-whatsap-5gb7mv88.livekit.cloud';

  useEffect(() => {
    const checkHardwareAndFetchToken = async () => {
      try {
        // 1. Explicitly request permissions first to trigger browser prompt
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: video 
          });
          stream.getTracks().forEach(track => track.stop()); // Clean up immediately
        } catch (mediaErr: any) {
          // Silent catch - handle based on error name
          if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError') {
            setError('Permiso denegado. Para realizar la llamada, debes permitir el acceso al micrófono y/o cámara.');
            return;
          }
          // If NotFoundError, we'll confirm it with enumerateDevices below
        }

        // 2. Double check devices list
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasMic = devices.some(device => device.kind === 'audioinput');
        const hasCam = devices.some(device => device.kind === 'videoinput');

        if (!hasMic) {
          setError('No tiene micrófono conectado. Por favor, conecta uno para continuar.');
          return;
        }

        if (video && !hasCam) {
          setError('No tiene cámara conectada. Error de medios: Client initiated disconnect');
          return;
        }

        setHardwareOk(true);
        setStatus('Conectando...');

        // 3. Fetch token only if hardware is OK
        const resp = await fetch(
          `${API_URL}/api/get-livekit-token?roomName=${roomName}&participantName=${participantName}`
        );
        const data = await resp.json();
        setToken(data.token);
        setTimeout(() => setStatus('Llamando...'), 1000);
      } catch (e: any) {
        // Silent catch for the general flow
        setError('No se pudo establecer la conexión con el servidor o fallo de hardware.');
      }
    };

    checkHardwareAndFetchToken();
  }, [roomName, participantName, video]);

  const handleDisconnect = () => {
    onClose();
  };

  const handleMediaError = (err: Error) => {
    // Secondary catch for runtime errors
    if (err.name === 'NotAllowedError') {
      setError('Permiso denegado. Para realizar la llamada, debes permitir el acceso al micrófono y/o cámara.');
    } else if (err.name === 'NotFoundError' || err.message.toLowerCase().includes('device not found')) {
      setError('No tiene cámara o micrófono conectado. Error de medios: ' + err.message);
    } else {
      setError(`Error de medios: ${err.message}`);
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center text-white p-8">
        <div className="bg-white/5 p-12 rounded-3xl border border-white/10 flex flex-col items-center max-w-md w-full">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <AlertCircle size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-center">Aviso de Medios</h2>
          <p className="text-wa-text-secondary text-center mb-10 leading-relaxed">{error}</p>
          <button 
            onClick={onClose} 
            className="w-full bg-wa-teal py-4 rounded-xl font-bold hover:bg-wa-teal/80 transition-all active:scale-95 shadow-lg shadow-wa-teal/20"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  if (!token || !hardwareOk) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] bg-gradient-to-b from-[#0b141a] to-[#111b21] flex flex-col items-center justify-between text-white py-20 px-8"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-wa-teal/20 rounded-full blur-xl"
            />
            <img 
              src={chatAvatar} 
              className="w-32 h-32 rounded-full object-cover border-4 border-wa-teal/30 relative z-10 shadow-2xl" 
              alt="" 
            />
          </div>
          <div className="text-center">
            <h2 className="text-3xl font-semibold mb-2">{chatName}</h2>
            <p className="text-wa-teal font-medium tracking-wider uppercase text-sm animate-pulse">{status}</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-2 text-wa-text-secondary text-sm opacity-60">
            <Shield size={16} />
            <span>Cifrado de extremo a extremo</span>
          </div>
          
          <button 
            onClick={onClose}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-500/20"
          >
            <PhoneOff size={28} className="rotate-[135deg]" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      <LiveKitRoom
        video={video}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        connect={true}
        onDisconnected={handleDisconnect}
        onError={handleMediaError}
        data-lk-theme="default"
        style={{ height: '100vh' }}
      >
        <VideoConference />
        <RoomAudioRenderer />
        
        <div className="absolute top-6 left-6 z-[110] flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-white/90">Llamada en curso • {chatName}</span>
        </div>

        <div className="absolute top-6 right-6 z-[110]">
          <button 
            onClick={onClose} 
            className="p-3 bg-red-500/90 text-white rounded-full hover:bg-red-600 transition-all hover:rotate-90 shadow-xl backdrop-blur-sm"
          >
            <X size={24} />
          </button>
        </div>
      </LiveKitRoom>
    </motion.div>
  );
};
