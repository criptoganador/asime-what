import React, { useEffect, useMemo } from 'react';
import { List, RowComponentProps } from 'react-window';
import { Search, Filter, Plus, ChevronDown, Star } from 'lucide-react';
import { useChatStore, Chat } from '../store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatItemData {
  data: Chat[];
}

const ChatItem = React.memo(({ index, style, data }: RowComponentProps<ChatItemData>) => {
  const chat = data[index];
  const { activeChatId, setActiveChat, toggleFavorite } = useChatStore();
  const isActive = activeChatId === chat.id;

  return (
    <div 
      style={style} 
      className={cn(
        "flex items-center px-3 py-2 cursor-pointer transition-colors border-b border-wa-border group",
        isActive ? "bg-wa-active" : "bg-wa-sidebar hover:bg-wa-hover"
      )}
    >
      <div 
        onClick={() => setActiveChat(chat.id)}
        className="relative flex-shrink-0"
      >
        <img 
          src={chat.avatar} 
          alt={chat.name} 
          className="w-12 h-12 rounded-full object-cover"
        />
        {chat.isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green border-2 border-white rounded-full"></div>
        )}
      </div>
      
      <div 
        onClick={() => setActiveChat(chat.id)}
        className="ml-3 flex-1 min-w-0"
      >
        <div className="flex justify-between items-baseline">
          <h3 className="text-[17px] font-medium text-wa-text-primary truncate">
            {chat.name}
          </h3>
          <span className="text-xs text-wa-text-secondary">
            {chat.timestamp}
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <p className="text-[14px] text-wa-text-secondary truncate pr-2">
            {chat.lastMessage}
          </p>
          <div className="flex items-center gap-2">
            <Star 
              size={16} 
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(chat.id);
              }}
              className={cn(
                "transition-all duration-200",
                chat.isFavorite 
                  ? "fill-yellow-400 text-yellow-400 opacity-100" 
                  : "text-wa-text-secondary opacity-0 group-hover:opacity-40 hover:opacity-100 hover:text-yellow-400"
              )}
            />
            {chat.unreadCount > 0 && (
              <span className="bg-wa-green text-white text-[12px] font-semibold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1">
                {chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Solo re-renderizar si cambian los datos del chat específico o el estado de selección
  const prevChat = prevProps.data[prevProps.index];
  const nextChat = nextProps.data[nextProps.index];
  
  // Nota: También comparamos el estilo por si react-window mueve el elemento
  return (
    prevChat.id === nextChat.id &&
    prevChat.lastMessage === nextChat.lastMessage &&
    prevChat.unreadCount === nextChat.unreadCount &&
    prevChat.isOnline === nextChat.isOnline &&
    prevProps.style.top === nextProps.style.top &&
    prevProps.style.height === nextProps.style.height
  );
});

export const Sidebar = () => {
  const { chats, setChats } = useChatStore();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'unread' | 'favorites' | 'groups'>('all');

  // Mock data for demonstration
  useEffect(() => {
    if (chats.length === 0) {
      const mockChats: Chat[] = Array.from({ length: 1000 }).map((_, i) => {
        const isGroup = i > 0 && i % 10 === 0;
        return {
          id: `chat-${i}`,
          name: i === 0 ? "AsicMe Support" : isGroup ? `Grupo ${Math.floor(i/10)} 🚀` : `Contacto ${i + 1}`,
          lastMessage: i === 0 ? "¡Hola! ¿En qué podemos ayudarte hoy?" : isGroup ? "Admin: ¡Bienvenidos al grupo!" : `Último mensaje del chat ${i + 1}`,
          avatar: isGroup ? `https://ui-avatars.com/api/?name=Group+${i}&background=random` : `https://i.pravatar.cc/150?u=${i}`,
          unreadCount: i % 15 === 0 ? 2 : 0,
          timestamp: "12:45 PM",
          isOnline: !isGroup && i % 7 === 0,
          isGroup: isGroup
        };
      });
      setChats(mockChats);
    }
  }, [chats.length, setChats]);

  // Filtrar chats basado en la búsqueda y pestañas
  const filteredChats = useMemo(() => {
    let result = chats;

    // Filtro por pestaña
    if (activeFilter === 'unread') {
      result = result.filter(chat => chat.unreadCount > 0);
    } else if (activeFilter === 'favorites') {
      result = result.filter(chat => chat.isFavorite);
    } else if (activeFilter === 'groups') {
      result = result.filter(chat => chat.isGroup);
    }

    // Filtro por búsqueda
    if (searchQuery.trim()) {
      try {
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedQuery}(?!\\d)`, 'i');
        result = result.filter(chat => regex.test(chat.name) || regex.test(chat.lastMessage));
      } catch (e) {
        result = result.filter(chat => chat.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
    }
    
    return result;
  }, [chats, searchQuery, activeFilter]);

  return (
    <div className="w-[400px] h-full flex flex-col bg-wa-sidebar border-r border-wa-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center bg-wa-sidebar">
        <h1 className="text-xl font-bold text-wa-text-primary">Chats</h1>
        <div className="flex gap-4 text-wa-text-secondary">
          <Plus size={20} className="cursor-pointer hover:bg-wa-hover rounded-full transition-colors" />
          <Filter size={20} className="cursor-pointer hover:bg-wa-hover rounded-full transition-colors" />
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative flex items-center bg-wa-bg rounded-lg px-3 py-1.5 transition-all">
          <Search size={18} className="text-wa-text-secondary mr-3" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Busca un chat o inicia uno nuevo"
            className="bg-transparent border-none outline-none text-[15px] w-full text-wa-text-primary placeholder:text-wa-text-secondary"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 px-3 py-2 border-b border-wa-border text-[13px]">
        <span 
          onClick={() => setActiveFilter('all')}
          className={cn(
            "px-3 py-1 rounded-full font-medium cursor-pointer transition-colors",
            activeFilter === 'all' ? "bg-wa-active text-wa-green" : "bg-wa-bg text-wa-text-secondary hover:bg-wa-hover"
          )}
        >
          Todos
        </span>
        <span 
          onClick={() => setActiveFilter('unread')}
          className={cn(
            "px-3 py-1 rounded-full font-medium cursor-pointer transition-colors",
            activeFilter === 'unread' ? "bg-wa-active text-wa-green" : "bg-wa-bg text-wa-text-secondary hover:bg-wa-hover"
          )}
        >
          No leídos
        </span>
        <span 
          onClick={() => setActiveFilter('favorites')}
          className={cn(
            "px-3 py-1 rounded-full font-medium cursor-pointer transition-colors",
            activeFilter === 'favorites' ? "bg-wa-active text-wa-green" : "bg-wa-bg text-wa-text-secondary hover:bg-wa-hover"
          )}
        >
          Favoritos
        </span>
        <span 
          onClick={() => setActiveFilter('groups')}
          className={cn(
            "px-3 py-1 rounded-full font-medium cursor-pointer transition-colors",
            activeFilter === 'groups' ? "bg-wa-active text-wa-green" : "bg-wa-bg text-wa-text-secondary hover:bg-wa-hover"
          )}
        >
          Grupos
        </span>
      </div>

      {/* Virtualized List */}
      <div className="flex-1">
        {filteredChats.length > 0 ? (
          <List<ChatItemData>
            rowCount={filteredChats.length}
            rowHeight={72}
            rowComponent={ChatItem as any}
            rowProps={{ data: filteredChats }}
            className="scrollbar-hide h-full w-full"
            style={{ height: '100%', width: '100%' }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-wa-text-secondary p-8 text-center">
            <p className="text-[14px]">No se encontraron chats que coincidan con tu búsqueda.</p>
          </div>
        )}
      </div>
    </div>
  );
};
