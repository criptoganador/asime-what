import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useParticipants,
  useConnectionState,
  useLocalParticipant
} from '@livekit/components-react';
import { X, Shield, PhoneOff, AlertCircle, UserPlus, MessageCircle, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../config';
import { useChatStore } from '../features/sidebar/store/useChatStore';
import { Capacitor } from '@capacitor/core';
import AudioRouting from '../utils/AudioRouting';

interface CallViewProps {
  roomName: string;
  participantName: string;
  chatName: string;
  chatAvatar: string;
  onClose: () => void;
  onCallEmpty: () => void;
  video: boolean;
}

const ParticipantMonitor = ({ onCallEmpty, onParticipantsChange }: { onCallEmpty: () => void, onParticipantsChange: (names: string[]) => void }) => {
  const participants = useParticipants();
  const [maxParticipants, setMaxParticipants] = useState(0);

  useEffect(() => {
    if (participants.length > maxParticipants) {
      setMaxParticipants(participants.length);
    }
    
    // Si éramos varios y ahora solo quedo yo, finalizo la llamada para todos
    if (maxParticipants > 1 && participants.length === 1) {
      onCallEmpty();
    }

    onParticipantsChange(participants.map(p => p.identity));
  }, [participants, maxParticipants, onCallEmpty, onParticipantsChange]);

  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    let hwListener: any;
    let focusListener: any;
    if (Capacitor.isNativePlatform()) {
      AudioRouting.addListener('onAudioHardwareDisconnected', () => {
        if (localParticipant) {
          localParticipant.setMicrophoneEnabled(false);
          console.warn('Microphone muted due to hardware disconnect');
        }
      }).then(l => hwListener = l);

      AudioRouting.addListener('onAudioFocusChange', ({ event }) => {
        if (event === 'loss' && localParticipant) {
          localParticipant.setMicrophoneEnabled(false);
          console.warn('Microphone muted due to Audio Focus Loss');
        }
      }).then(l => focusListener = l);
    }
    return () => {
      if (hwListener) hwListener.remove();
      if (focusListener) focusListener.remove();
    }
  }, [localParticipant]);

  return null;
};

const ConnectionStatusIndicator = ({ onClose }: { onClose?: () => void }) => {
  const connectionState = useConnectionState();

  useEffect(() => {
    if (connectionState === 'disconnected') {
      alert('Llamada finalizada por error de red.');
      if (onClose) onClose();
    }
  }, [connectionState, onClose]);

  if (connectionState === 'reconnecting') {
    return (
      <div className="absolute inset-0 z-[200] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm">
        <div className="w-12 h-12 border-4 border-wa-teal border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-white text-xl font-bold">Reconectando llamada...</h3>
        <p className="text-gray-400 mt-2 text-center max-w-xs">
          Tu conexión cambió de red o es inestable. Mantente en línea.
        </p>
      </div>
    );
  }
  return null;
};

