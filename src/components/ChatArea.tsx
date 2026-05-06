import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Send, Smile, ArrowLeft, Image as ImageIcon, 
  X, Reply, Plus, 
  FileText, File as FileIcon, Mic, StopCircle, Play, Pause, Download,
  Lock, Phone, Video
} from 'lucide-react';
import { useChatStore, Message } from '../features/sidebar/store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadImage, uploadFile } from '../utils/upload';
import { CallView } from './CallView';
import logo from '../assets/logo.png';

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
    addReaction, replyingTo, setReplyingTo
  } = useChatStore();
  
  const activeChat = Array.isArray(chats) ? chats.find(c => c.id === activeChatId) : null;
  const [inputText, setInputText] = useState('');
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [activeCall, setActiveCall] = useState<{ type: 'voice' | 'video' } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  const currentMessages = useMemo(() => (activeChatId ? messages[activeChatId] || [] : []), [activeChatId, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    if (activeChatId) {
      markMessagesRead(activeChatId);
    }
  }, [currentMessages, activeChatId]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (file && activeChatId) {
      setIsUploading(true);
      setShowPlusMenu(false);
      try {
        if (type === 'image') {
          const imageUrl = await uploadImage(file);
          sendMessage(activeChatId, undefined, 'image', imageUrl, replyingTo?.id);
        } else {
          const fileUrl = await uploadFile(file);
          sendMessage(activeChatId, undefined, 'file', undefined, replyingTo?.id, {
            url: fileUrl,
            name: file.name,
            type: file.type
          });
        }
      } catch (error) {
        alert('Error al subir el archivo');
      } finally {
        setIsUploading(false);
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
          const audioUrl = await uploadFile(audioFile);
          sendMessage(activeChatId!, undefined, 'audio', undefined, replyingTo?.id, {
            url: audioUrl,
            name: 'Nota de voz',
            type: 'audio/webm',
            duration: recordingTime
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
    } catch (err) {
      alert('Permiso de micrófono denegado');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!activeChatId || !activeChat) {
    return (
      <div className="flex-1 bg-wa-bg flex flex-col items-center justify-center p-8 text-center">
        <div className="w-64 h-64 mb-8 opacity-20">
          <img src="https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png" alt="Welcome" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-3xl font-light text-wa-text-primary mb-4">Asicme Web</h1>
        <p className="text-wa-text-secondary max-w-md leading-relaxed">
          Envía y recibe mensajes sin necesidad de mantener tu teléfono conectado.
        </p>
        <div className="mt-auto flex items-center gap-2 text-wa-text-secondary text-sm opacity-50">
          <Lock size={14} />
          Cifrado de extremo a extremo
        </div>
      </div>
    );
  }

  const isOtherTyping = typingUsers[activeChatId]?.length > 0;

  return (
    <div className="flex-1 flex overflow-hidden">
      {activeCall && (
        <CallView 
          roomName={activeChatId} 
          participantName={currentUser?.name || 'Usuario'} 
          chatName={activeChat.name}
          chatAvatar={activeChat.avatar}
          video={activeCall.type === 'video'} 
          onClose={() => setActiveCall(null)} 
        />
      )}
      
      <div 
        className="flex-1 flex flex-col relative border-r border-wa-border overflow-hidden transition-colors duration-500"
        style={{ backgroundColor: getWallpaperColor(chatWallpaper) }}
      >
        <div className="h-[60px] bg-wa-sidebar flex items-center justify-between px-4 py-2 shadow-sm z-10 border-b border-wa-border">
          <div className="flex items-center gap-3">
            <ArrowLeft className="md:hidden cursor-pointer" onClick={closeChat} />
            <div className="relative cursor-pointer" onClick={() => { if (activeChat.isGroup) { setViewingGroup(activeChat); setView('group-info'); } }}>
              <img src={activeChat.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
              {activeChat.isOnline && !activeChat.isGroup && <div className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green border-2 border-white rounded-full"></div>}
            </div>
            <div>
              <h3 className="font-medium text-wa-text-primary leading-tight">{activeChat.name}</h3>
              <p className={cn("text-[13px] transition-colors", isOtherTyping ? "text-wa-teal font-medium" : "text-wa-text-secondary")}>
                {isOtherTyping ? 'escribiendo...' : activeChat.isOnline ? 'en línea' : 'últ. vez hoy a las 14:30'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            {/* Branding: Logo y Título con Efecto Glow y Glassmorphism Avanzado */}
            <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 bg-gradient-to-r from-[#007bfc]/10 to-purple-500/10 backdrop-blur-xl rounded-full border border-[#007bfc]/20 shadow-[0_4px_15px_rgba(0,123,252,0.1)] hover:shadow-[0_4px_25px_rgba(0,123,252,0.25)] hover:border-[#007bfc]/40 hover:scale-[1.02] transition-all duration-300 cursor-default group">
              <div className="relative">
                <img src={logo} alt="Asicme" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(0,123,252,0.5)] group-hover:drop-shadow-[0_0_12px_rgba(0,123,252,0.8)] transition-all duration-300" />
                <div className="absolute inset-0 bg-blue-500/20 blur-[10px] rounded-full -z-10 animate-pulse"></div>
              </div>
              <span className="text-[14px] font-semibold bg-gradient-to-r from-wa-text-primary to-[#007bfc] bg-clip-text text-transparent tracking-wider uppercase text-xs">ASICME CHAT</span>
            </div>
            {/* Botones de Llamada */}
            <div className="flex items-center gap-6 text-wa-text-secondary mr-2">
              <Video size={20} className="cursor-pointer hover:text-wa-teal transition-colors" onClick={() => setActiveCall({ type: 'video' })} />
              <Phone size={19} className="cursor-pointer hover:text-wa-teal transition-colors" onClick={() => setActiveCall({ type: 'voice' })} />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:px-16 space-y-2 relative z-1">
          {currentMessages.map((msg, index) => {
            const isMe = msg.senderId === currentUser?.id;
            const showTail = index === 0 || currentMessages[index - 1].senderId !== msg.senderId;
            const repliedMsg = msg.replyToId ? currentMessages.find(m => m.id === msg.replyToId) : null;
            return <MessageBubble key={msg.id} msg={msg} isMe={isMe} showTail={showTail} repliedMsg={repliedMsg} onReply={() => setReplyingTo(msg)} onReact={(emoji: string) => addReaction(activeChatId, msg.id, emoji)} />;
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-wa-sidebar min-h-[62px] flex flex-col z-20">
          <AnimatePresence>
            {replyingTo && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-wa-bg mx-2 mt-2 rounded-lg border-l-4 border-wa-teal overflow-hidden flex">
                <div className="flex-1 p-2 px-3">
                  <div className="text-[13px] font-bold text-wa-teal mb-0.5">{replyingTo.senderId === currentUser?.id ? 'Tú' : activeChat.name}</div>
                  <div className="text-[14px] text-wa-text-secondary truncate">{replyingTo.type === 'image' ? '📷 Imagen' : replyingTo.type === 'audio' ? '🎤 Nota de voz' : replyingTo.text}</div>
                </div>
                <button onClick={() => setReplyingTo(null)} className="p-2 text-wa-text-secondary hover:text-wa-text-primary"><X size={18} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 px-4 py-3 relative">
            <div className="flex gap-3 text-wa-text-secondary items-center">
              <Smile size={24} className="cursor-pointer hover:text-wa-teal transition-colors" />
              <div className="relative">
                <Plus size={24} className={cn("cursor-pointer transition-transform duration-300", showPlusMenu && "rotate-45 text-wa-teal")} onClick={() => setShowPlusMenu(!showPlusMenu)} />
                <AnimatePresence>
                  {showPlusMenu && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }} className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-xl py-3 w-52 z-50 border border-wa-border overflow-hidden">
                      <PlusMenuItem icon={<FileText className="text-purple-500" />} label="Documento" onClick={() => docInputRef.current?.click()} />
                      <PlusMenuItem icon={<ImageIcon className="text-[#007bfc]" />} label="Fotos y videos" onClick={() => fileInputRef.current?.click()} />
                    </motion.div>
                  )}
                </AnimatePresence>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, 'image')} />
                <input type="file" ref={docInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'file')} />
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
    </div>
  );
};

const PlusMenuItem = ({ icon, label, onClick }: any) => (
  <div onClick={onClick} className="flex items-center gap-4 px-6 py-3 hover:bg-wa-bg cursor-pointer transition-colors group">
    <div className="group-hover:scale-110 transition-transform">{icon}</div>
    <span className="text-[14.5px] text-wa-text-primary font-medium">{label}</span>
  </div>
);

const MessageBubble = ({ msg, isMe, showTail, repliedMsg, onReply, onReact }: any) => {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const renderContent = () => {
    switch (msg.type) {
      case 'image':
        return <div className="space-y-1"><img src={msg.imageUrl} alt="Sent" className="max-w-full rounded-lg" />{msg.text && <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>}</div>;
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
            <a href={msg.fileUrl} download={msg.fileName} className="p-2 text-wa-text-secondary hover:text-wa-teal transition-colors"><Download size={20} /></a>
          </div>
        );
      case 'audio':
        return (
          <div className="flex items-center gap-3 min-w-[240px] py-1">
            <div className="relative"><img src="https://i.pravatar.cc/150?u=voice" className="w-12 h-12 rounded-full" alt="" /><div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm text-wa-teal"><Mic size={14} /></div></div>
            <button onClick={() => { if (audioRef.current && !isPlaying) audioRef.current.play(); else if (audioRef.current) audioRef.current.pause(); setIsPlaying(!isPlaying); }} className="text-wa-text-secondary hover:text-wa-text-primary transition-colors">{isPlaying ? <Pause size={28} /> : <Play size={28} />}</button>
            <div className="flex-1 h-1 bg-wa-text-secondary/20 rounded-full relative overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: isPlaying ? '100%' : '0%' }} transition={{ duration: msg.duration || 5, ease: "linear" }} className="absolute inset-0 bg-wa-teal" /></div>
            <span className="text-[12px] text-wa-text-secondary font-mono">{Math.floor((msg.duration || 0) / 60)}:{(msg.duration || 0 % 60).toString().padStart(2, '0')}</span>
            <audio ref={audioRef} src={msg.fileUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
          </div>
        );
      default:
        return <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>;
    }
  };

  return (
    <div className={cn("flex w-full mb-1 group relative", isMe ? "justify-end" : "justify-start")} onMouseEnter={() => setShowActions(true)} onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}>
      <div className={cn("relative max-w-[85%] md:max-w-[65%] px-2.5 py-1.5 rounded-xl shadow-sm min-w-[80px]", isMe ? "bg-[#d9fdd3] text-[#111b21] rounded-tr-none" : "bg-white text-[#111b21] rounded-tl-none", !showTail && (isMe ? "rounded-tr-xl" : "rounded-tl-xl"))}>
        <AnimatePresence>{showActions && ( <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className={cn("absolute top-0 z-20 flex gap-1", isMe ? "right-full mr-2" : "left-full ml-2")}> <button onClick={() => setShowReactions(!showReactions)} className="p-1.5 bg-white/90 rounded-full shadow-md text-wa-text-secondary hover:text-wa-teal transition-colors"><Smile size={16} /></button> <button onClick={onReply} className="p-1.5 bg-white/90 rounded-full shadow-md text-wa-text-secondary hover:text-wa-teal transition-colors"><Reply size={16} /></button> </motion.div> )}</AnimatePresence>
        <AnimatePresence>{showReactions && ( <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={cn("absolute bottom-full mb-2 bg-white rounded-full shadow-xl p-1 flex gap-1 z-30 border border-wa-border", isMe ? "right-0" : "left-0")}> {REACTIONS.map(emoji => <button key={emoji} onClick={() => { onReact(emoji); setShowReactions(false); }} className="hover:scale-125 transition-transform p-1 text-xl">{emoji}</button>)} </motion.div> )}</AnimatePresence>
        {repliedMsg && ( <div className="mb-2 bg-black/5 rounded-lg border-l-4 border-wa-teal p-1.5 px-2 overflow-hidden"> <div className="text-[12px] font-bold text-wa-teal truncate">{repliedMsg.senderId === msg.senderId ? 'Tú' : 'Contacto'}</div> <div className="text-[13px] text-wa-text-secondary truncate italic"> {repliedMsg.type === 'image' ? '📷 Imagen' : repliedMsg.type === 'audio' ? '🎤 Nota de voz' : repliedMsg.type === 'file' ? `📄 ${repliedMsg.fileName}` : repliedMsg.text} </div> </div> )}
        {renderContent()}
        <div className="flex items-center justify-end gap-1 mt-0.5"><span className="text-[11px] text-wa-text-secondary uppercase">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{isMe && <div className={cn("flex items-center transition-colors", msg.status === 'read' ? "text-[#53bdeb]" : "text-wa-text-secondary")}><CheckAll size={16} /></div>}</div>
        {msg.reactions && Object.keys(msg.reactions).length > 0 && ( <div className={cn("absolute -bottom-3 flex bg-white rounded-full shadow-sm border border-wa-border p-0.5 px-1.5 gap-0.5 z-10", isMe ? "right-2" : "left-2")}> {Object.entries(msg.reactions).map(([emoji, users]: any) => <span key={emoji} className="text-[12px] flex items-center gap-0.5">{emoji} {users.length > 1 && <span className="text-[10px] text-wa-text-secondary font-bold">{users.length}</span>}</span>)} </div> )}
      </div>
    </div>
  );
};

const CheckAll = ({ size }: { size: number }) => (
  <svg viewBox="0 0 16 15" width={size} height={size} fill="currentColor">
    <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-3.51-3.665a.365.365 0 0 0-.525-.01l-.463.43a.365.365 0 0 0-.006.52l4.28 4.471a.485.485 0 0 0 .7.014l5.424-7.854a.365.365 0 0 0-.062-.512zm-4.71 0l-.478-.372a.365.365 0 0 0-.51.063L4.966 9.879a.32.32 0 0 1-.484.033L1.5 6.247a.365.365 0 0 0-.525-.01l-.463.43a.365.365 0 0 0-.006.52l4.28 4.471a.485.485 0 0 0 .7.014l5.424-7.854a.365.365 0 0 0-.062-.512z" />
  </svg>
);
