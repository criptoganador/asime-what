import React, { useEffect, useState, useCallback } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useParticipants,
  useConnectionState,
  useLocalParticipant,
  useTracks,
  ParticipantTile
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { X, Shield, PhoneOff, AlertCircle, UserPlus, MessageCircle, Maximize2, Mic, MicOff, Video as VideoIcon, VideoOff, MessageSquare, Smile, Hand, Sparkles, MoreVertical, CircleDot, MonitorUp, Users } from 'lucide-react';
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

const ConnectionStatusIndicator = () => {
  const connectionState = useConnectionState();

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

const CustomVideoLayout = ({ isMinimized }: { isMinimized: boolean }) => {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  if (tracks.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f4f5f7]">
        <div className="w-12 h-12 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Priorizar un participante remoto como foco
  const remoteTracks = tracks.filter(t => !t.participant.isLocal);
  const localTracks = tracks.filter(t => t.participant.isLocal);
  const focusTrack = remoteTracks.length > 0 ? remoteTracks[0] : localTracks[0];
  const sidebarTracks = tracks.filter(t => t.participant.identity !== focusTrack?.participant.identity);

  return (
    <div className={`w-full h-full flex flex-col md:flex-row ${isMinimized ? 'p-0 gap-0' : 'p-3 md:p-4 pb-[110px] md:pb-4 gap-3 md:gap-4'} bg-black ${isMinimized ? 'pointer-events-none' : ''}`}>
      {/* Main Focus Video */}
      <div className={`flex-1 overflow-hidden relative bg-[#1c1c1e] ${isMinimized ? 'rounded-none' : 'rounded-[24px] shadow-lg'}`}>
        {focusTrack && <ParticipantTile trackRef={focusTrack} className="w-full h-full object-cover" />}
      </div>

      {/* Sidebar Carousel */}
      {!isMinimized && sidebarTracks.length > 0 && (
        <div className="w-full md:w-[280px] flex flex-row md:flex-col gap-3 md:gap-4 h-[140px] md:h-full overflow-x-auto md:overflow-y-auto custom-scrollbar md:pr-1 shrink-0">
          {sidebarTracks.map(t => (
            <div key={t.participant.identity + t.source} className="w-[110px] md:w-full h-full md:h-[180px] shrink-0 rounded-[20px] overflow-hidden relative shadow-md bg-[#1c1c1e] border-2 border-transparent focus-within:border-wa-teal">
              <ParticipantTile trackRef={t} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PremiumControlBar = ({ 
  isMinimized, setIsMinimized, video, showInviteMenu, setShowInviteMenu, 
  availableContacts, inviteToCall, roomName, isDisconnecting, setIsDisconnecting, 
  setDisconnectAction, activeParticipantNames, chatName, setActiveChat
}: any) => {
  const { localParticipant } = useLocalParticipant();
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(video);

  const toggleMic = () => {
    if (localParticipant) {
      const newState = !isMicEnabled;
      localParticipant.setMicrophoneEnabled(newState);
      setIsMicEnabled(newState);
    }
  };

  const toggleCamera = () => {
    if (localParticipant) {
      const newState = !isCameraEnabled;
      localParticipant.setCameraEnabled(newState);
      setIsCameraEnabled(newState);
    }
  };

  return (
    <>
      {/* Superior: Header Flotante Premium */}
      <div className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-0 right-0 z-[110] px-8 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 shadow-lg pointer-events-auto">
          <Users size={18} className="text-white/80" />
          <span className="text-white font-medium text-sm">{activeParticipantNames.length} participants</span>
        </div>
      </div>

      {/* Inferior: Barra de Controles Estilo Dribbble */}
      <div className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-0 right-0 z-[110] flex justify-center pointer-events-none">
        <div className="flex items-center gap-2 bg-[#202124]/95 backdrop-blur-2xl px-4 py-3 rounded-[24px] shadow-[0_20px_40px_rgba(0,0,0,0.3)] pointer-events-auto border border-white/5">
          
          {/* Grupo 1: Medios */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-[18px]">
            <button 
              onClick={toggleMic}
              className={`p-3 rounded-[14px] transition-all duration-300 flex items-center justify-center ${isMicEnabled ? 'bg-transparent hover:bg-white/10 text-white' : 'bg-[#ea4335] text-white'}`}
            >
              {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            {video && (
              <button 
                onClick={toggleCamera}
                className={`p-3 rounded-[14px] transition-all duration-300 flex items-center justify-center ${isCameraEnabled ? 'bg-transparent hover:bg-white/10 text-white' : 'bg-[#ea4335] text-white'}`}
              >
                {isCameraEnabled ? <VideoIcon size={20} /> : <VideoOff size={20} />}
              </button>
            )}
          </div>

          <div className="w-px h-8 bg-white/10 mx-2" />

          {/* Grupo 2: Herramientas Dribbble */}
          <div className="flex items-center gap-1">
            <div className="relative">
              <button 
                onClick={() => setShowInviteMenu(!showInviteMenu)}
                className="p-3 bg-transparent hover:bg-white/10 text-white/90 rounded-[14px] transition-all duration-300 flex items-center justify-center"
                title="Participantes"
              >
                <Users size={20} />
              </button>

              <AnimatePresence>
                {showInviteMenu && (
                  <motion.div 
                    key="invite-menu-dropdown"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="absolute bottom-[calc(100%+1rem)] left-1/2 -translate-x-1/2 w-72 bg-[#202124] rounded-[24px] shadow-2xl z-50 border border-white/10 overflow-hidden"
                  >
                    <div className="p-5 border-b border-white/5">
                      <h3 className="text-white text-[15px] font-semibold">Añadir a la llamada</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
                      {availableContacts.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">No hay contactos disponibles</div>
                      ) : (
                        availableContacts.map((contact: any) => (
                          <button
                            key={contact.id}
                            onClick={() => {
                              inviteToCall(roomName, contact.user.id, video ? 'video' : 'voice');
                              setShowInviteMenu(false);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors text-left"
                          >
                            <img src={contact.user?.avatar || 'https://i.pravatar.cc/150'} alt="" className="w-10 h-10 rounded-full object-cover shadow-sm" />
                            <span className="text-white text-[15px] font-medium truncate flex-1">{contact.nickname || contact.user?.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => {
                setActiveChat(roomName);
                setIsMinimized(true);
              }}
              className="p-3 bg-transparent hover:bg-white/10 text-white/90 rounded-[14px] transition-all duration-300 flex items-center justify-center relative"
            >
              <MessageSquare size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#f28b3f] rounded-full" />
            </button>
            <button className="p-3 bg-transparent hover:bg-white/10 text-white/90 rounded-[14px] transition-all duration-300 flex items-center justify-center">
              <Smile size={20} />
            </button>
            <button className="p-3 bg-transparent hover:bg-white/10 text-white/90 rounded-[14px] transition-all duration-300 flex items-center justify-center">
              <Hand size={20} />
            </button>
            <button className="p-3 bg-transparent hover:bg-white/10 text-white/90 rounded-[14px] transition-all duration-300 flex items-center justify-center">
              <Sparkles size={20} />
            </button>
            <button className="p-3 bg-transparent hover:bg-white/10 text-white/90 rounded-[14px] transition-all duration-300 flex items-center justify-center">
              <MoreVertical size={20} />
            </button>
          </div>

          <div className="w-px h-8 bg-white/10 mx-2" />

          {/* Grupo 3: Extras y Cuelgue */}
          <div className="flex items-center gap-3">
            <button className="p-3 bg-transparent hover:bg-white/10 text-white/90 rounded-[14px] transition-all duration-300 flex items-center justify-center">
              <MonitorUp size={20} />
            </button>
            
            <div className="flex items-center gap-2 bg-[#2d2e30] px-3 py-1.5 rounded-[12px] text-white/90 text-sm font-medium border border-white/5">
              <CircleDot size={14} className="text-[#ea4335] animate-pulse" />
              <span>00:32</span>
            </div>

            <button 
              onClick={() => {
                if (isDisconnecting) return;
                setIsDisconnecting(true);
                setDisconnectAction('leave');
              }}
              className="p-3 bg-[#ea4335] hover:bg-[#d93025] text-white rounded-[14px] transition-all duration-300 flex items-center justify-center shadow-lg"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
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
  const { currentUser, contacts, inviteToCall, setActiveChat } = useChatStore();
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
      AudioRouting.requestPermissions().catch(e => console.error('Perm error:', e));
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
        const authToken = localStorage.getItem('asicme_token');
        const resp = await fetch(
          `${API_URL}/api/get-livekit-token?roomName=${roomName}&participantName=${encodeURIComponent(safeParticipantName)}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
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


  const handleCallEmptyGraceful = useCallback(() => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    setDisconnectAction('empty');
  }, [isDisconnecting]);

  const handleDisconnected = useCallback(() => {
    if (disconnectAction === 'empty') onCallEmpty();
    else onClose();
  }, [disconnectAction, onCallEmpty, onClose]);

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

  return (
    <motion.div 
      layout
      drag={isMinimized}
      dragMomentum={false}
      initial={{ opacity: 0, scale: 1.1 }}
      animate={isMinimized ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, x: 0, y: 0 }}
      className={isMinimized
        ? "fixed top-20 right-4 w-[140px] h-[200px] md:w-80 md:h-48 z-[400] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20 cursor-move pointer-events-auto"
        : "fixed inset-0 z-[400] bg-black flex flex-col pointer-events-auto"
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
        <ConnectionStatusIndicator />
        <ParticipantMonitor onCallEmpty={handleCallEmptyGraceful} onParticipantsChange={setActiveParticipantNames} />
        {video ? (
          <div className={`lk-video-wrapper w-full h-full absolute inset-0`}>
            <CustomVideoLayout isMinimized={isMinimized} />
          </div>
        ) : (
          <div className={`w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1a2d37] via-[#0b141a] to-black ${isMinimized ? 'pointer-events-none' : ''}`}>
            <div className="relative flex flex-col items-center">
              {/* Ondas expansivas premium para voz */}
              <motion.div 
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }} 
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} 
                className="absolute inset-0 bg-wa-teal/30 rounded-full blur-2xl" 
              />
              <motion.div 
                animate={{ scale: [1.2, 1.5, 1.2], opacity: [0.1, 0.3, 0.1] }} 
                transition={{ duration: 3, delay: 0.5, repeat: Infinity, ease: "easeInOut" }} 
                className="absolute inset-[-20%] bg-wa-teal/20 rounded-full blur-3xl" 
              />
              <img 
                src={chatAvatar} 
                className={`${isMinimized ? 'w-24 h-24' : 'w-48 h-48'} rounded-full object-cover border-[6px] border-white/10 relative z-10 shadow-[0_0_50px_rgba(0,168,132,0.4)] transition-all`} 
                alt="" 
              />
              {!isMinimized && (
                <div className="relative z-10 flex flex-col items-center mt-8">
                  <h2 className="text-4xl font-bold text-white tracking-tight">{chatName}</h2>
                  <p className="text-wa-teal/90 font-medium mt-3 text-lg bg-wa-teal/10 px-4 py-1.5 rounded-full border border-wa-teal/20 mb-6">
                    {activeParticipantNames.length > 1 ? `${activeParticipantNames.length} participantes en la llamada` : 'Llamada de voz en curso'}
                  </p>
                  
                  {/* Cluster de Avatares para llamadas grupales */}
                  {activeParticipantNames.length > 1 && (
                    <div className="flex flex-wrap justify-center items-center gap-2 max-w-[280px]">
                      {activeParticipantNames.map((id, index) => {
                        // Buscar avatar del contacto o usuario actual
                        let pAvatar = 'https://i.pravatar.cc/150';
                        if (currentUser?.id === id) pAvatar = currentUser.avatar || pAvatar;
                        else {
                          const contact = availableContacts.find(c => c.user.id === id);
                          if (contact?.user?.avatar) pAvatar = contact.user.avatar;
                        }
                        
                        return (
                          <motion.div 
                            key={id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/20 shadow-lg bg-black relative"
                          >
                            <img src={pAvatar} className="w-full h-full object-cover" alt="Participante" />
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        <RoomAudioRenderer />
        
        {!isMinimized && (
          <PremiumControlBar 
            isMinimized={isMinimized} 
            setIsMinimized={setIsMinimized} 
            video={video} 
            showInviteMenu={showInviteMenu} 
            setShowInviteMenu={setShowInviteMenu} 
            availableContacts={availableContacts} 
            inviteToCall={inviteToCall} 
            roomName={roomName} 
            isDisconnecting={isDisconnecting} 
            setIsDisconnecting={setIsDisconnecting} 
            setDisconnectAction={setDisconnectAction} 
            activeParticipantNames={activeParticipantNames} 
            chatName={chatName} 
            setActiveChat={setActiveChat}
          />
        )}

        {isMinimized && (
          <div className="absolute top-2 right-2 z-[110] flex items-center gap-1.5">
            <button 
              onClick={() => setIsMinimized(false)}
              className="p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all backdrop-blur-sm cursor-pointer"
              title="Volver a llamada"
            >
              <Maximize2 size={14} />
            </button>
            <button 
              onClick={() => {
                if (isDisconnecting) return;
                setIsDisconnecting(true);
                setDisconnectAction('leave');
              }}
              className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-all backdrop-blur-sm cursor-pointer"
              title="Colgar"
            >
              <PhoneOff size={14} />
            </button>
          </div>
        )}
      </LiveKitRoom>
    </motion.div>
  );
};