export const CallView = ({ roomName, participantName, chatName, chatAvatar, onClose, onCallEmpty, video }: CallViewProps) => {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [disconnectAction, setDisconnectAction] = useState<'leave' | 'empty' | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState('Verificando hardware...');
  const [error, setError] = useState<string | null>(null);
  const [hardwareOk, setHardwareOk] = useState(false);
  const [showInviteMenu, setShowInviteMenu] = useState(false);
  const [activeParticipantNames, setActiveParticipantNames] = useState<string[]>([]);
  const { contacts, inviteToCall } = useChatStore();
  const serverUrl = 'wss://asicme-whatsap-5gb7mv88.livekit.cloud';

  const roomOptions = {
    adaptiveStream: true, // Baja la calidad si el internet es lento
    dynacast: true, // Optimiza el ancho de banda
    audioCaptureDefaults: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1 // Forzar Mono para compatibilidad Bluetooth SCO
    },
    publishDefaults: {
      simulcast: true, // Envía múltiples resoluciones de video
    }
  };

  const availableContacts = contacts.filter(contact => {
    const safeContactName = (contact.user?.name || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return !activeParticipantNames.includes(safeContactName);
  });

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      AudioRouting.requestAudioFocus().catch(e => console.error('Audio Focus Error:', e));
      AudioRouting.startBluetoothSco().catch(e => console.error('SCO start error:', e));
    }
    return () => {
      if (Capacitor.isNativePlatform()) {
        AudioRouting.stopBluetoothSco().catch(e => console.error('SCO stop error:', e));
        AudioRouting.abandonAudioFocus().catch(e => console.error('Focus abandon error:', e));
      }
    };
  }, []);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        setHardwareOk(true);
        setStatus('Conectando...');

        const safeParticipantName = participantName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const resp = await fetch(
          `${API_URL}/api/get-livekit-token?roomName=${roomName}&participantName=${encodeURIComponent(safeParticipantName)}`
        );
        const data = await resp.json();
        setToken(data.token);
        setTimeout(() => setStatus('Llamando...'), 1000);
      } catch (e: any) {
        setError('No se pudo establecer la conexión con el servidor.');
      }
    };

    fetchToken();
  }, [roomName, participantName, video]);



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
            onClick={() => {
              if (isDisconnecting) return;
              setIsDisconnecting(true);
              setDisconnectAction('leave');
            }}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-500/20"
          >
            <PhoneOff size={28} className="rotate-[135deg]" />
          </button>
        </div>
      </motion.div>
    );
  }

  const handleCallEmptyGraceful = () => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    setDisconnectAction('empty');
  };

  const handleDisconnected = () => {
    if (disconnectAction === 'empty') onCallEmpty();
    else onClose();
  };

  return (
    <motion.div 
      layout
      drag={isMinimized}
      dragMomentum={false}
      initial={{ opacity: 0, scale: 1.1 }}
      animate={isMinimized ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, x: 0, y: 0 }}
      className={isMinimized
        ? "fixed bottom-6 right-6 w-80 h-48 z-[100] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20 cursor-move"
        : "fixed inset-0 z-[100] bg-black flex flex-col"
      }
    >
      <LiveKitRoom
        video={video}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        options={roomOptions}
        connect={!isDisconnecting}
        onDisconnected={handleDisconnected}
        onError={handleMediaError}
        data-lk-theme="default"
        style={{ height: '100vh' }}
      >
        <ConnectionStatusIndicator onClose={() => {
          setIsDisconnecting(true);
          setDisconnectAction('leave');
        }} />
        <ParticipantMonitor onCallEmpty={handleCallEmptyGraceful} onParticipantsChange={setActiveParticipantNames} />
        {video ? (
          <div className={`lk-video-wrapper w-full h-full ${isMinimized ? 'pointer-events-none' : ''}`}>
            <VideoConference />
          </div>
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0b141a] to-[#111b21] ${isMinimized ? 'pointer-events-none' : ''}`}>
            <div className="relative flex flex-col items-center">
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ duration: 2, repeat: Infinity }} 
                className="absolute inset-0 bg-wa-teal/20 rounded-full blur-xl" 
              />
              <img 
                src={chatAvatar} 
                className={`${isMinimized ? 'w-24 h-24' : 'w-40 h-40'} rounded-full object-cover border-4 border-wa-teal/30 relative z-10 shadow-2xl transition-all`} 
                alt="" 
              />
              {!isMinimized && (
                <>
                  <h2 className="text-3xl font-semibold text-white mt-6">{chatName}</h2>
                  <p className="text-wa-teal font-medium mt-2">
                    {activeParticipantNames.length > 1 ? `${activeParticipantNames.length} participantes en llamada` : 'Llamada de voz en curso'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        <RoomAudioRenderer />
        
        {!isMinimized && (
          <>
            <div className="absolute top-6 left-6 z-[110] flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 pointer-events-none">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-white/90">Llamada en curso • {chatName}</span>
            </div>

            <div className="absolute top-6 right-6 z-[110] flex items-center gap-4">
              <button 
                onClick={() => setIsMinimized(true)}
                className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all shadow-xl backdrop-blur-sm border-none cursor-pointer flex items-center justify-center"
                title="Minimizar a chat"
              >
                <MessageCircle size={24} />
              </button>

              <div className="relative">
                <button 
                  onClick={() => setShowInviteMenu(!showInviteMenu)}
                  className="p-3 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all shadow-xl backdrop-blur-sm border-none cursor-pointer flex items-center justify-center"
                  title="Añadir participante"
                >
                  <UserPlus size={24} />
                </button>

                <AnimatePresence>
                  {showInviteMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowInviteMenu(false)} />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        className="absolute top-14 right-0 w-64 bg-[#111b21] rounded-2xl shadow-2xl z-50 border border-white/10 overflow-hidden"
                      >
                        <div className="p-3 border-b border-white/10">
                          <h3 className="text-white text-sm font-semibold">Añadir participante</h3>
                        </div>
                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                          {availableContacts.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-sm">No hay contactos disponibles para invitar</div>
                          ) : (
                            availableContacts.map(contact => (
                              <button
                                key={contact.id}
                                onClick={() => {
                                  inviteToCall(roomName, contact.user.id, video ? 'video' : 'voice');
                                  setShowInviteMenu(false);
                                }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                              >
                                <img src={contact.user?.avatar || 'https://i.pravatar.cc/150'} alt={contact.nickname || contact.user?.name} className="w-8 h-8 rounded-full object-cover" />
                                <span className="text-white text-sm truncate flex-1">{contact.nickname || contact.user?.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              
              <button 
                onClick={() => {
                  if (isDisconnecting) return;
                  setIsDisconnecting(true);
                  setDisconnectAction('leave');
                }}
                className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow-xl backdrop-blur-sm border-none cursor-pointer flex items-center justify-center"
                title="Colgar llamada"
              >
                <PhoneOff size={24} />
              </button>
            </div>
          </>
        )}

        {isMinimized && (
          <div className="absolute top-2 right-2 z-[110] flex items-center gap-2">
            <button 
              onClick={() => setIsMinimized(false)}
              className="p-2 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all backdrop-blur-sm cursor-pointer"
              title="Volver a llamada"
            >
              <Maximize2 size={16} />
            </button>
            <button 
              onClick={() => {
                if (isDisconnecting) return;
                setIsDisconnecting(true);
                setDisconnectAction('leave');
              }}
              className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-all backdrop-blur-sm cursor-pointer"
              title="Colgar"
            >
              <PhoneOff size={16} />
            </button>
          </div>
        )}
      </LiveKitRoom>
    </motion.div>
  );
};
