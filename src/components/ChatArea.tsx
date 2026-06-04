import React, { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { 
  Send, Smile, ArrowLeft, Image as ImageIcon, 
  X, Reply, Plus, Trash2, 
  FileText, File as FileIcon, Mic, StopCircle, Play, Pause, Download,
  Lock, Phone, PhoneOff, Video, Ban, Search, MoreVertical, AlertCircle, Info,
  Clock, Check
} from 'lucide-react';
import { useChatStore, Message } from '../features/sidebar/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadImage, uploadFile, uploadVideo, uploadAudio, getAudioDuration } from '../utils/upload';
import { ErrorBoundary } from './ErrorBoundary';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import logo from '../assets/logo.png';
import { Theme, EmojiClickData } from 'emoji-picker-react';
import { Virtuoso } from 'react-virtuoso';
import AudioRouting from '../utils/AudioRouting';
import { MediaPreviewModal, PendingMedia } from './MediaPreviewModal';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const getWallpaperColor = (id: string) => {
  const colors: Record<string, string> = {
    'default': '#e5ddd5',
    'dark': '#0b141a',
    'blue': '#7aa2f7',
    'purple': '#bb9af7',
    'green': '#9ece6a',
    'rose': '#f7768e',
    'yellow': '#e0af68',
  };
  return colors[id] || colors['default'];
};

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '😡'];

