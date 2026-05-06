import React, { useEffect, useMemo, useState } from 'react';
import { List, RowComponentProps } from 'react-window';
import { Search, Filter, Plus, ChevronDown, Star, MoreVertical, Moon, Sun, Trash2 } from 'lucide-react';
import { useChatStore, Chat } from '../store/useChatStore';
import { ProfileView } from './ProfileView';
import { NewChatView } from './NewChatView';
import { AddContactView } from './AddContactView';
import { GroupInfoView } from './GroupInfoView';
import { PrivacySettings } from './PrivacySettings';
import { SecuritySettings } from './SecuritySettings';
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
  const { activeChatId, setActiveChat, toggleFavorite, startChat, deleteChat } = useChatStore();
  const isActive = activeChatId === chat?.id;

  // En la v2 de react-window, es mejor devolver un div vacío que null para mantener la consistencia
  if (!chat) return <div style={style} {...ariaAttributes} />;

  const handleClick = () => {
    if (chat.isContact && chat.userId) {
      startChat(chat.userId);
    } else {
      setActiveChat(chat.id);
    }
  };

  return (
    <div 
      style={style} 
      {...ariaAttributes}
      onClick={handleClick}
      className={cn(
        "flex items-center px-3 py-2 cursor-pointer transition-colors border-b border-wa-border group",
        isActive ? "bg-wa-active" : "bg-wa-sidebar hover:bg-wa-hover"
      )}
    >
      <div className="relative flex-shrink-0">
        <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full object-cover shadow-sm" />
        {chat.isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green border-2 border-white rounded-full"></div>
        )}
      </div>
      
      <div className="ml-3 flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <h2 className="text-[17px] font-medium text-wa-text-primary truncate">{chat.name}</h2>
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`¿Seguro que quieres eliminar el chat con "${chat.name}"?`)) {
                  deleteChat(chat.id);
                }
              }}
              className="text-red-500 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity p-1"
            >
              <Trash2 size={16} />
            </button>
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
  const { chats, setChats, view, setView, currentUser, fetchChats, isDarkMode, toggleDarkMode, contacts, fetchContacts } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favorites' | 'groups'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      fetchChats(currentUser.id);
      fetchContacts(currentUser.id);
    }
  }, [currentUser?.id, fetchChats, fetchContacts]);

  const filteredChats = useMemo(() => {
    let result = chats;
    if (activeFilter === 'unread') result = result.filter(c => c.unreadCount > 0);
    else if (activeFilter === 'favorites') result = result.filter(c => c.isFavorite);
    else if (activeFilter === 'groups') result = result.filter(c => c.isGroup);
    
    if (searchQuery.trim()) {
      const chatResults = result.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Incluir contactos que coincidan y NO tengan ya un chat abierto
      const contactResults = contacts
        .filter(c => {
          const nameMatch = (c.nickname || c.user.name).toLowerCase().includes(searchQuery.toLowerCase());
          const phoneMatch = c.user.phone.includes(searchQuery);
          const alreadyHasChat = chats.some(chat => chat.name === (c.nickname || c.user.name));
          return (nameMatch || phoneMatch) && !alreadyHasChat;
        })
        .map(c => ({
          id: `contact-${c.contactId}`,
          name: c.nickname || c.user.name,
          lastMessage: 'Contacto de Asicme',
          avatar: c.user.avatar,
          unreadCount: 0,
          timestamp: '',
          isContact: true,
          userId: c.contactId
        }));

      return [...chatResults, ...contactResults];
    }
    
    return result;
  }, [chats, contacts, searchQuery, activeFilter]);

  return (
    <div className="w-full md:w-[400px] h-full flex flex-col bg-wa-sidebar border-r border-wa-border overflow-hidden relative">
      <div className="px-4 py-3 flex justify-between items-center bg-wa-sidebar z-20">
        <div 
          className="w-10 h-10 rounded-full overflow-hidden cursor-pointer shadow-sm border border-wa-border transition-transform active:scale-95"
          onClick={() => setView('profile')}
        >
          <img src={currentUser?.avatar || "https://i.pravatar.cc/150?u=me"} alt="Me" className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-4 text-wa-text-secondary items-center">
          <div 
            onClick={toggleDarkMode}
            className="cursor-pointer hover:bg-wa-hover rounded-full p-1.5 transition-all"
          >
            {isDarkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} />}
          </div>
          <Plus 
            size={20} 
            className="cursor-pointer hover:bg-wa-hover rounded-full p-0.5" 
            onClick={() => setView('new-chat')}
          />
          <div className="relative" ref={menuRef}>
            <MoreVertical 
              size={20} 
              className={cn("cursor-pointer hover:bg-wa-hover rounded-full p-0.5 transition-colors", showMenu && "text-wa-teal bg-wa-hover")} 
              onClick={() => setShowMenu(!showMenu)}
            />
            <AnimatePresence>
              {showMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                  animate={{ opacity: 1, scale: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95, y: -10 }} 
                  className="absolute right-0 top-10 w-[200px] bg-white shadow-xl rounded-xl py-2 z-50 border border-wa-border origin-top-right"
                >
                  <ul className="text-[14.5px] text-wa-text-primary">
                    <li className="px-6 py-2.5 hover:bg-wa-bg cursor-pointer transition-colors" onClick={() => { setView('new-chat'); setShowMenu(false); }}>Nuevo chat</li>
                    <li className="px-6 py-2.5 hover:bg-wa-bg cursor-pointer transition-colors" onClick={() => { setView('profile'); setShowMenu(false); }}>Perfil</li>
                    <li className="px-6 py-2.5 hover:bg-wa-bg cursor-pointer transition-colors" onClick={() => { setView('settings'); setShowMenu(false); }}>Configuración</li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="relative flex items-center bg-wa-bg rounded-xl px-3 py-1.5 focus-within:bg-white focus-within:shadow-sm transition-all">
          <Search size={18} className={cn("text-wa-text-secondary", searchQuery && "text-wa-teal")} />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Busca un chat" className="ml-4 bg-transparent outline-none text-[15px] w-full" />
        </div>
      </div>

      <div className="flex gap-2 px-3 py-2 border-b border-wa-border text-[13px] overflow-x-auto no-scrollbar">
        {['all', 'unread', 'favorites', 'groups'].map((f) => {
          const isUnreadTab = f === 'unread';
          const isFavoriteTab = f === 'favorites';
          const isGroupsTab = f === 'groups';
          
          const unreadTotal = chats.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);
          const favoritesTotal = chats.filter(chat => chat.isFavorite).length;
          const groupsTotal = chats.filter(chat => chat.isGroup).length;
          
          return (
            <span 
              key={f} 
              onClick={() => setActiveFilter(f as any)} 
              className={cn(
                "px-3 py-1 rounded-full font-medium cursor-pointer transition-all flex items-center gap-1.5", 
                activeFilter === f ? "bg-wa-active text-wa-green shadow-sm" : "bg-wa-bg text-wa-text-secondary hover:bg-wa-hover"
              )}
            >
              {f === 'all' ? 'Todos' : f === 'unread' ? 'No leídos' : f === 'favorites' ? 'Favoritos' : 'Grupos'}
              
              {isUnreadTab && unreadTotal > 0 && (
                <span className="bg-wa-green text-white text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
                  {unreadTotal}
                </span>
              )}

              {isFavoriteTab && favoritesTotal > 0 && (
                <span className="bg-yellow-400 text-white text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 shadow-sm">
                  {favoritesTotal}
                </span>
              )}

              {isGroupsTab && groupsTotal > 0 && (
                <span className="bg-[#007bfc] text-white text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 shadow-sm">
                  {groupsTotal}
                </span>
              )}
            </span>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 bg-white">
              {Array.from({ length: 12 }).map((_, i) => <SkeletonChatItem key={i} />)}
            </motion.div>
          ) : view === 'chats' ? (
            <motion.div 
              key="list" 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <List
                rowCount={filteredChats.length}
                rowHeight={72}
                rowComponent={ChatItem}
                rowProps={{ items: filteredChats }}
                style={{ height: window.innerHeight - 180, width: '100%' }}
              />
            </motion.div>
          ) : (
            <motion.div 
              key="view-placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="absolute inset-0 bg-wa-bg flex items-center justify-center"
            >
              <div className="animate-pulse text-wa-text-secondary text-sm">Cargando vista...</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botón Flotante estilo WhatsApp para Nuevo Chat */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setView('add-contact')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-[#007bfc] rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-shadow z-40"
      >
        <Plus size={24} />
      </motion.button>

      {/* Vistas Deslizables con AnimatePresence para evitar bloqueos de renderizado */}
      <AnimatePresence>
        {view === 'profile' && <ProfileView key="profile" />}
        {view === 'new-chat' && <NewChatView key="new-chat" />}
        {view === 'add-contact' && <AddContactView key="add-contact" onBack={() => setView('chats')} />}
        {view === 'group-info' && <GroupInfoView key="group-info" />}
        {view === 'privacy' && <PrivacySettings key="privacy" />}
        {view === 'security' && <SecuritySettings key="security" />}
      </AnimatePresence>
    </div>
  );
};
