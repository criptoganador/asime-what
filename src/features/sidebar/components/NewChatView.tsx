import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, UserPlus, MessageSquare, Check, Users, User } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { AddContactView } from './AddContactView';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NewChatView = () => {
  const { setView, currentUser, fetchChats, setActiveChat, contacts, fetchContacts, startChat } = useChatStore();
  const [tab, setTab] = useState<'contacts' | 'search'>('contacts');
  const [showAddForm, setShowAddForm] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Cargar contactos al abrir
  useEffect(() => {
    if (currentUser?.id && !showAddForm) {
      fetchContacts(currentUser.id);
    }
  }, [currentUser?.id, showAddForm]);

  // Actualizar addedIds cuando cambian los contactos
  useEffect(() => {
    const ids = new Set<string>(contacts.map((c: any) => c.contactId));
    setAddedIds(ids);
  }, [contacts]);

  // Búsqueda de usuarios
  useEffect(() => {
    if (tab !== 'search' || !query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`http://localhost:3001/api/users/search?query=${encodeURIComponent(query)}&currentUserId=${currentUser?.id}`);
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, currentUser?.id, tab]);

  const getAvatar = (user: any) => {
    if (user?.avatar) return user.avatar;
    const name = user?.name || '?';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=007bfc&color=fff&size=128`;
  };

  const addContact = async (user: any) => {
    try {
      await fetch('http://localhost:3001/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: currentUser?.id,
          contactId: user.id,
          nickname: user.name
        })
      });
      if (currentUser?.id) await fetchContacts(currentUser.id);
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-50 bg-wa-sidebar flex flex-col"
    >
      {/* Header */}
      <div className="bg-[#007bfc] text-white shadow-md">
        <div className="h-[60px] flex items-center px-6 gap-6">
          <ArrowLeft 
            className="cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => setView('chats')} 
          />
          <h2 className="text-[19px] font-medium">Nuevo chat</h2>
        </div>
        {/* Tabs */}
        <div className="flex">
          <button 
            onClick={() => { setTab('contacts'); setQuery(''); }}
            className={cn(
              "flex-1 py-3 text-[14px] font-medium transition-all border-b-2",
              tab === 'contacts' ? "border-white text-white" : "border-transparent text-white/60 hover:text-white/80"
            )}
          >
            <Users size={16} className="inline mr-2" />
            Mis Contactos
          </button>
          <button 
            onClick={() => setTab('search')}
            className={cn(
              "flex-1 py-3 text-[14px] font-medium transition-all border-b-2",
              tab === 'search' ? "border-white text-white" : "border-transparent text-white/60 hover:text-white/80"
            )}
          >
            <UserPlus size={16} className="inline mr-2" />
            Global
          </button>
        </div>
      </div>

      {/* Buscador (solo en tab search) */}
      {tab === 'search' && (
        <div className="p-4 bg-wa-sidebar border-b border-wa-border">
          <div className="relative flex items-center bg-wa-bg rounded-xl px-3 py-2 focus-within:shadow-md transition-all">
            <Search size={20} className={cn("text-wa-text-secondary", query && "text-[#007bfc]")} />
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca por nombre o teléfono"
              className="ml-4 bg-transparent outline-none text-[15px] w-full text-wa-text-primary placeholder:text-wa-text-secondary"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto bg-wa-sidebar">
        {tab === 'contacts' ? (
          /* --- Pestaña: Mis Contactos --- */
          <div className="flex flex-col">
            {/* Botón para abrir formulario manual */}
            <div 
              onClick={() => setShowAddForm(true)}
              className="flex items-center px-6 py-4 hover:bg-wa-hover cursor-pointer transition-colors border-b border-wa-border group"
            >
              <div className="w-12 h-12 rounded-full bg-[#007bfc] flex items-center justify-center text-white shadow-sm">
                <UserPlus size={20} />
              </div>
              <div className="ml-4">
                <h3 className="text-[16px] font-medium text-wa-text-primary">Nuevo contacto</h3>
              </div>
            </div>

            {contacts.length > 0 ? (
              <>
                <div className="px-8 py-4 text-[#007bfc] text-[13px] font-medium uppercase tracking-wider bg-wa-bg/50">
                  Contactos en Asicme · {contacts.length}
                </div>
                {contacts.map((contact: any) => (
                  <div 
                    key={contact.id}
                    onClick={() => startChat(contact.contactId)}
                    className="flex items-center px-6 py-3 hover:bg-wa-hover cursor-pointer transition-colors border-b border-wa-border group"
                  >
                    <img src={getAvatar(contact.user)} alt={contact.user?.name} className="w-12 h-12 rounded-full object-cover shadow-sm border border-wa-border" />
                    <div className="ml-4 flex-1">
                      <h3 className="text-[16px] font-medium text-wa-text-primary">{contact.nickname || contact.user?.name}</h3>
                      <p className="text-[13px] text-wa-text-secondary truncate">{contact.user?.about || '¡Hola! Estoy usando Asicme Web.'}</p>
                    </div>
                    <MessageSquare size={18} className="text-wa-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </>
            ) : (
              <div className="p-12 text-center text-wa-text-secondary flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-wa-bg rounded-full flex items-center justify-center">
                  <Users size={36} className="text-[#007bfc]/30" />
                </div>
                <p className="text-lg font-medium text-wa-text-primary">No tienes contactos guardados</p>
                <p className="max-w-[240px] text-sm">Usa el botón de arriba para agregar a alguien por su número.</p>
              </div>
            )}
          </div>
        ) : (
          /* --- Pestaña: Global --- */
          <AnimatePresence>
            {isLoading ? (
              <div className="p-8 text-center text-wa-text-secondary animate-pulse flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#007bfc] border-t-transparent rounded-full animate-spin"></div>
                <span>Buscando en Asicme...</span>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="flex flex-col">
                <div className="px-8 py-4 text-[#007bfc] text-[13px] font-medium uppercase tracking-wider bg-wa-bg/50">
                  Usuarios en la red
                </div>
                {searchResults.map((user) => {
                  const isAdded = addedIds.has(user.id);
                  return (
                    <div 
                      key={user.id}
                      className="flex items-center px-6 py-3 hover:bg-wa-hover transition-colors border-b border-wa-border group"
                    >
                      <img src={getAvatar(user)} alt={user.name} className="w-12 h-12 rounded-full object-cover shadow-sm border border-wa-border" />
                      <div className="ml-4 flex-1">
                        <h3 className="text-[16px] font-medium text-wa-text-primary">{user.name}</h3>
                        <p className="text-[13px] text-wa-text-secondary truncate">{user.about || '¡Hola! Estoy usando Asicme Web.'}</p>
                      </div>
                      {isAdded ? (
                        <div className="flex items-center gap-1 text-wa-green text-[13px] font-medium">
                          <Check size={16} />
                          Agregado
                        </div>
                      ) : (
                        <button 
                          onClick={() => addContact(user)}
                          className="flex items-center gap-1 bg-[#007bfc] text-white px-3 py-1.5 rounded-lg text-[13px] font-medium hover:bg-[#0066d4] transition-colors"
                        >
                          <UserPlus size={14} />
                          Agregar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : query ? (
              <div className="p-12 text-center text-wa-text-secondary">
                <p className="text-lg mb-2">No se encontraron usuarios</p>
                <p className="text-sm">Intenta con otro nombre o número completo.</p>
              </div>
            ) : (
              <div className="p-12 text-center text-wa-text-secondary flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-wa-bg rounded-full flex items-center justify-center text-[#007bfc]/30">
                  <Search size={32} />
                </div>
                <p className="max-w-[220px]">Busca usuarios globales para agregarlos a tu lista de contactos.</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Pantalla de Formulario (Overlay) */}
      <AnimatePresence>
        {showAddForm && (
          <AddContactView onBack={() => setShowAddForm(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
