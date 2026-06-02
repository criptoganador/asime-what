import React, { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
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
import logo from '../assets/logo.png';
import { Theme } from 'emoji-picker-react';

const EmojiPicker = lazy(() => import('emoji-picker-react'));
const CallView = lazy(() => import('./CallView').then(m => ({ default: m.CallView })));

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
    markMessagesRead, setViewingGroup, chatWallpaper, typingUsers, sendTypingStatus,
    addReaction, replyingTo, setReplyingTo,
    hasMoreMessages, loadMoreMessages, deleteMessage,
    activeCall, incomingCall, outgoingCall, callUser, answerCall, endCall, leaveCall
  } = useChatStore();
  
  const activeChat = Array.isArray(chats) ? chats.find(c => c.id === activeChatId) : null;
  const [inputText, setInputText] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
    
    // Solo auto-scrollear al fondo si entramos a un chat nuevo, 
    // es la primera carga, o llegó un (1) mensaje nuevo al final
    if (isChatChanged || isNewMessageAtBottom || isFirstLoad) {
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
    }, 3000);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [inputText, activeChatId]);

  const handleSend = () => {
    if (inputText.trim() && activeChatId) {
      sendMessage(activeChatId, inputText, 'text', undefined, replyingTo?.id);
      setInputText('');
      sendTypingStatus(activeChatId, false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'media' | 'file' | 'audio') => {
    const file = e.target.files?.[0];
    if (file && activeChatId) {
      setIsUploading(true);
      setShowPlusMenu(false);
      try {
        if (type === 'media') {
          if (file.type.startsWith('video/')) {
            const videoUrl = await uploadVideo(file);
            sendMessage(activeChatId, undefined, 'video', undefined, replyingTo?.id, {
              url: videoUrl,
              fileName: file.name,
              fileType: file.type
            });
          } else {
            const imageUrl = await uploadImage(file);
            sendMessage(activeChatId, undefined, 'image', imageUrl, replyingTo?.id);
          }
        } else if (type === 'audio') {
          const audioUrl = await uploadAudio(file);
          const duration = await getAudioDuration(file);
          sendMessage(activeChatId, undefined, 'audio', undefined, replyingTo?.id, {
            url: audioUrl,
            fileName: file.name,
            fileType: file.type,
            duration: duration
          });
        } else {
          const fileUrl = await uploadFile(file);
          sendMessage(activeChatId, undefined, 'file', undefined, replyingTo?.id, {
            url: fileUrl,
            fileName: file.name,
            fileType: file.type
          });
        }
      } catch (error: any) {
        alert(error.message || 'Error al subir el archivo');
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = ''; // Reset input
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new (window as any).MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e: any) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice_note.webm', { type: 'audio/webm' });
        
        setIsUploading(true);
        try {
          const audioUrl = await uploadAudio(audioFile);
          const duration = await getAudioDuration(audioFile);
          sendMessage(activeChatId!, undefined, 'audio', undefined, replyingTo?.id, {
            url: audioUrl,
            fileName: 'Nota de voz',
            fileType: 'audio/webm',
            duration: duration
          });
        } catch (error) {
          alert('Error al enviar la nota de voz');
        } finally {
          setIsUploading(false);
          setRecordingTime(0);
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

  return (
    <div className="flex-1 flex overflow-hidden">
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          {activeCall && (
            <CallView 
              roomName={activeCall.chatId} 
              participantName={currentUser?.name || 'Usuario'} 
              chatName={activeChat.name}
              chatAvatar={activeChat.avatar}
              video={activeCall.type === 'video'} 
              onClose={() => leaveCall()} 
              onCallEmpty={() => endCall(activeCall.chatId)}
            />
          )}
        </Suspense>
      </ErrorBoundary>
      
      <div 
        className="flex-1 flex flex-col relative border-r border-wa-border overflow-hidden transition-colors duration-500"
        style={{ backgroundColor: getWallpaperColor(chatWallpaper) }}
      >
        {/* Marca de Agua / Pattern de Fondo en el chat */}
        <div className="absolute inset-0 z-0 pointer-events-none mt-[60px] mb-[62px] overflow-hidden flex items-center justify-center">
          <div 
            className="absolute inset-0 opacity-[0.05] bg-repeat"
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
              <p className={cn("text-[13px] transition-colors", isOtherTyping ? "text-wa-teal font-medium" : "text-wa-text-secondary")}>
                {isOtherTyping ? 'escribiendo...' : activeChat.isOnline ? 'en línea' : formatLastSeen(activeChat.lastSeen)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Branding: Logo y Título con Efecto Glow y Glassmorphism Avanzado */}
            <div className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-gradient-to-r from-[#6366f1]/10 to-purple-500/10 backdrop-blur-xl rounded-full border border-[#6366f1]/20 shadow-[0_4px_15px_rgba(0,123,252,0.1)] hover:shadow-[0_4px_25px_rgba(0,123,252,0.25)] hover:border-[#6366f1]/40 hover:scale-[1.02] transition-all duration-300 cursor-default group">
              <div className="relative">
                <img src={logo} alt="Asicme Chat" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(0,123,252,0.5)] group-hover:drop-shadow-[0_0_12px_rgba(0,123,252,0.8)] transition-all duration-300" />
                <div className="absolute inset-0 bg-blue-500/20 blur-[10px] rounded-full -z-10 animate-pulse"></div>
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

        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 sm:p-4 sm:px-8 md:px-12 lg:px-16 space-y-2 relative z-1"
        >
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <div className="w-6 h-6 border-2 border-wa-teal border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {filteredMessages.map((msg, index) => {
            const isMe = msg.senderId === currentUser?.id;
            const showTail = index === 0 || filteredMessages[index - 1].senderId !== msg.senderId;
            const repliedMsg = msg.replyToId ? currentMessages.find(m => m.id === msg.replyToId) : null;
            return (
              <MessageBubble 
                key={msg.id} 
                msg={msg} 
                isMe={isMe} 
                showTail={showTail} 
                repliedMsg={repliedMsg} 
                onReply={() => setReplyingTo(msg)} 
                onReact={(emoji: string) => addReaction(activeChatId, msg.id, emoji)} 
                onDelete={(forEveryone: boolean) => deleteMessage(activeChatId, msg.id, forEveryone)}
                onImageClick={setSelectedImage}
                onVideoClick={setSelectedVideo}
                searchQuery={searchQuery}
              />
            );
          })}
          <div ref={messagesEndRef} />
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
                          width={Math.min(350, window.innerWidth - 32)}
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
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, 'media')} />
                <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={(e) => handleFileUpload(e, 'file')} />
                <input type="file" ref={audioInputRef} className="hidden" accept="audio/*" onChange={(e) => handleFileUpload(e, 'audio')} />
              </div>
            </div>
            {isRecording ? (
              <div className="flex-1 bg-wa-bg rounded-xl px-4 py-2 flex items-center gap-3 animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                <span className="text-wa-text-primary font-medium flex-1">{formatTime(recordingTime)}</span>
                <button onClick={stopRecording} className="text-red-500 hover:scale-110 transition-transform"><StopCircle size={28} /></button>
              </div>
            ) : (
              <div className="flex-1 bg-white rounded-xl px-4 py-2 shadow-sm">
                <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Escribe un mensaje" className="w-full bg-transparent outline-none text-[15px]" />
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
        {selectedImage && <ImageModal url={selectedImage} onClose={() => setSelectedImage(null)} />}
        {selectedVideo && <VideoModal url={selectedVideo} onClose={() => setSelectedVideo(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 min-w-[300px] flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 relative">
              <img src={incomingCall.callerAvatar} className="w-full h-full rounded-full object-cover shadow-md border-2 border-[#6366f1]/20" alt="Llamada entrante" />
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
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] bg-white/90 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border border-white/40 flex flex-col items-center gap-4 w-[320px]"
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
              onClick={() => leaveCall()}
              className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 transition-all mt-2"
            >
              <PhoneOff size={18} /> Colgar
            </button>
          </motion.div>
        )}
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

const MessageBubble = ({ msg, isMe, showTail, repliedMsg, onReply, onReact, onDelete, onImageClick, onVideoClick, searchQuery }: any) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const renderHighlightedText = (text: string) => {
    if (!searchQuery || !text) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === searchQuery.toLowerCase() 
            ? <span key={i} className="bg-yellow-400 text-black px-0.5 rounded">{part}</span> 
            : part
        )}
      </>
    );
  };

  const renderContent = () => {
    if (msg.isDeleted) {
      return <div className="flex items-center gap-2 text-wa-text-secondary italic opacity-80"><Ban size={16} /> <span className="text-[14.5px]">Este mensaje fue eliminado</span></div>;
    }
    switch (msg.type) {
      case 'image':
        return (
          <div className="space-y-1">
            <div 
              className="relative group/img cursor-pointer overflow-hidden rounded-lg"
              onClick={() => onImageClick(msg.imageUrl || null)}
            >
              <img src={msg.imageUrl} alt="Sent" className="max-w-full hover:scale-[1.02] transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center">
                <Search size={24} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
              </div>
            </div>
            {msg.text && <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap px-0.5">{msg.text}</p>}
          </div>
        );
      case 'video':
        const isUrlValid = msg.fileUrl && msg.fileUrl.startsWith('data:');
        return (
          <div className="space-y-1">
            {isUrlValid ? (
              <div 
                className="relative group/vid cursor-pointer overflow-hidden rounded-lg bg-black/80 flex items-center justify-center min-h-[150px] min-w-[200px]"
                onClick={() => onVideoClick(msg.fileUrl || null)}
              >
                <video src={msg.fileUrl} className="w-full h-auto max-h-[200px] object-cover opacity-50" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg group-hover/vid:scale-110 transition-transform z-10">
                    <Play size={24} className="text-white fill-white ml-1" />
                  </div>
                </div>
              </div>
            ) : (
              <div 
                className="relative cursor-pointer overflow-hidden rounded-lg bg-red-900/40 border border-red-500/30 flex flex-col items-center justify-center min-h-[150px] min-w-[200px] p-4 text-center"
                onClick={() => onVideoClick(msg.fileUrl || null)} // Permitir abrir modal para ver error detallado
              >
                <AlertCircle size={32} className="text-red-400 mb-2" />
                <span className="text-red-200 text-sm font-medium">Video corrupto o cifrado fallido</span>
              </div>
            )}
            {msg.text && <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap px-0.5">{renderHighlightedText(msg.text)}</p>}
          </div>
        );
      case 'file':
        return (
          <div className="flex items-center gap-3 p-1 bg-black/5 rounded-lg border border-black/5 min-w-[200px]">
            <div className={cn("w-10 h-12 flex items-center justify-center rounded-lg shadow-sm bg-gray-400 text-white", msg.fileName?.endsWith('.pdf') && "bg-red-500", msg.fileName?.match(/\.(doc|docx)$/i) && "bg-blue-500", msg.fileName?.match(/\.(xls|xlsx)$/i) && "bg-green-600")}>
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-wa-text-primary truncate">{msg.fileName}</p>
              <p className="text-[11px] text-wa-text-secondary uppercase">Archivo</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleNativeDownload(msg.fileUrl, msg.fileName); }} className="p-2 text-wa-text-secondary hover:text-wa-teal transition-colors cursor-pointer"><Download size={20} /></button>
          </div>
        );
      case 'audio':
        return <AudioPlayer msg={msg} />;
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
      <div className={cn(
        msg.type === 'system' 
          ? "bg-wa-sidebar/40 backdrop-blur-sm px-4 py-1.5 rounded-xl border border-wa-border/50 text-wa-text-secondary shadow-sm mx-auto max-w-[90%]" 
          : cn("relative max-w-[85%] md:max-w-[65%] px-2.5 py-1.5 rounded-xl shadow-sm min-w-[80px]", isMe ? "bg-[#d9fdd3] text-[#111b21] rounded-tr-none" : "bg-white text-[#111b21] rounded-tl-none", !showTail && (isMe ? "rounded-tr-xl" : "rounded-tl-xl"), msg.isDeleted && "bg-transparent border border-wa-border shadow-none text-wa-text-secondary")
      )}>
        {msg.type !== 'system' && !msg.isDeleted && <AnimatePresence>{showActions && ( <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className={cn("absolute top-0 z-20 flex gap-1", isMe ? "right-full mr-2" : "left-full ml-2")}> <button onClick={() => setShowReactions(!showReactions)} className="p-1.5 bg-white/90 rounded-full shadow-md text-wa-text-secondary hover:text-wa-teal transition-colors"><Smile size={16} /></button> <button onClick={onReply} className="p-1.5 bg-white/90 rounded-full shadow-md text-wa-text-secondary hover:text-wa-teal transition-colors"><Reply size={16} /></button> <div className="relative"><button onClick={() => setShowDeleteMenu(!showDeleteMenu)} className="p-1.5 bg-white/90 rounded-full shadow-md text-wa-text-secondary hover:text-red-500 transition-colors"><Trash2 size={16} /></button>{showDeleteMenu && (<div className="absolute top-full mt-1 right-0 bg-white rounded-lg shadow-xl border border-wa-border overflow-hidden z-50 w-40 flex flex-col"><button onClick={() => { onDelete(false); setShowDeleteMenu(false); }} className="px-4 py-2 text-left text-[13px] hover:bg-wa-bg w-full">Eliminar para mí</button>{isMe && <button onClick={() => { onDelete(true); setShowDeleteMenu(false); }} className="px-4 py-2 text-left text-[13px] hover:bg-wa-bg w-full text-red-500">Eliminar para todos</button>}</div>)}</div> </motion.div> )}</AnimatePresence>}
        {msg.type !== 'system' && <AnimatePresence>{showReactions && ( <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={cn("absolute bottom-full mb-2 bg-white rounded-full shadow-xl p-1 flex gap-1 z-30 border border-wa-border", isMe ? "right-0" : "left-0")}> {REACTIONS.map(emoji => <button key={emoji} onClick={() => { onReact(emoji); setShowReactions(false); }} className="hover:scale-125 transition-transform p-1 text-xl">{emoji}</button>)} </motion.div> )}</AnimatePresence>}
        {repliedMsg && ( <div className="mb-2 bg-black/5 rounded-lg border-l-4 border-wa-teal p-1.5 px-2 overflow-hidden"> <div className="text-[12px] font-bold text-wa-teal truncate">{repliedMsg.senderId === msg.senderId ? 'Tú' : 'Contacto'}</div> <div className="text-[13px] text-wa-text-secondary truncate italic"> {repliedMsg.type === 'image' ? '📷 Imagen' : repliedMsg.type === 'video' ? '🎥 Video' : repliedMsg.type === 'audio' ? '🎤 Nota de voz' : repliedMsg.type === 'file' ? `📄 ${repliedMsg.fileName}` : repliedMsg.text} </div> </div> )}
        {renderContent()}
        {msg.type !== 'system' && (
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[11px] text-wa-text-secondary uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {isMe && <div className={cn("flex items-center transition-colors", msg.status === 'read' ? "text-[#53bdeb]" : "text-wa-text-secondary")}>
              {msg.status === 'sending' ? <Clock size={12} className="opacity-70" /> : 
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
      </div>
    </div>
  );
};

async function handleNativeDownload(url: string, fileName: string) {
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
      // alert("Base64 procesado correctamente (longitud: " + base64Data.length + ")");
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
      // alert("URL externa convertida a Base64.");
    }

    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data as string,
      directory: Directory.Cache,
    });
    // alert("Archivo guardado en caché temporal: " + savedFile.uri);

    try {
      await Share.share({
        title: fileName,
        url: savedFile.uri,
        dialogTitle: 'Abrir o guardar archivo'
      });
    } catch (shareError: any) {
      console.warn('Share.share falló:', shareError);
      alert(`El archivo se descargó, pero tu dispositivo no tiene ninguna aplicación instalada capaz de abrir archivos tipo ${fileName} (Ej: no tienes Excel o visor de PDF).`);
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const { chats, currentUser } = useChatStore();

  const isMe = msg.senderId === currentUser?.id;
  const chat = chats.find(c => c.id === msg.conversationId);
  const avatar = isMe ? currentUser?.avatar : chat?.avatar || 'https://i.pravatar.cc/150?u=voice';

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (progressRef.current && audioRef.current && duration) {
      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = percent * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const themeColor = isMe ? "bg-emerald-600" : "bg-[#6366f1]";

  return (
    <div className="flex items-center gap-3.5 min-w-[260px] py-1.5 px-1 select-none">
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

      <div className="flex-1 flex flex-col justify-center gap-1.5 mt-0.5">
        <div 
          ref={progressRef}
          onClick={handleSeek}
          className="h-2 bg-black/10 rounded-full relative cursor-pointer group flex items-center"
        >
          {/* Active Track */}
          <div 
            className={cn("absolute h-full transition-all duration-75 ease-linear rounded-full", themeColor)}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
          {/* Drag Knob */}
          <div 
            className={cn(
              "absolute w-3.5 h-3.5 rounded-full shadow-md transition-all duration-75 ease-linear transform -translate-x-1/2 scale-100",
              themeColor
            )}
            style={{ left: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center px-0.5">
          <span className="text-[11px] font-semibold text-black/50 tabular-nums">
            {formatTime(currentTime)}
          </span>
          <span className="text-[11px] font-semibold text-black/50 tabular-nums">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      <audio 
        ref={audioRef} 
        src={msg.fileUrl} 
        onLoadedMetadata={() => !msg.duration && setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setIsPlaying(false); setCurrentTime(0); }}
        className="hidden" 
      />
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
          onClick={(e) => { e.stopPropagation(); handleNativeDownload(url, 'imagen.jpg'); }}
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
          onClick={(e) => { e.stopPropagation(); if (isValidUrl) handleNativeDownload(url, 'video.mp4'); else e.preventDefault(); }}
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
