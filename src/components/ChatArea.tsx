import { useChatStore, Message } from '../features/sidebar/store/useChatStore';
import { Phone, Video, Search, MoreVertical, Plus, Smile, Mic, Check, CheckCheck, X, ChevronDown, FileText, Image, Camera, User, BarChart2, Calendar, Sticker, ArrowLeft } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ChatArea = () => {
  const { activeChatId, chats, messages, addMessage, closeChat, setView } = useChatStore();
  const activeChat = chats.find(c => c.id === activeChatId);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar pickers y menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) setShowEmojiPicker(false);
      if (chatMenuRef.current && !chatMenuRef.current.contains(event.target as Node)) setShowChatMenu(false);
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) setShowAttachMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
  };

  const currentMessages = useMemo(() => {
    if (!activeChatId) return [];
    const chatMessages = messages[activeChatId] || [];
    if (chatMessages.length === 0 && activeChatId) {
      return [
        { id: '1', text: '¡Hola! ¿Cómo vas con el proyecto?', sender: 'other', timestamp: '12:40 PM', status: 'read' },
        { id: '2', text: 'Todo va excelente, acabo de terminar la virtualización del sidebar.', sender: 'me', timestamp: '12:41 PM', status: 'read' },
      ] as Message[];
    }
    return chatMessages;
  }, [activeChatId, messages]);

  const displayMessages = useMemo(() => {
    if (!messageSearchQuery.trim()) return currentMessages;
    return currentMessages.filter(msg => msg.text.toLowerCase().includes(messageSearchQuery.toLowerCase()));
  }, [currentMessages, messageSearchQuery]);

  useEffect(() => {
    if (scrollRef.current && !showSearch) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages, showSearch]);

  const handleSendMessage = () => {
    if (!inputText.trim() || !activeChatId) return;
    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'me',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent'
    };
    addMessage(activeChatId, newMessage);
    setInputText('');
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  if (!activeChat) {
    return (
      <div className="flex-1 bg-wa-bg flex flex-col items-center justify-center text-center p-8 border-b-4 border-wa-green animate-in fade-in duration-700">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-64 h-64 mb-8">
          <img src="https://static.whatsapp.net/rsrc.php/v3/y6/r/wa669ae5z2_.png" alt="WhatsApp Web" className="w-full h-full object-contain opacity-50" />
        </motion.div>
        <h1 className="text-3xl font-light text-wa-text-primary mb-4">WhatsApp Web</h1>
        <p className="text-wa-text-secondary text-[14px] max-w-md">Envía y recibe mensajes sin necesidad de tener tu teléfono conectado.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col bg-wa-chat-bg relative border-r border-wa-border">
        {/* Background Overlay */}
        <div className="absolute inset-0 opacity-[0.4] pointer-events-none z-0" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', filter: 'invert(0.1)' }}></div>

        {/* Chat Header - Glass Effect */}
        <div className="h-[60px] glass flex items-center px-4 py-2 border-b border-wa-border justify-between z-20 shadow-sm relative">
          <div className="flex items-center cursor-pointer min-w-0" onClick={() => setView('profile')}>
            <ArrowLeft size={24} className="md:hidden mr-2 text-wa-text-secondary cursor-pointer hover:bg-wa-hover rounded-full p-0.5" onClick={(e) => { e.stopPropagation(); closeChat(); }} />
            <motion.img layoutId={`avatar-${activeChat.id}`} src={activeChat.avatar} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />
            <div className="ml-3 truncate">
              <h2 className="text-[16px] font-medium text-wa-text-primary leading-tight truncate">{activeChat.name}</h2>
              <p className="text-[13px] text-wa-text-secondary truncate">{activeChat.isOnline ? 'en línea' : 'visto por última vez hoy a las 12:00'}</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-wa-text-secondary">
            <div className="flex items-center gap-1 border border-wa-border rounded-full px-3 py-1.5 text-[13px] hover:bg-wa-hover cursor-pointer transition-colors bg-white/50">
              <Video size={18} />
              <ChevronDown size={14} />
            </div>
            <Phone size={20} className="cursor-pointer hover:text-wa-text-primary transition-colors" />
            <div className="h-6 w-[1px] bg-wa-border mx-1"></div>
            <Search size={20} className={cn("cursor-pointer hover:text-wa-text-primary transition-colors", showSearch && "text-wa-teal")} onClick={() => setShowSearch(!showSearch)} />
            
            <div ref={chatMenuRef} className="relative">
              <MoreVertical size={20} className={cn("cursor-pointer hover:text-wa-text-primary transition-colors", showChatMenu && "text-wa-teal")} onClick={() => setShowChatMenu(!showChatMenu)} />
              <AnimatePresence>
                {showChatMenu && (
                  <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} className="absolute right-0 top-10 w-[240px] bg-white/95 backdrop-blur-md shadow-2xl rounded-xl py-2 z-50 border border-wa-border origin-top-right">
                    <ul className="text-[14.5px] text-wa-text-primary">
                      <li className="px-6 py-2.5 hover:bg-wa-bg cursor-pointer transition-colors">Información del contacto</li>
                      <li className="px-6 py-2.5 hover:bg-wa-bg cursor-pointer transition-colors border-t border-wa-border text-red-500 hover:bg-red-50">Eliminar chat</li>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-[5%] py-6 flex flex-col gap-3 relative z-10 scrollbar-thin">
          <AnimatePresence initial={false}>
            {displayMessages.map((msg) => {
              const isMe = msg.sender === 'me';
              return (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn("flex flex-col max-w-[65%] relative group", isMe ? "self-end items-end" : "self-start items-start")}
                >
                  <div className={cn("px-3 py-1.5 rounded-lg shadow-sm text-[14.2px] relative", isMe ? "bg-wa-bubble-sent rounded-tr-none" : "bg-wa-bubble-received rounded-tl-none")}>
                    <div className={cn("absolute top-0 w-3 h-3", isMe ? "-right-2 bg-wa-bubble-sent [clip-path:polygon(0_0,0_100%,100%_0)]" : "-left-2 bg-wa-bubble-received [clip-path:polygon(100%_0,100%_100%,0_0)]")}></div>
                    <div className="flex flex-wrap items-end gap-2">
                      <span className="text-wa-text-primary break-words whitespace-pre-wrap">{msg.text}</span>
                      <div className="flex items-center gap-1 ml-auto pt-1">
                        <span className="text-[11px] text-wa-text-secondary uppercase">{msg.timestamp}</span>
                        {isMe && <span className={cn("text-wa-text-secondary", msg.status === 'read' && "text-[#53bdeb]")}>{msg.status === 'sent' ? <Check size={14} /> : <CheckCheck size={14} />}</span>}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Input Area - Glass Effect */}
        <div className="min-h-[62px] glass flex items-center px-4 py-2 gap-4 z-20 relative">
          <div className="flex gap-4 text-wa-text-secondary relative items-center">
            <div ref={emojiPickerRef}>
              <Smile size={26} onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={cn("cursor-pointer hover:text-wa-text-primary transition-colors", showEmojiPicker && "text-wa-teal")} />
              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-[60px] left-0 shadow-2xl z-50">
                    <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.LIGHT} width={350} height={450} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div ref={attachMenuRef} className="relative">
              <Plus size={26} onClick={() => setShowAttachMenu(!showAttachMenu)} className={cn("cursor-pointer hover:text-wa-text-primary transition-all duration-300", showAttachMenu ? "text-wa-teal rotate-[135deg]" : "rotate-0")} />
              <AnimatePresence>
                {showAttachMenu && (
                  <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }} className="absolute bottom-[60px] left-[-10px] w-[220px] bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl py-3 z-50 border border-wa-border origin-bottom-left">
                    <div className="flex flex-col gap-1">
                      <AttachItem icon={<FileText size={20} />} label="Documento" color="bg-[#7f66ff]" />
                      <AttachItem icon={<Image size={20} />} label="Fotos y videos" color="bg-[#007bfc]" />
                      <AttachItem icon={<Camera size={20} />} label="Cámara" color="bg-[#ff2e74]" />
                      <AttachItem icon={<User size={20} />} label="Contacto" color="bg-[#009de2]" />
                      <AttachItem icon={<BarChart2 size={20} />} label="Encuesta" color="bg-[#ffbc38]" />
                      <AttachItem icon={<Calendar size={20} />} label="Evento" color="bg-[#06cf9c]" />
                      <AttachItem icon={<Sticker size={20} />} label="Nuevo sticker" color="bg-[#02a698]" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex-1 relative">
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe un mensaje" className="w-full bg-white/80 rounded-lg px-4 py-2.5 text-[15px] outline-none shadow-sm placeholder:text-wa-text-secondary text-wa-text-primary focus:bg-white transition-all" />
          </div>
          <div className="text-wa-text-secondary">
            {inputText.trim() ? (
              <motion.button initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={handleSendMessage} className="text-wa-teal p-1 hover:opacity-80 transition-opacity">
                <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845L1.101,21.757z"></path></svg>
              </motion.button>
            ) : <Mic size={26} className="cursor-pointer hover:text-wa-text-primary transition-colors" />}
          </div>
        </div>
      </div>

      {/* Right Search Panel */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="w-[30%] min-w-[300px] h-full bg-white flex flex-col border-l border-wa-border z-30 shadow-2xl">
            <div className="h-[60px] glass flex items-center px-6 gap-6 border-b border-wa-border text-wa-text-secondary">
              <X size={20} className="cursor-pointer hover:text-wa-text-primary" onClick={() => { setShowSearch(false); setMessageSearchQuery(''); }} />
              <span className="text-[16px] text-wa-text-primary font-medium">Buscar mensajes</span>
            </div>
            <div className="p-4 border-b border-wa-border">
              <div className="relative flex items-center bg-wa-bg rounded-lg px-3 py-1.5 transition-all focus-within:bg-white focus-within:shadow-sm">
                <Search size={18} className="text-wa-text-secondary mr-3" />
                <input type="text" value={messageSearchQuery} onChange={(e) => setMessageSearchQuery(e.target.value)} autoFocus placeholder="Busca un mensaje" className="bg-transparent border-none outline-none text-[15px] w-full text-wa-text-primary" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
              {!messageSearchQuery ? (
                <div className="flex-1 flex items-center justify-center text-center text-wa-text-secondary p-8"><p>Busca mensajes con {activeChat.name}</p></div>
              ) : (
                <div className="flex flex-col gap-4">
                  {displayMessages.map(msg => (
                    <motion.div layout key={msg.id} className="p-3 hover:bg-wa-bg cursor-pointer rounded-lg border-b border-wa-border transition-colors">
                      <p className="text-[12px] text-wa-text-secondary mb-1">{msg.timestamp}</p>
                      <p className="text-[14px] text-wa-text-primary line-clamp-2">{msg.text}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AttachItem = ({ icon, label, color }: { icon: React.ReactNode, label: string, color: string }) => (
  <motion.div whileHover={{ x: 5 }} className="flex items-center gap-4 px-4 py-2.5 hover:bg-wa-bg cursor-pointer transition-colors group">
    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-110", color)}>{icon}</div>
    <span className="text-[14.5px] text-wa-text-primary font-medium">{label}</span>
  </motion.div>
);
