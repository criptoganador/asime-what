import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, Loader2 } from 'lucide-react';
import { useChatStore } from '../features/sidebar/store/useChatStore';

const CallView = lazy(() => import('./CallView').then(m => ({ default: m.CallView })));

// Ringtones (URLs públicas genéricas para este prototipo)
const INCOMING_RINGTONE = 'https://assets.mixkit.co/active_storage/sfx/2800/2800-preview.mp3';
const OUTGOING_RINGTONE = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

export const CallOverlay = () => {
  const { 
    currentUser, 
    chats,
    activeCall, 
    incomingCall, 
    outgoingCall, 
    answerCall, 
    endCall, 
    leaveCall 
  } = useChatStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reproducción de Ringtone (Refactorizado para evitar stutter)
  useEffect(() => {
    if (incomingCall || outgoingCall) {
      const audioUrl = incomingCall ? INCOMING_RINGTONE : OUTGOING_RINGTONE;
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.loop = true;
      }
      
      // Solo reasignar y dar play si la URL cambió para evitar que se reinicie el audio
      if (!audioRef.current.src.endsWith(audioUrl)) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch((e) => {
          console.warn('Ringtone autoplay blocked by browser:', e);
        });
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = ''; // Limpiar src para que la próxima vez pase la validación
      }
    }
  }, [incomingCall, outgoingCall]);

  // Cleanup de desmontaje (Unmount) real
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Timeout de 45 segundos para llamadas fantasma
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (outgoingCall) {
      timeout = setTimeout(() => {
        console.log('Call timeout reached (45s)');
        endCall(outgoingCall.chatId);
      }, 45000);
    } else if (incomingCall) {
      timeout = setTimeout(() => {
        console.log('Incoming call timeout reached (45s)');
        answerCall(incomingCall.chatId, false);
      }, 45000);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [outgoingCall, endCall, incomingCall, answerCall]);

  const activeChat = activeCall 
    ? chats.find(c => c.id === activeCall.chatId) 
    : null;

  return (
    <>
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            key="incoming-call-modal"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 min-w-[300px] flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 relative">
              <img src={incomingCall.callerAvatar || 'https://i.pravatar.cc/150'} className="w-full h-full rounded-full object-cover shadow-md border-2 border-[#6366f1]/20" alt="Llamada entrante" />
              <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-sm text-wa-teal">
                {incomingCall.type === 'video' ? <Video size={14} /> : <Phone size={14} />}
              </div>
            </div>
            <div className="text-center">
              <h4 className="font-bold text-lg text-gray-800">{incomingCall.callerName}</h4>
              <p className="text-sm text-gray-500 font-medium">{incomingCall.type === 'video' ? 'Videollamada entrante' : 'Llamada de voz entrante'}</p>
            </div>
            <div className="flex gap-4 w-full mt-2">
              <button 
                onClick={() => answerCall(incomingCall.chatId, false)}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <PhoneOff size={18} /> Rechazar
              </button>
              <button 
                onClick={() => answerCall(incomingCall.chatId, true)}
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#6366f1]/30 transition-all"
              >
                <Phone size={18} /> Aceptar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {outgoingCall && (
          <motion.div 
            key="outgoing-call-modal"
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-white/90 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border border-white/40 flex flex-col items-center gap-4 w-[320px]"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-[#6366f1]/20 animate-ping rounded-full" />
              <img src={outgoingCall.receiverAvatar || 'https://i.pravatar.cc/150'} alt="Llamando" className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg relative z-10" />
            </div>
            <div className="text-center">
              <h4 className="font-bold text-lg text-gray-800">{outgoingCall.receiverName}</h4>
              <p className="text-sm text-[#6366f1] font-medium animate-pulse">Llamando...</p>
            </div>
            <button 
              onClick={() => endCall(outgoingCall.chatId)} // Fix: was leaveCall(), now correctly ends call
              className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all mt-2"
            >
              <PhoneOff size={18} /> Colgar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {activeCall && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black">
            <Loader2 className="animate-spin text-wa-teal" size={48} />
          </div>
        }>
          <CallView 
            roomName={activeCall.chatId}
            participantName={currentUser?.name || 'Usuario'}
            chatName={activeChat?.isGroup ? activeChat.name : activeChat?.name || 'Usuario'}
            chatAvatar={activeChat?.isGroup ? activeChat.avatar || '' : activeChat?.avatar || 'https://i.pravatar.cc/150'}
            onClose={() => leaveCall()}
            onCallEmpty={() => endCall(activeCall.chatId)}
            video={activeCall.type === 'video'}
          />
        </Suspense>
      )}
    </>
  );
};
