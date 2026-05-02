import React, { useEffect, useMemo, useState } from 'react';
import { List, RowComponentProps } from 'react-window';
import { Search, Filter, Plus, ChevronDown, Star, MoreVertical } from 'lucide-react';
import { useChatStore, Chat } from '../store/useChatStore';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Props para el componente de fila en react-window v2
interface RowProps {
  items: Chat[];
}

// Componente de Fila sin memo directo para evitar conflictos de tipos
const ChatItem = ({ index, style, items, ariaAttributes }: RowComponentProps<RowProps>) => {
  const chat = items[index];
  const { activeChatId, setActiveChat, toggleFavorite } = useChatStore();
  const isActive = activeChatId === chat?.id;

  // En la v2 de react-window, es mejor devolver un div vacío que null para mantener la consistencia
  if (!chat) return <div style={style} {...ariaAttributes} />;

  return (
    <div 
      style={style} 
      {...ariaAttributes}
      className={cn(
        "flex items-center px-3 py-2 cursor-pointer transition-colors border-b border-wa-border group",
        isActive ? "bg-wa-active" : "bg-wa-sidebar hover:bg-wa-hover"
      )}
    >
      <div onClick={() => setActiveChat(chat.id)} className="relative flex-shrink-0">
        <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full object-cover shadow-sm" />
        {chat.isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green border-2 border-white rounded-full"></div>
        )}
      </div>
      
      <div onClick={() => setActiveChat(chat.id)} className="ml-3 flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <h3 className="text-[17px] font-medium text-wa-text-primary truncate">{chat.name}</h3>
          <span className="text-xs text-wa-text-secondary">{chat.timestamp}</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <p className="text-[14px] text-wa-text-secondary truncate pr-2">{chat.lastMessage}</p>
          <div className="flex items-center gap-2">
            <Star 
              size={16} 
              onClick={(e) => { e.stopPropagation(); toggleFavorite(chat.id); }}
              className={cn("transition-all duration-200", chat.isFavorite ? "fill-yellow-400 text-yellow-400 opacity-100" : "text-wa-text-secondary opacity-0 group-hover:opacity-40 hover:opacity-100 hover:text-yellow-400")}
            />
            <AnimatePresence mode="popLayout">
              {chat.unreadCount > 0 && (
                <motion.span 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  key={chat.unreadCount}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="bg-wa-green text-white text-[12px] font-semibold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1 shadow-sm"
                >
                  {chat.unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

const SkeletonChatItem = () => (
  <div className="flex items-center px-3 py-2 border-b border-wa-border animate-pulse">
    <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
    <div className="ml-3 flex-1">
      <div className="flex justify-between items-center mb-2">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-3 w-10 bg-gray-100 rounded" />
      </div>
      <div className="h-3 w-full bg-gray-100 rounded" />
    </div>
  </div>
);

export const Sidebar = () => {
  const { chats, setChats } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (chats.length === 0) {
      const mockChats: Chat[] = Array.from({ length: 1000 }).map((_, i) => ({
        id: `chat-${i}`,
        name: i === 0 ? "AsicMe Support" : i % 10 === 0 ? `Grupo ${Math.floor(i/10)} 🚀` : `Contacto ${i + 1}`,
        lastMessage: i === 0 ? "¡Hola! ¿En qué podemos ayudarte?" : i % 10 === 0 ? "Admin: ¡Bienvenidos!" : `Mensaje ${i + 1}`,
        avatar: i % 10 === 0 ? `https://ui-avatars.com/api/?name=G+${i}` : `https://i.pravatar.cc/150?u=${i}`,
        unreadCount: i % 15 === 0 ? 2 : 0,
        timestamp: "12:45 PM",
        isOnline: i % 7 === 0,
        isGroup: i % 10 === 0
      }));
      setChats(mockChats);
    }
  }, [chats.length, setChats]);

  const filteredChats = useMemo(() => {
    let result = chats;
    if (activeFilter === 'unread') result = result.filter(c => c.unreadCount > 0);
    else if (activeFilter === 'favorites') result = result.filter(c => c.isFavorite);
    else if (activeFilter === 'groups') result = result.filter(c => c.isGroup);
    if (searchQuery.trim()) {
      result = result.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return result;
  }, [chats, searchQuery, activeFilter]);

  return (
    <div className="w-full md:w-[400px] h-full flex flex-col bg-wa-sidebar border-r border-wa-border overflow-hidden">
      <div className="px-4 py-3 flex justify-between items-center bg-wa-sidebar z-20">
        <div className="w-10 h-10 rounded-full overflow-hidden cursor-pointer shadow-sm border border-wa-border">
          <img src="https://i.pravatar.cc/150?u=me" alt="Me" className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-4 text-wa-text-secondary">
          <Plus size={20} className="cursor-pointer hover:bg-wa-hover rounded-full p-0.5" />
          <MoreVertical size={20} className="cursor-pointer hover:bg-wa-hover rounded-full p-0.5" />
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="relative flex items-center bg-wa-bg rounded-xl px-3 py-1.5 focus-within:bg-white focus-within:shadow-sm transition-all">
          <Search size={18} className={cn("text-wa-text-secondary", searchQuery && "text-wa-teal")} />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Busca un chat" className="ml-4 bg-transparent outline-none text-[15px] w-full" />
        </div>
      </div>

      <div className="flex gap-2 px-3 py-2 border-b border-wa-border text-[13px] overflow-x-auto no-scrollbar">
        {['all', 'unread', 'favorites', 'groups'].map((f) => (
          <span key={f} onClick={() => setActiveFilter(f as any)} className={cn("px-3 py-1 rounded-full font-medium cursor-pointer transition-all", activeFilter === f ? "bg-wa-active text-wa-green shadow-sm" : "bg-wa-bg text-wa-text-secondary hover:bg-wa-hover")}>
            {f === 'all' ? 'Todos' : f === 'unread' ? 'No leídos' : f === 'favorites' ? 'Favoritos' : 'Grupos'}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 bg-white">
              {Array.from({ length: 12 }).map((_, i) => <SkeletonChatItem key={i} />)}
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
              <List
                rowCount={filteredChats.length}
                rowHeight={72}
                rowComponent={ChatItem}
                rowProps={{ items: filteredChats }}
                style={{ height: window.innerHeight - 180, width: '100%' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