export const ChatArea = () => {
  const { 
    activeChatId, chats, messages, sendMessage, closeChat, setView, currentUser, 
    markMessagesRead, setViewingGroup, chatWallpaper, typingUsers, uploadingUsers, sendTypingStatus,
    addReaction, replyingTo, setReplyingTo,
    hasMoreMessages, loadMoreMessages, deleteMessage, addMessage, updateMessageStatus, deleteMessageLocal,
    callUser
  } = useChatStore();
  
  const activeChat = Array.isArray(chats) ? chats.find(c => c.id === activeChatId) : null;
  const [inputText, setInputText] = useState('');
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[] | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const mics = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices(mics);
      if (mics.length > 0) setSelectedAudioDevice(mics[0].deviceId);
    }).catch(console.error);
  }, []);

  // Escuchar evento nativo de desconexión de audio y robo de foco
  useEffect(() => {
    let hwListener: any;
    let focusListener: any;
    if (Capacitor.isNativePlatform()) {
      AudioRouting.addListener('onAudioHardwareDisconnected', () => {
         window.dispatchEvent(new Event('force_stop_recording'));
      }).then((l: any) => hwListener = l);

      AudioRouting.addListener('onAudioFocusChange', ({ event }) => {
        if (event === 'loss') {
          window.dispatchEvent(new Event('force_stop_recording'));
        }
      }).then((l: any) => focusListener = l);
    }
    return () => {
      if (hwListener) hwListener.remove();
      if (focusListener) focusListener.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      // Limpiar cronómetro si el componente se desmonta mientras graba
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      
      // Apagar micrófono fantasma y descartar nota de voz no enviada
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        cancelRecordingRef.current = true;
        mediaRecorderRef.current.stop();
      }

      // Liberar ruteo de audio de Capacitor
      if (Capacitor.isNativePlatform()) {
        AudioRouting.stopBluetoothSco().catch(() => {});
        AudioRouting.abandonAudioFocus().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const handleForceStop = () => {
      if (isRecording) {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        if (Capacitor.isNativePlatform()) {
          AudioRouting.stopBluetoothSco().catch(e => console.error('SCO stop error', e));
          AudioRouting.abandonAudioFocus().catch(e => console.error('Focus abandon error', e));
        }
      }
    };
    window.addEventListener('force_stop_recording', handleForceStop);
    return () => window.removeEventListener('force_stop_recording', handleForceStop);
  }, [isRecording]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 430);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const cancelRecordingRef = useRef<boolean>(false);

  const currentMessages = useMemo(() => (activeChatId ? messages[activeChatId] || [] : []), [activeChatId, messages]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return currentMessages;
    return currentMessages.filter(msg => 
      msg.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.fileName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [currentMessages, searchQuery]);

  const prevMessagesLengthRef = useRef(currentMessages.length);
  const prevChatIdRef = useRef(activeChatId);

  const formatLastSeen = (timestamp?: string) => {
    if (!timestamp) return 'últ. vez recientemente';
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return `últ. vez hoy a las ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `últ. vez el ${date.toLocaleDateString()} a las ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleResize = () => setIsSmallScreen(window.innerWidth < 430);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const isChatChanged = activeChatId !== prevChatIdRef.current;
    const isNewMessageAtBottom = currentMessages.length - prevMessagesLengthRef.current === 1;
    const isFirstLoad = prevMessagesLengthRef.current === 0 && currentMessages.length > 0;
    
    let isAtBottom = true;
    if (scrollContainerRef.current) {
      const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
      isAtBottom = scrollHeight - scrollTop - clientHeight < 150; // Margen de 150px
    }
    
    const lastMessage = currentMessages[currentMessages.length - 1];
    const isMyMessage = lastMessage?.senderId === currentUser?.id;
    
    // Auto-scroll solo si: entramos al chat, primera carga, o si llegó un mensaje
    // nuevo y ya estábamos abajo o el mensaje lo acabamos de enviar nosotros.
    if (isChatChanged || isFirstLoad || (isNewMessageAtBottom && (isAtBottom || isMyMessage))) {
      scrollToBottom();
    }
    
    prevMessagesLengthRef.current = currentMessages.length;
    prevChatIdRef.current = activeChatId;

    if (activeChatId) {
      markMessagesRead(activeChatId);
    }
  }, [currentMessages, activeChatId]);

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    if (target.scrollTop === 0 && activeChatId && hasMoreMessages[activeChatId] && !isLoadingMore) {
      setIsLoadingMore(true);
      const previousScrollHeight = target.scrollHeight;
      
      await loadMoreMessages(activeChatId);
      
      // Restaurar la posición del scroll para que no salte al principio
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - previousScrollHeight;
        }
      });
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!activeChatId || !inputText.trim()) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        sendTypingStatus(activeChatId!, false);
      }
      return;
    }
    sendTypingStatus(activeChatId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(activeChatId, false);
      typingTimeoutRef.current = null;
    }, 3000);
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        if (activeChatId) sendTypingStatus(activeChatId, false);
      }
    };
  }, [inputText, activeChatId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (activeChat?.isGroup) {
      const lastWord = val.split(' ').pop();
      if (lastWord?.startsWith('@')) {
        setShowMentions(true);
        setMentionQuery(lastWord.substring(1).toLowerCase());
      } else {
        setShowMentions(false);
        setMentionQuery(null);
      }
    }
  };


  const handleSend = () => {
    if (inputText.trim() && activeChatId) {
      sendMessage(activeChatId, inputText, 'text', undefined, replyingTo?.id);
      setInputText('');
      sendTypingStatus(activeChatId, false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'media' | 'file' | 'audio') => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && activeChatId && currentUser) {
      setShowPlusMenu(false);
      
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      const validFiles = files.filter(f => f.size <= MAX_SIZE);
      
      if (validFiles.length < files.length) {
        alert(`Algunos archivos superan el límite de 10MB y no fueron seleccionados.`);
      }

      if (validFiles.length === 0) {
        if (e.target) e.target.value = '';
        return;
      }

      const newPendingMedia: PendingMedia[] = validFiles.map(file => {
        const localUrl = URL.createObjectURL(file);
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        
        let actualType: 'image' | 'video' | 'file' | 'audio' = 'file';
        if (type === 'media') {
          actualType = isVideo ? 'video' : 'image';
        } else if (type === 'audio' || isAudio) {
          actualType = 'audio';
        }
        
        return {
          id: crypto.randomUUID(),
          file,
          type: actualType,
          url: localUrl,
          caption: ''
        };
      });

      setPendingMedia(newPendingMedia);
      
      if (e.target) e.target.value = ''; // Reset input immediately
    }
  };

  const confirmSendMedia = async (mediaList: PendingMedia[]) => {
    setPendingMedia(null); // Cerrar el modal

    if (!activeChatId || !currentUser) return;

    for (const media of mediaList) {
      const messageId = crypto.randomUUID();
      
      addMessage(activeChatId, {
        id: messageId,
        conversationId: activeChatId,
        senderId: currentUser.id,
        text: media.caption || '',
        type: media.type,
        imageUrl: media.type === 'image' ? media.url : undefined,
        fileUrl: media.type !== 'image' ? media.url : undefined,
        fileName: media.file.name,
        fileType: media.file.type,
        status: 'sending',
        isDeleted: false,
        deletedFor: [],
        timestamp: new Date().toISOString(),
        reactions: {}
      });

      try {
        useChatStore.getState().sendMediaUploadingStatus(activeChatId, true, media.type);
        // Micro-respiro para permitir que la UI y el Socket se procesen antes del bloqueo de CPU
        await new Promise(resolve => setTimeout(resolve, 50));

        if (media.type === 'video') {
          const videoUrl = await uploadVideo(media.file);
          const stillExists = useChatStore.getState().messages[activeChatId]?.some((m: any) => m.id === messageId);
          if (!stillExists) return;
          
          sendMessage(activeChatId, media.caption, 'video', undefined, replyingTo?.id, {
            url: videoUrl,
            fileName: media.file.name,
            fileType: media.file.type
          }, messageId);
        } else if (media.type === 'image') {
          const imageUrl = await uploadImage(media.file);
          const stillExists = useChatStore.getState().messages[activeChatId]?.some((m: any) => m.id === messageId);
          if (!stillExists) return;

          sendMessage(activeChatId, media.caption, 'image', imageUrl, replyingTo?.id, undefined, messageId);
        } else if (media.type === 'audio') {
          const audioUrl = await uploadAudio(media.file);
          const duration = await getAudioDuration(media.file);
          const stillExists = useChatStore.getState().messages[activeChatId]?.some((m: any) => m.id === messageId);
          if (!stillExists) return;

          sendMessage(activeChatId, media.caption, 'audio', undefined, replyingTo?.id, {
            url: audioUrl,
            fileName: media.file.name,
            fileType: media.file.type,
            duration: duration
          }, messageId);
        } else {
          const fileUrl = await uploadFile(media.file);
          const stillExists = useChatStore.getState().messages[activeChatId]?.some((m: any) => m.id === messageId);
          if (!stillExists) return;

          sendMessage(activeChatId, media.caption, 'file', undefined, replyingTo?.id, {
            url: fileUrl,
            fileName: media.file.name,
            fileType: media.file.type
          }, messageId);
        }
      } catch (error: any) {
        console.error('Upload error:', error);
        updateMessageStatus(activeChatId, messageId, 'failed');
      } finally {
        useChatStore.getState().sendMediaUploadingStatus(activeChatId, false);
        // Limpiar memoria RAM después de enviar
        URL.revokeObjectURL(media.url);
      }
    }
  };

  const startRecording = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        try { 
          await AudioRouting.requestAudioFocus();
          await AudioRouting.startBluetoothSco(); 
        } catch (e) { console.error('Audio Setup Error', e); }
      }
      
      const baseAudioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: { ideal: 16000 },
        channelCount: { ideal: 1 }
      };

      const constraints = selectedAudioDevice 
        ? { audio: { ...baseAudioConstraints, deviceId: { exact: selectedAudioDevice } } } 
        : { audio: baseAudioConstraints };
        
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const mediaRecorder = new (window as any).MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e: any) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice_note.webm', { type: 'audio/webm' });
        
        if (currentUser && activeChatId) {
          const messageId = crypto.randomUUID();
          const localUrl = URL.createObjectURL(audioFile);
          
          addMessage(activeChatId, {
            id: messageId,
            conversationId: activeChatId,
            senderId: currentUser.id,
            text: '',
            type: 'audio',
            fileUrl: localUrl,
            fileName: 'Nota de voz',
            fileType: 'audio/webm',
            duration: 0,
            status: 'sending',
            isDeleted: false,
            deletedFor: [],
            timestamp: new Date().toISOString(),
            reactions: {}
          });

          setRecordingTime(0);

          try {
            const audioUrl = await uploadAudio(audioFile);
            const duration = await getAudioDuration(audioFile);
            sendMessage(activeChatId, undefined, 'audio', undefined, replyingTo?.id, {
              url: audioUrl,
              fileName: 'Nota de voz',
              fileType: 'audio/webm',
              duration: duration
            }, messageId);
          } catch (error) {
            console.error('Audio upload error:', error);
            updateMessageStatus(activeChatId, messageId, 'failed');
          }
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Para enviar notas de voz, permite el acceso al micrófono en la configuración de tu navegador.');
      } else if (err.name === 'NotFoundError') {
        alert('No se encontró un micrófono en tu dispositivo.');
      } else {
        alert('Error al acceder al micrófono. Verifica los permisos de tu navegador.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (Capacitor.isNativePlatform()) {
        AudioRouting.stopBluetoothSco().catch(e => console.error('SCO stop error', e));
        AudioRouting.abandonAudioFocus().catch(e => console.error('Focus abandon error', e));
      }
    }
  };

  const onEmojiClick = (emojiData: any) => {
    setInputText(prev => prev + emojiData.emoji);
    // No cerramos el picker automáticamente para que el usuario pueda poner varios
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeChatId || !activeChat) {
    return (
      <div className="flex-1 bg-wa-bg flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        {/* Marca de Agua en Estado Vacío (Sin el recuadro de imagen viejo) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center">
          <div 
            className="absolute inset-0 opacity-[0.04] bg-repeat"
            style={{ backgroundImage: "url('/favicon.png')", backgroundSize: "120px" }}
          />
          <span className="text-[80px] md:text-[120px] font-black uppercase text-wa-text-primary opacity-[0.03] rotate-[-25deg] whitespace-nowrap select-none">
            AsicMe Chat
          </span>
        </div>
        <h1 className="text-3xl font-light text-wa-text-primary mb-4 relative z-10 mt-10">Asicme Chat</h1>
        <p className="text-wa-text-secondary max-w-md leading-relaxed relative z-10">
          Envía y recibe mensajes sin necesidad de mantener tu teléfono conectado.
        </p>
        <div className="mt-auto flex items-center gap-2 text-wa-text-secondary text-sm opacity-50 relative z-10">
          <Lock size={14} />
          Cifrado de extremo a extremo
        </div>
      </div>
    );
  }

  const isOtherTyping = typingUsers[activeChatId]?.length > 0;
  const otherUploads = (activeChatId && uploadingUsers[activeChatId]) || [];
  const isOtherUploading = otherUploads.length > 0;
  const uploadType = isOtherUploading ? otherUploads[0].type : null;
  
  const getStatusText = () => {
    if (isOtherUploading) {
      if (uploadType === 'video') return 'enviando video...';
      if (uploadType === 'audio') return 'grabando audio...';
      if (uploadType === 'image') return 'enviando imagen...';
      return 'enviando documento...';
    }
    if (isOtherTyping) return 'escribiendo...';
    return activeChat.isOnline ? 'en línea' : formatLastSeen(activeChat.lastSeen);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <div 
        className="flex-1 flex flex-col relative border-r border-wa-border overflow-hidden transition-colors duration-500"
        style={{ backgroundColor: getWallpaperColor(chatWallpaper) }}
      >
        {/* Marca de Agua / Pattern de Fondo en el chat */}
        <div className="absolute inset-0 z-0 pointer-events-none mt-[60px] mb-[62px] overflow-hidden flex items-center justify-center transform-gpu will-change-transform">
          <div 
            className="absolute inset-0 opacity-[0.05] bg-repeat transform-gpu will-change-transform"
            style={{ backgroundImage: "url('/favicon.png')", backgroundSize: "150px" }}
          />
          <span className="text-[80px] md:text-[150px] font-black uppercase text-wa-text-primary opacity-[0.03] rotate-[-25deg] whitespace-nowrap select-none">
            AsicMe Chat
          </span>
        </div>

        <div className="h-[56px] sm:h-[60px] bg-wa-sidebar flex items-center justify-between px-2 sm:px-4 py-2 shadow-sm z-10 border-b border-wa-border relative">
          <div 
            className={cn("flex items-center gap-2 sm:gap-3", activeChat.isGroup && "cursor-pointer hover:bg-black/5 p-1 -ml-1 rounded-lg transition-colors")} 
            onClick={() => { if (activeChat.isGroup) { setViewingGroup(activeChat); setView('group-info'); } }}
          >
            <ArrowLeft className="md:hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); closeChat(); }} />
            <div className="relative">
              <img src={activeChat.avatar} className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover" alt="" />
              {activeChat.isOnline && !activeChat.isGroup && <div className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green border-2 border-white rounded-full"></div>}
            </div>
            <div>
              <h3 className="font-medium text-wa-text-primary leading-tight text-[15px] sm:text-base truncate max-w-[120px] sm:max-w-none">{activeChat.name}</h3>
              <p className={cn("text-[13px] transition-colors", (isOtherTyping || isOtherUploading) ? "text-wa-teal font-medium" : "text-wa-text-secondary")}>
                {getStatusText()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Branding: Logo y Título con Efecto Glow Estático y Glassmorphism Optimizado */}
            <div className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-gradient-to-r from-[#6366f1]/10 to-purple-500/10 rounded-full border border-[#6366f1]/20 shadow-[0_4px_15px_rgba(0,123,252,0.1)] hover:shadow-[0_4px_25px_rgba(0,123,252,0.25)] hover:border-[#6366f1]/40 hover:scale-[1.02] transition-all duration-300 cursor-default group transform-gpu">
              <div className="relative">
                <img src={logo} alt="Asicme Chat" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(0,123,252,0.5)] group-hover:drop-shadow-[0_0_12px_rgba(0,123,252,0.8)] transition-all duration-300" />
                <div className="absolute inset-0 bg-blue-500/20 blur-[10px] rounded-full -z-10"></div>
              </div>
              <span className="text-[14px] font-semibold bg-gradient-to-r from-wa-text-primary to-[#6366f1] bg-clip-text text-transparent tracking-wider uppercase text-xs">ASICME CHAT</span>
            </div>
            {/* Botones de Llamada y Búsqueda */}
            <div className="flex items-center gap-3 sm:gap-4 text-wa-text-secondary mr-1 sm:mr-2">
              {!isSmallScreen && (
                <>
                  <Search 
                    size={20} 
                    className={cn("cursor-pointer hover:text-wa-teal transition-colors", isSearching && "text-wa-teal")} 
                    onClick={() => {
                      setIsSearching(!isSearching);
                      if (isSearching) setSearchQuery('');
                    }} 
                  />
                  <Video size={20} className="cursor-pointer hover:text-wa-teal transition-colors" onClick={() => callUser(activeChatId!, 'video', activeChat?.name, activeChat?.avatar)} />
                  <Phone size={19} className="cursor-pointer hover:text-wa-teal transition-colors" onClick={() => callUser(activeChatId!, 'voice', activeChat?.name, activeChat?.avatar)} />
                  {activeChat.isGroup && (
                    <Info 
                      size={20} 
                      className="cursor-pointer hover:text-wa-teal transition-colors ml-1" 
                      onClick={() => { setViewingGroup(activeChat); setView('group-info'); }}
                    />
                  )}
                </>
              )}
              
              <div className="relative ml-2 sm:ml-4">
                <MoreVertical 
                  size={20} 
                  className="cursor-pointer hover:text-wa-teal transition-colors" 
                  onClick={() => setShowHeaderMenu(!showHeaderMenu)} 
                />
                <AnimatePresence>
                  {showHeaderMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: -10, x: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10, x: 10 }}
                        className="absolute top-10 right-0 w-48 bg-white rounded-xl shadow-2xl py-2 z-50 border border-wa-border overflow-hidden"
                      >
                        {isSmallScreen && activeChat.isGroup && (
                          <button 
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-wa-bg text-wa-text-primary text-[14.5px] transition-colors"
                            onClick={() => {
                              setShowHeaderMenu(false);
                              setViewingGroup(activeChat); 
                              setView('group-info');
                            }}
                          >
                            <Info size={16} />
                            <span>Info. del grupo</span>
                          </button>
                        )}
                        {isSmallScreen && (
                          <>
                            <button 
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-wa-bg text-wa-text-primary text-[14.5px] transition-colors"
                              onClick={() => {
                                setIsSearching(!isSearching);
                                setShowHeaderMenu(false);
                              }}
                            >
                              <Search size={18} />
                              <span>Buscar en el chat</span>
                            </button>
                            <button 
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-wa-bg text-wa-text-primary text-[14.5px] transition-colors"
                              onClick={() => {
                                callUser(activeChatId!, 'video', activeChat?.name, activeChat?.avatar);
                                setShowHeaderMenu(false);
                              }}
                            >
                              <Video size={18} />
                              <span>Video llamada</span>
                            </button>
                            <button 
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-wa-bg text-wa-text-primary text-[14.5px] transition-colors"
                              onClick={() => {
                                callUser(activeChatId!, 'voice', activeChat?.name, activeChat?.avatar);
                                setShowHeaderMenu(false);
                              }}
                            >
                              <Phone size={18} />
                              <span>Llamada de voz</span>
                            </button>
                          </>
                        )}
                        <button 
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 text-red-500 text-[14.5px] transition-colors"
                          onClick={() => {
                            setShowHeaderMenu(false);
                            if (window.confirm('¿Estás seguro de vaciar el chat? Se eliminarán todos los mensajes solo para ti.')) {
                              useChatStore.getState().clearChat(activeChatId!);
                            }
                          }}
                        >
                          <Trash2 size={16} />
                          <span>Vaciar chat</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda Interna */}
        <AnimatePresence>
          {isSearching && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-wa-sidebar px-4 py-2 border-b border-wa-border z-10"
            >
              <div className="relative flex items-center bg-wa-bg rounded-lg px-3 py-1.5">
                <Search size={16} className="text-wa-text-secondary" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Buscar en el chat..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[14px] ml-3"
                />
                {searchQuery && (
                  <X 
                    size={16} 
                    className="text-wa-text-secondary cursor-pointer hover:text-wa-text-primary" 
                    onClick={() => setSearchQuery('')}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-hidden relative z-1 bg-wa-bg">
          {isLoadingMore && (
            <div className="absolute top-0 left-0 right-0 flex justify-center py-2 z-10 bg-gradient-to-b from-wa-bg to-transparent">
              <div className="w-6 h-6 border-2 border-wa-teal border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          <Virtuoso
            style={{ height: '100%' }}
            data={filteredMessages}
            initialTopMostItemIndex={filteredMessages.length - 1}
            followOutput="smooth"
            alignToBottom
            components={{
              Footer: () => <div className="h-4" /> // Spacing at bottom
            }}
            itemContent={(index: number, msg: any) => {
              const isMe = msg.senderId === currentUser?.id;
              const showTail = index === 0 || filteredMessages[index - 1].senderId !== msg.senderId;
              const repliedMsg = msg.replyToId ? currentMessages.find(m => m.id === msg.replyToId) : null;
              
              const msgDate = new Date(msg.timestamp);
              const prevMsgDate = index > 0 ? new Date(filteredMessages[index - 1].timestamp) : null;
              const showDateSeparator = !prevMsgDate || prevMsgDate.toDateString() !== msgDate.toDateString();
              
              const sender = activeChat?.isGroup ? (activeChat as any).participants?.find((p: any) => p.id === msg.senderId) : undefined;

              return (
                <div className="px-3 sm:px-4 sm:px-8 md:px-12 lg:px-16 pt-1">
                  {showDateSeparator && <DateSeparator date={msgDate} />}
                  <MessageBubble 
                    msg={msg} 
                    isMe={isMe} 
                    showTail={showTail} 
                    repliedMsg={repliedMsg} 
                    onReply={() => setReplyingTo(msg)} 
                    onReact={(emoji: string) => addReaction(activeChatId, msg.id, emoji)} 
                    onDelete={(forEveryone: boolean) => deleteMessage(activeChatId, msg.id, forEveryone)}
                    onDeleteLocal={() => deleteMessageLocal(activeChatId, msg.id)}
                    onImageClick={setSelectedImage}
                    onVideoClick={setSelectedVideo}
                    searchQuery={searchQuery}
                    isGroup={activeChat?.isGroup}
                    senderName={sender?.name || msg.senderId}
                  />
                </div>
              );
            }}
          />
        </div>

        <div className="bg-wa-sidebar min-h-[62px] flex flex-col z-20 relative">
          <AnimatePresence>
            {replyingTo && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-wa-bg mx-2 mt-2 rounded-lg border-l-4 border-wa-teal overflow-hidden flex">
                <div className="flex-1 p-2 px-3">
                  <div className="text-[13px] font-bold text-wa-teal mb-0.5">{replyingTo.senderId === currentUser?.id ? 'Tú' : activeChat.name}</div>
                  <div className="text-[14px] text-wa-text-secondary truncate">{replyingTo.type === 'image' ? '📷 Imagen' : replyingTo.type === 'video' ? '🎥 Video' : replyingTo.type === 'audio' ? '🎤 Nota de voz' : replyingTo.text}</div>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-2 text-wa-text-secondary hover:text-wa-text-primary"><X size={18} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 px-4 py-3 relative">
            <div className="flex gap-3 text-wa-text-secondary items-center">
              <div className="relative">
                <Smile 
                  size={24} 
                  className={cn("cursor-pointer hover:text-wa-teal transition-colors", showEmojiPicker && "text-wa-teal")} 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                />
                <AnimatePresence>
                  {showEmojiPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-12 left-0 z-[100] shadow-2xl max-w-[calc(100vw-32px)]"
                    >
                      <Suspense fallback={<div className="w-[350px] h-[400px] bg-wa-sidebar flex items-center justify-center rounded-lg border border-wa-border">
                        <div className="w-8 h-8 border-2 border-wa-teal border-t-transparent rounded-full animate-spin"></div>
                      </div>}>
                        <EmojiPicker 
                          onEmojiClick={onEmojiClick}
                          autoFocusSearch={false}
                          theme={Theme.LIGHT}
                          width={Math.min(350, Math.max(200, window.innerWidth - 32))}
                          height={400}
                          lazyLoadEmojis={true}
                        />
                      </Suspense>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="relative">
                <Plus size={24} className={cn("cursor-pointer transition-transform duration-300", showPlusMenu && "rotate-45 text-wa-teal")} onClick={() => setShowPlusMenu(!showPlusMenu)} />
                <AnimatePresence>
                  {showPlusMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.9, x: -20 }} 
                      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }} 
                      exit={{ opacity: 0, y: 10, scale: 0.9, x: -20 }} 
                      className="absolute bottom-14 left-0 bg-white rounded-2xl shadow-2xl py-4 w-56 z-50 border border-wa-border overflow-hidden"
                    >
                      <PlusMenuItem 
                        icon={<FileText size={22} />} 
                        label="Documento" 
                        bgColor="bg-[#5157ae]" 
                        onClick={() => docInputRef.current?.click()} 
                      />
                      <PlusMenuItem 
                        icon={<ImageIcon size={22} />} 
                        label="Fotos y videos" 
                        bgColor="bg-[#6366f1]" 
                        onClick={() => fileInputRef.current?.click()} 
                      />
                      <PlusMenuItem 
                        icon={<Mic size={22} />} 
                        label="Audio" 
                        bgColor="bg-[#e91e63]" 
                        onClick={() => audioInputRef.current?.click()} 
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" multiple onChange={(e) => handleFileUpload(e, 'media')} />
                <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" multiple onChange={(e) => handleFileUpload(e, 'file')} />
                <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" multiple onChange={(e) => handleFileUpload(e, 'audio')} />
              </div>
            </div>
            {isRecording ? (
              <div className="flex-1 bg-wa-bg rounded-xl px-4 py-2 flex items-center gap-3 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <span className="text-wa-text-primary font-medium flex-1">{formatTime(recordingTime)}</span>
                <button onClick={stopRecording} className="text-red-500 hover:scale-110 transition-transform"><StopCircle size={28} /></button>
              </div>
            ) : (
              <div className="flex-1 bg-white rounded-xl px-4 py-2 shadow-sm relative">
                <AnimatePresence>
                  {showMentions && activeChat?.isGroup && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-wa-border overflow-hidden z-[100]"
                    >
                      {(activeChat as any).participants
                        ?.filter((p: any) => p.name?.toLowerCase().includes(mentionQuery || ''))
                        .map((p: any) => (
                          <div 
                            key={p.id}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-wa-bg cursor-pointer transition-colors"
                            onClick={() => {
                              const words = inputText.split(' ');
                              words.pop();
                              setInputText([...words, `@${p.name} `].join(' '));
                              setShowMentions(false);
                            }}
                          >
                            <img src={p.avatar || 'https://i.pravatar.cc/150'} className="w-8 h-8 rounded-full object-cover" />
                            <span className="text-[14px] font-medium text-wa-text-primary">{p.name}</span>
                          </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
                <input type="text" value={inputText} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Escribe un mensaje" className="w-full bg-transparent outline-none text-[15px]" />
              </div>
            )}
            
            {audioDevices.length > 1 && !inputText.trim() && !isRecording && (
              <div className="relative group/mic-settings flex items-center justify-center mr-1">
                 <div className="p-1 rounded-full hover:bg-gray-100 cursor-pointer transition-colors text-gray-400 hover:text-wa-teal">
                    <Mic size={16} />
                 </div>
                 <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-xl p-2 min-w-[200px] text-sm z-[100] border border-gray-100 opacity-0 group-hover/mic-settings:opacity-100 pointer-events-none group-hover/mic-settings:pointer-events-auto transition-opacity">
                  <div className="text-xs font-bold text-gray-400 mb-2 uppercase px-1">Seleccionar Micrófono</div>
                  {audioDevices.map(device => (
                    <div 
                      key={device.deviceId} 
                      onClick={() => setSelectedAudioDevice(device.deviceId)}
                      className={cn("px-2 py-1.5 rounded cursor-pointer truncate transition-colors", selectedAudioDevice === device.deviceId ? "bg-wa-teal/10 text-wa-teal font-bold" : "hover:bg-gray-50 text-gray-700")}
                    >
                      {device.label || `Micrófono ${audioDevices.indexOf(device) + 1}`}
                    </div>
                  ))}
                 </div>
              </div>
            )}

            <div className="w-11 h-11 flex items-center justify-center">
              {inputText.trim() || isRecording ? (
                <div onClick={isRecording ? stopRecording : handleSend} className="w-full h-full bg-wa-teal rounded-full flex items-center justify-center text-white cursor-pointer shadow-md hover:scale-105 transition-all"><Send size={20} fill="currentColor" /></div>
              ) : (
                <div onClick={startRecording} className="w-full h-full text-wa-text-secondary cursor-pointer hover:text-wa-teal transition-colors flex items-center justify-center"><Mic size={24} /></div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {pendingMedia && (
          <MediaPreviewModal 
            media={pendingMedia} 
            onSend={confirmSendMedia} 
            onCancel={() => {
              pendingMedia.forEach(media => URL.revokeObjectURL(media.url));
              setPendingMedia(null);
            }} 
          />
        )}
        {selectedImage && <ImageModal key="image-modal" url={selectedImage} onClose={() => setSelectedImage(null)} />}
        {selectedVideo && <VideoModal key="video-modal" url={selectedVideo} onClose={() => setSelectedVideo(null)} />}
      </AnimatePresence>
    </div>
  );
};

const PlusMenuItem = ({ icon, label, onClick, bgColor }: any) => (
  <div onClick={onClick} className="flex items-center gap-4 px-6 py-3 hover:bg-wa-bg cursor-pointer transition-colors group">
    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform", bgColor)}>
      {icon}
    </div>
    <span className="text-[14.5px] text-wa-text-primary font-medium">{label}</span>
  </div>
);

const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  const color = '#' + '00000'.substring(0, 6 - c.length) + c;
  return color;
};

const DateSeparator = ({ date }: { date: Date }) => {
  const isToday = new Date().toDateString() === date.toDateString();
  const isYesterday = new Date(Date.now() - 86400000).toDateString() === date.toDateString();
  const dateStr = isToday ? 'Hoy' : isYesterday ? 'Ayer' : date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  
  return (
    <div className="flex justify-center my-3 sticky top-2 z-10">
      <div className="bg-wa-sidebar/95 px-4 py-1.5 rounded-xl border border-wa-border/50 text-[12.5px] font-medium text-wa-text-secondary shadow-sm">
        {dateStr}
      </div>
    </div>
  );
};

const MessageBubble = ({ msg, isMe, showTail, repliedMsg, onReply, onReact, onDelete, onDeleteLocal, onImageClick, onVideoClick, searchQuery, isGroup, senderName }: any) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const renderHighlightedText = (text: string) => {
    if (!text) return text;
    
    if (searchQuery) {
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
        return (
          <>
            {parts.map((part, i) => 
              part.toLowerCase() === searchQuery.toLowerCase() 
                ? <span key={i} className="bg-yellow-400 text-black px-0.5 rounded">{part}</span> 
                : part
            )}
          </>
        );
      } catch (e) {
        return text;
      }
    }

    // Formatear menciones con color azul
    const parts = text.split(/(@[\wáéíóúñ]+)/gi);
    return (
      <>
        {parts.map((part, i) => 
          part.startsWith('@') 
            ? <span key={i} className="text-[#6366f1] font-bold cursor-pointer hover:underline">{part}</span> 
            : part
        )}
      </>
    );
  };

  const renderContent = () => {
    if (msg.isDeleted) {
      return <div className="flex items-center gap-2 text-wa-text-secondary italic opacity-80"><Ban size={16} /> <span className="text-[14.5px]">Este mensaje fue eliminado</span></div>;
    }
    
    const isSending = msg.status === 'sending';
    const sendingOverlay = isSending ? (
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-20 rounded-lg group/overlay">
        <div className="relative flex items-center justify-center w-12 h-12">
          {/* Barra cargando circular */}
          <div className="absolute inset-0 border-4 border-white/20 border-t-white rounded-full animate-spin shadow-md" />
          {/* Botón X de cancelación rápida */}
          <button 
            onClick={(e) => { e.stopPropagation(); onDeleteLocal && onDeleteLocal(); }}
            className="relative z-30 p-2 rounded-full text-white hover:bg-white/20 transition-colors"
            title="Cancelar envío"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    ) : null;

    switch (msg.type) {
      case 'image':
        return (
          <div className="space-y-1 relative">
            <div 
              className={cn("relative group/img cursor-pointer overflow-hidden rounded-lg min-h-[200px] min-w-[200px] bg-black/10 flex items-center justify-center")}
              onClick={() => !isSending && onImageClick(msg.imageUrl || null)}
            >
              {sendingOverlay}
              {isSending ? (
                <div className="flex flex-col items-center gap-2">
                  <ImageIcon size={48} className="text-white/40" />
                  <span className="text-[11px] text-white/60 font-medium">Subiendo imagen...</span>
                </div>
              ) : (
                <img
                  src={msg.imageUrl}
                  alt="Sent"
                  className="max-w-full hover:scale-[1.02] transition-transform duration-500 object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/><line x1="3" y1="3" x2="21" y2="21" stroke="%23ef4444"/></svg>';
                    e.currentTarget.className = "w-24 h-24 opacity-50 object-contain m-4";
                  }}
                />
              )}
              {!isSending && (
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                  <Search size={24} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                </div>
              )}
            </div>
            {msg.text && <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap px-0.5">{msg.text}</p>}
          </div>
        );
      case 'video':
        const isUrlValid = msg.fileUrl && msg.fileUrl.startsWith('data:') || msg.fileUrl?.startsWith('blob:');
        return (
          <div className="space-y-1 relative">
            <div
              className={cn("relative group/vid cursor-pointer overflow-hidden rounded-lg bg-black/80 flex items-center justify-center min-h-[150px] min-w-[200px]")}
              onClick={() => !isSending && onVideoClick(msg.fileUrl || null)}
            >
              {sendingOverlay}
              {isSending ? (
                <div className="flex flex-col items-center gap-2">
                  <Video size={48} className="text-white/40" />
                  <span className="text-[11px] text-white/60 font-medium">Subiendo video...</span>
                </div>
              ) : isUrlValid ? (
                <>
                  <video
                    src={`${msg.fileUrl}#t=0.001`}
                    preload="metadata"
                    className="w-full h-auto max-h-[200px] object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.poster = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L22 7v10"/><line x1="1" y1="1" x2="23" y2="23" stroke="%23ef4444"/></svg>';
                    }}
                  />
                  {!isSending && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg group-hover/vid:scale-110 transition-transform z-10">
                        <Play size={24} className="text-white fill-white ml-1" />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div
                  className="relative cursor-pointer overflow-hidden rounded-lg bg-red-900/40 border border-red-500/30 flex flex-col items-center justify-center min-h-[150px] min-w-[200px] p-4 text-center"
                  onClick={() => onVideoClick(msg.fileUrl || null)} // Permitir abrir modal para ver error detallado
                >
                  <AlertCircle size={32} className="text-red-400 mb-2" />
                  <span className="text-red-200 text-sm font-medium">Video corrupto o cifrado fallido</span>
                </div>
              )}
            </div>
            {msg.text && <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap px-0.5">{renderHighlightedText(msg.text)}</p>}
          </div>
        );
      case 'file':
        return (
          <div className={cn("flex items-center gap-3 p-1 bg-black/5 rounded-lg border border-black/5 min-w-[200px] relative")}>
            {sendingOverlay}
            <div className={cn("w-10 h-12 flex items-center justify-center rounded-lg shadow-sm bg-gray-400 text-white", msg.fileName?.endsWith('.pdf') && "bg-red-500", msg.fileName?.match(/\.(doc|docx)$/i) && "bg-blue-500", msg.fileName?.match(/\.(xls|xlsx)$/i) && "bg-green-600")}>
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-wa-text-primary truncate">{msg.fileName}</p>
              <p className="text-[11px] text-wa-text-secondary uppercase">{isSending ? 'Subiendo...' : 'Archivo'}</p>
            </div>
            {!isSending && <button onClick={(e) => { e.stopPropagation(); handleNativeDownload(msg.fileUrl, msg.fileName, msg.fileType); }} className="p-2 text-wa-text-secondary hover:text-wa-teal transition-colors cursor-pointer z-10 relative"><Download size={20} /></button>}
          </div>
        );
      case 'audio':
        return (
          <div className={cn("relative min-w-[250px] bg-black/5 rounded-xl p-2 border border-black/5")}>
            {sendingOverlay}
            {isSending ? (
              <div className="flex items-center gap-4 py-2 px-3">
                <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center animate-pulse">
                  <Mic size={20} className="text-indigo-500" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-1.5 w-full bg-indigo-500/10 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-1/3 animate-[loading_1.5s_infinite]" />
                  </div>
                  <p className="text-[10px] text-wa-text-secondary font-bold uppercase tracking-tighter">Enviando audio...</p>
                </div>
              </div>
            ) : (
              <AudioPlayer msg={msg} />
            )}
            <style>{`
              @keyframes loading {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(300%); }
              }
            `}</style>
          </div>
        );
      case 'system':
        return (
          <div className="flex items-center justify-center py-0.5">
            <span className="text-[13px] font-medium opacity-90">{msg.text}</span>
          </div>
        );
      default:
        return <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap px-0.5">{msg.text ? renderHighlightedText(msg.text) : ''}</p>;
    }
  };

  return (
    <div className={cn("flex w-full mb-1 group relative", msg.type === 'system' ? "justify-center my-3" : (isMe ? "justify-end" : "justify-start"))} onMouseEnter={() => setShowActions(true)} onMouseLeave={() => { setShowActions(false); setShowReactions(false); setShowDeleteMenu(false); }}>
      <motion.div 
        drag={msg.type !== 'system' && !msg.isDeleted ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(e, info) => {
          if (Math.abs(info.offset.x) > 60) {
            onReply();
          }
        }}
        whileDrag={{ scale: 0.98, cursor: 'grabbing' }}
        className={cn(
          msg.type === 'system' 
            ? "bg-wa-sidebar/95 px-4 py-1.5 rounded-xl border border-wa-border/50 text-wa-text-secondary shadow-sm mx-auto max-w-[90%]" 
            : cn("relative max-w-[85%] md:max-w-[65%] px-2.5 py-1.5 rounded-xl shadow-sm min-w-[80px] cursor-grab active:cursor-grabbing", isMe ? "bg-[#d9fdd3] text-[#111b21] rounded-tr-none" : "bg-white text-[#111b21] rounded-tl-none", !showTail && (isMe ? "rounded-tr-xl" : "rounded-tl-xl"), msg.isDeleted && "bg-transparent border border-wa-border shadow-none text-wa-text-secondary")
        )}>
        {msg.type !== 'system' && !msg.isDeleted && <AnimatePresence>{showActions && ( <motion.div key="msg-actions" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className={cn("absolute top-0 z-20 flex gap-1", isMe ? "right-full mr-2" : "left-full ml-2")}> <button onClick={() => setShowReactions(!showReactions)} className="p-1.5 bg-white/90 rounded-full shadow-md text-wa-text-secondary hover:text-wa-teal transition-colors"><Smile size={16} /></button> <button onClick={onReply} className="p-1.5 bg-white/90 rounded-full shadow-md text-wa-text-secondary hover:text-wa-teal transition-colors"><Reply size={16} /></button> <div className="relative"><button onClick={() => setShowDeleteMenu(!showDeleteMenu)} className="p-1.5 bg-white/90 rounded-full shadow-md text-wa-text-secondary hover:text-red-500 transition-colors"><Trash2 size={16} /></button>{showDeleteMenu && (<div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-xl border border-wa-border overflow-hidden z-50 w-40 flex flex-col"><button onClick={() => { onDelete(false); setShowDeleteMenu(false); }} className="px-4 py-2 text-left text-[13px] hover:bg-wa-bg w-full">Eliminar para mí</button>{isMe && <button onClick={() => { onDelete(true); setShowDeleteMenu(false); }} className="px-4 py-2 text-left text-[13px] hover:bg-wa-bg w-full text-red-500">Eliminar para todos</button>}</div>)}</div> </motion.div> )}</AnimatePresence>}
        {msg.type !== 'system' && <AnimatePresence>{showReactions && ( <motion.div key="msg-reactions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={cn("absolute bottom-full mb-2 bg-white rounded-full shadow-xl p-1 flex gap-1 z-30 border border-wa-border", isMe ? "right-0" : "left-0")}> {REACTIONS.map(emoji => <button key={emoji} onClick={() => { onReact(emoji); setShowReactions(false); }} className="hover:scale-125 transition-transform p-1 text-xl">{emoji}</button>)} </motion.div> )}</AnimatePresence>}
        {isGroup && !isMe && senderName && msg.type !== 'system' && showTail && (
          <div className="text-[12.5px] font-bold mb-0.5" style={{ color: stringToColor(senderName) }}>
            {senderName}
          </div>
        )}
        {repliedMsg && ( <div className="mb-2 bg-black/5 rounded-lg border-l-4 border-wa-teal p-1.5 px-2 overflow-hidden"> <div className="text-[12px] font-bold text-wa-teal truncate">{repliedMsg.senderId === msg.senderId ? 'Tú' : 'Contacto'}</div> <div className="text-[13px] text-wa-text-secondary truncate italic"> {repliedMsg.type === 'image' ? '📷 Imagen' : repliedMsg.type === 'video' ? '🎥 Video' : repliedMsg.type === 'audio' ? '🎤 Nota de voz' : repliedMsg.type === 'file' ? `📄 ${repliedMsg.fileName}` : repliedMsg.text} </div> </div> )}
        {renderContent()}
        {msg.type !== 'system' && (
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[11px] text-wa-text-secondary uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {isMe && <div className={cn("flex items-center transition-colors", msg.status === 'read' ? "text-[#53bdeb]" : "text-wa-text-secondary")}>
              {msg.status === 'failed' ? (
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-red-500 cursor-pointer" />
                  <span onClick={onDeleteLocal} className="text-[10px] text-red-500 underline cursor-pointer hover:font-bold">Eliminar</span>
                </div>
              ) : msg.status === 'pending' ? <Clock size={12} className="opacity-70 text-orange-500" /> :
               msg.status === 'sending' ? <Clock size={12} className="opacity-70" /> : 
               msg.status === 'sent' ? <Check size={16} /> : 
               <CheckAll size={16} />}
            </div>}
          </div>
        )}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className={cn(
            "absolute -bottom-3 flex flex-wrap gap-1 z-10",
            isMe ? "right-2 flex-row-reverse" : "left-2"
          )}>
            {Object.entries(msg.reactions).map(([emoji, users]: any) => (
              <motion.div 
                key={emoji}
                initial={{ scale: 0, y: 5 }}
                animate={{ scale: 1, y: 0 }}
                className="flex items-center gap-1 bg-white rounded-full shadow-sm border border-wa-border p-0.5 px-2 hover:bg-wa-bg transition-colors cursor-default"
              >
                <span className="text-[12px]">{emoji}</span>
                {users.length > 1 && (
                  <span className="text-[10px] text-wa-text-secondary font-bold border-l border-wa-border pl-1 ml-0.5">
                    {users.length}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

async function handleNativeDownload(url: string, fileName: string, mimeType?: string) {
  if (!Capacitor.isNativePlatform()) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    return;
  }

  try {
    // alert("Iniciando descarga: " + fileName);
    let base64Data = url;
    if (url.startsWith('data:')) {
      base64Data = url.split(',')[1];
      base64Data = base64Data.replace(/[^a-zA-Z0-9+/=]/g, ''); // Limpiar caracteres no válidos
    } else if (url.startsWith('http')) {
      // alert("Descargando desde URL externa...");
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      base64Data = await new Promise((resolve) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(blob);
      });
      base64Data = base64Data.replace(/[^a-zA-Z0-9+/=]/g, '');
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

    const savedFile = await Filesystem.writeFile({
      path: safeFileName,
      data: base64Data as string,
      directory: Directory.Cache,
    });
    // alert("Archivo guardado en caché temporal: " + savedFile.uri);

    try {
      await FileOpener.openFile({
        path: savedFile.uri,
        mimeType: mimeType
      });
    } catch (openerError: any) {
      console.warn('FileOpener falló, intentando con Share:', openerError);
      try {
        await Share.share({
          title: safeFileName,
          url: savedFile.uri,
          dialogTitle: 'Abrir archivo'
        });
      } catch (shareError) {
        alert(`Tu dispositivo no tiene ninguna aplicación instalada capaz de abrir el archivo ${safeFileName} (Ej: instala Excel o un visor de PDF).`);
      }
    }

  } catch (error: any) {
    console.error('Error downloading file:', error);
    alert('Error en descarga: ' + error.message);
  }
};

const CheckAll = ({ size }: { size: number }) => (
  <svg viewBox="0 0 16 15" width={size} height={size} fill="currentColor">
    <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-3.51-3.665a.365.365 0 0 0-.525-.01l-.463.43a.365.365 0 0 0-.006.52l4.28 4.471a.485.485 0 0 0 .7.014l5.424-7.854a.365.365 0 0 0-.062-.512zm-4.71 0l-.478-.372a.365.365 0 0 0-.51.063L4.966 9.879a.32.32 0 0 1-.484.033L1.5 6.247a.365.365 0 0 0-.525-.01l-.463.43a.365.365 0 0 0-.006.52l4.28 4.471a.485.485 0 0 0 .7.014l5.424-7.854a.365.365 0 0 0-.062-.512z" />
  </svg>
);

const AudioPlayer = ({ msg }: { msg: any }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(msg.duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const { chats, currentUser } = useChatStore();

  const isMe = msg.senderId === currentUser?.id;
  const chat = chats.find(c => c.id === msg.conversationId);
  const avatar = isMe ? currentUser?.avatar : chat?.avatar || 'https://i.pravatar.cc/150?u=voice';

  useEffect(() => {
    if (waveformRef.current) {
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: isMe ? '#a7f3d0' : '#c7d2fe', // light emerald vs light indigo
        progressColor: isMe ? '#047857' : '#4f46e5', // dark emerald vs dark indigo
        barWidth: 2,
        barGap: 2,
        height: 30,
        url: msg.fileUrl
      });

      wavesurfer.current.on('play', () => setIsPlaying(true));
      wavesurfer.current.on('pause', () => setIsPlaying(false));
      wavesurfer.current.on('finish', () => setIsPlaying(false));
      wavesurfer.current.on('timeupdate', (time) => setCurrentTime(time));
      wavesurfer.current.on('ready', (dur) => setDuration(dur));

      return () => {
        wavesurfer.current?.destroy();
      };
    }
  }, [msg.fileUrl, isMe]);

  const togglePlay = () => wavesurfer.current?.playPause();

  const toggleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    wavesurfer.current?.setPlaybackRate(nextRate);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const themeColor = isMe ? "bg-emerald-600" : "bg-[#6366f1]";

  return (
    <div className="flex items-center gap-3.5 min-w-[280px] py-1.5 px-1 select-none">
      <div className="relative shrink-0">
        <img src={avatar} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" alt="Avatar" draggable={false} />
        <div className={cn("absolute -bottom-1 -right-1 rounded-full p-1 shadow-md text-white border border-white", themeColor)}>
          <Mic size={12} />
        </div>
      </div>
      
      <button 
        onClick={togglePlay} 
        className={cn(
          "shrink-0 w-[42px] h-[42px] flex items-center justify-center rounded-full transition-transform active:scale-95 text-white shadow-md hover:shadow-lg",
          themeColor
        )}
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1 mt-0.5 min-w-[120px]">
        {/* Waveform Container */}
        <div ref={waveformRef} className="w-full h-[30px] cursor-pointer" />
        
        <div className="flex justify-between items-center px-0.5">
          <span className="text-[11px] font-semibold text-black/50 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button 
            onClick={toggleSpeed}
            className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm hover:scale-105 transition-transform", themeColor)}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

const ImageModal = ({ url, onClose }: { url: string; onClose: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 md:p-10"
      onClick={onClose}
    >
      <div className="absolute top-6 right-6 flex gap-4 z-[210]">
        <button 
          onClick={(e) => { e.stopPropagation(); handleNativeDownload(url, 'imagen.jpg', 'image/jpeg'); }}
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md"
          title="Descargar"
        >
          <Download size={24} />
        </button>
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md"
          title="Cerrar"
        >
          <X size={24} />
        </button>
      </div>

      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative max-w-full max-h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={url} 
          alt="Preview" 
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
        />
      </motion.div>
      
      <p className="mt-6 text-white/60 text-sm font-medium tracking-wide">Haz clic fuera para cerrar</p>
    </motion.div>
  );
};

const VideoModal = ({ url, onClose }: { url: string; onClose: () => void }) => {
  const [hasError, setHasError] = useState(false);
  const isValidUrl = url && url.startsWith('data:');
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-10"
      onClick={onClose}
    >
      <div className="absolute top-6 right-6 flex gap-4 z-[210]">
        <button 
          onClick={(e) => { e.stopPropagation(); if (isValidUrl) handleNativeDownload(url, 'video.mp4', 'video/mp4'); else e.preventDefault(); }}
          className={cn("p-3 rounded-full transition-all backdrop-blur-md text-white", isValidUrl ? "bg-white/10 hover:bg-white/20" : "bg-white/5 opacity-50 cursor-not-allowed")}
          title={isValidUrl ? "Descargar Video" : "No disponible"}
        >
          <Download size={24} />
        </button>
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md"
          title="Cerrar"
        >
          <X size={24} />
        </button>
      </div>

      <motion.div 
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="relative w-full max-w-4xl max-h-[80vh] flex items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {isValidUrl && !hasError ? (
          <video 
            src={url} 
            controls 
            autoPlay 
            onError={() => setHasError(true)}
            className="w-full h-full max-h-[80vh] outline-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle size={40} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white">Video no disponible</h3>
            <p className="text-white/60 max-w-md">
              {!isValidUrl 
                ? "El enlace del video está corrupto o no se pudo descifrar correctamente. Pídele al usuario que lo reenvíe."
                : "El navegador no soporta este formato de video (ej. formato MKV o AVI). Por favor, usa formatos estándar como MP4."}
            </p>
          </div>
        )}
      </motion.div>
      
      <p className="mt-6 text-white/60 text-sm font-medium tracking-wide">Haz clic fuera para cerrar</p>
    </motion.div>
  );
};
