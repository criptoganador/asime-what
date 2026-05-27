import React, { useEffect, useMemo, useState } from 'react';
import { List, RowComponentProps } from 'react-window';
import { Search, Filter, Plus, Star, MoreVertical, Moon, Sun, Trash2 } from 'lucide-react';
import { useChatStore, Chat } from '../store/useChatStore';
import { decryptMessage } from '../../../utils/crypto';
import { ProfileView } from './ProfileView';
import { NewChatView } from './NewChatView';
import { AddContactView } from './AddContactView';
import { GroupInfoView } from './GroupInfoView';

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
          <span className="text-xs text-wa-text-secondary whitespace-nowrap">
            {(() => {
              if (!chat.timestamp) return '';
              const d = new Date(chat.timestamp);
              return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            })()}
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <p className="text-[14px] text-wa-text-secondary truncate pr-2">
            {chat.lastMessage}
          </p>
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
  const [isSmallScreen, setIsSmallScreen] = useState(window.innerWidth < 430);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const filterMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    
    const handleResize = () => setIsSmallScreen(window.innerWidth < 430);
    window.addEventListener('resize', handleResize);
    
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
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

  // Decidimos qué contenido principal mostrar
  const renderMainContent = () => {
    if (view === 'chats') {
      return (
        <motion.div 
          key="main-chats"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col h-full relative"
        >
          {/* Header */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center bg-wa-sidebar z-20 shadow-sm">
            <div 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden cursor-pointer shadow-sm border border-wa-border transition-transform active:scale-95"
              onClick={() => setView('profile')}
            >
              <img src={currentUser?.avatar || "https://i.pravatar.cc/150?u=me"} alt="Me" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-3 sm:gap-4 text-wa-text-secondary items-center">
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

          {/* Buscador */}
          <div className="px-3 py-2">
            <div className="relative flex items-center bg-wa-bg rounded-xl px-3 py-1.5 focus-within:bg-white focus-within:shadow-sm transition-all">
              <Search size={18} className={cn("text-wa-text-secondary", searchQuery && "text-wa-teal")} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Busca un chat" className="ml-4 bg-transparent outline-none text-[15px] w-full" />
            </div>
          </div>

          {/* Filtros */}
          <div className="px-3 py-2 border-b border-wa-border relative z-10">
            {!isSmallScreen ? (
              <div className="flex gap-2 text-[13px] overflow-x-auto no-scrollbar">
                {['all', 'unread', 'favorites', 'groups'].map((f) => {
                  const isUnreadTab = f === 'unread';
                  const unreadTotal = chats.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);
                  const favoritesTotal = chats.filter(chat => chat.isFavorite).length;
                  const groupsTotal = chats.filter(chat => chat.isGroup).length;
                  
                  return (
                    <motion.span 
                      key={f} 
                      onClick={() => setActiveFilter(f as any)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "px-4 py-1.5 rounded-full font-medium cursor-pointer transition-all duration-300 flex items-center gap-1.5 whitespace-nowrap border select-none", 
                        activeFilter === f 
                          ? "bg-gradient-to-r from-wa-teal to-[#00a884] text-white border-transparent shadow-md shadow-wa-teal/20" 
                          : "bg-wa-bg/50 text-wa-text-secondary border-wa-border hover:bg-wa-hover hover:text-wa-text-primary hover:border-wa-text-secondary/30"
                      )}
                    >
                      {f === 'all' ? 'Todos' : f === 'unread' ? 'No leídos' : f === 'favorites' ? 'Favoritos' : 'Grupos'}
                      {isUnreadTab && unreadTotal > 0 && (
                        <span className={cn(
                          "text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1.5 shadow-sm transition-colors",
                          activeFilter === f ? "bg-white text-wa-teal" : "bg-wa-green text-white"
                        )}>{unreadTotal}</span>
                      )}
                      {f === 'favorites' && favoritesTotal > 0 && (
                        <span className={cn(
                          "text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1.5 shadow-sm transition-colors",
                          activeFilter === f ? "bg-yellow-300 text-wa-teal" : "bg-yellow-400 text-white"
                        )}>{favoritesTotal}</span>
                      )}
                      {f === 'groups' && groupsTotal > 0 && (
                        <span className={cn(
                          "text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1.5 shadow-sm transition-colors",
                          activeFilter === f ? "bg-white text-wa-teal" : "bg-[#6366f1] text-white"
                        )}>{groupsTotal}</span>
                      )}
                    </motion.span>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2" ref={filterMenuRef}>
                <span className="bg-wa-active text-wa-green px-4 py-1.5 rounded-full font-bold text-[14px] shadow-sm flex items-center gap-2">
                  {activeFilter === 'all' ? 'Todos' : activeFilter === 'unread' ? 'No leídos' : activeFilter === 'favorites' ? 'Favoritos' : 'Grupos'}
                </span>
                <div 
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className={cn("p-2 rounded-full cursor-pointer transition-all", showFilterMenu ? "bg-wa-teal text-white shadow-lg" : "bg-wa-bg text-wa-text-secondary shadow-sm")}
                >
                  <Filter size={18} />
                </div>
                <AnimatePresence>
                  {showFilterMenu && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, x: 10, y: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: 10, y: -10 }}
                      className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-2xl py-2 z-50 border border-wa-border overflow-hidden"
                    >
                      {['all', 'unread', 'favorites', 'groups'].map((f) => (
                        <div 
                          key={f}
                          onClick={() => { setActiveFilter(f as any); setShowFilterMenu(false); }}
                          className={cn(
                            "flex items-center justify-between px-5 py-3 cursor-pointer transition-colors",
                            activeFilter === f ? "bg-wa-bg text-wa-teal font-bold" : "hover:bg-wa-bg text-wa-text-primary"
                          )}
                        >
                          <span>{f === 'all' ? 'Todos' : f === 'unread' ? 'No leídos' : f === 'favorites' ? 'Favoritos' : 'Grupos'}</span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Lista de Chats */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 bg-white">
                  {Array.from({ length: 12 }).map((_, i) => <SkeletonChatItem key={i} />)}
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                  <List
                    rowCount={filteredChats.length}
                    rowHeight={72}
                    rowComponent={ChatItem}
                    rowProps={{ items: filteredChats }}
                    style={{ height: '100%', width: '100%' }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Botón Flotante */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setView('add-contact')}
            className="absolute bottom-6 right-6 w-14 h-14 bg-[#00a884] hover:bg-[#008f6f] rounded-full flex items-center justify-center text-white shadow-lg shadow-[#00a884]/40 transition-colors z-40"
          >
            <Plus size={28} />
          </motion.button>
        </motion.div>
      );
    }

    // Si no es 'chats', mostramos las sub-vistas
    return (
      <motion.div 
        key="sub-view-container"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        className="absolute inset-0 z-[100] bg-white h-full overflow-hidden"
      >
        {view === 'profile' && <ProfileView />}
        {view === 'new-chat' && <NewChatView />}
        {view === 'add-contact' && <AddContactView onBack={() => setView('chats')} />}
        {view === 'group-info' && <GroupInfoView />}

        {view === 'security' && <SecuritySettings />}
      </motion.div>
    );
  };

  return (
    <div className="w-full md:w-[400px] h-full bg-wa-sidebar border-r border-wa-border overflow-hidden relative">
      <AnimatePresence mode="wait">
        {renderMainContent()}
      </AnimatePresence>
    </div>
  );
};
