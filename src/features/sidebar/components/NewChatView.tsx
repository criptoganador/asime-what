import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, UserPlus, MessageSquare, Check, Users, X, Camera } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { AddContactView } from './AddContactView';
import { API_URL } from '../../../config';
import { compressAvatar } from '../../../utils/upload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NewChatView = ({ initialStep = 'list' }: { initialStep?: 'list' | 'select-participants' | 'group-name' } = {}) => {
  const { setView, currentUser, contacts, fetchContacts, startChat, createGroup } = useChatStore();
  const [tab, setTab] = useState<'contacts' | 'search'>('contacts');
  const [showAddForm, setShowAddForm] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  
  // Estados para el flujo interno de creación de grupo
  const [step, setStep] = useState<'list' | 'select-participants' | 'group-name'>(initialStep);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
        const response = await fetch(`${API_URL}/api/users/search?query=${encodeURIComponent(query)}&currentUserId=${currentUser?.id}`);
        if (!response.ok) throw new Error('Error en el servidor al buscar usuarios');
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('La imagen es demasiado grande. Selecciona una menor a 10MB.');
        return;
      }
      setIsUploading(true);
      try {
        const base64Avatar = await compressAvatar(file);
        setGroupAvatar(base64Avatar);
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('El archivo es demasiado grande o hubo un error.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const addContact = async (user: any) => {
    try {
      const res = await fetch(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: currentUser?.id,
          contactId: user.id,
          nickname: user.name
        })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al agregar en el servidor');
      }
      if (currentUser?.id) await fetchContacts(currentUser.id);
    } catch (error: any) {
      console.error('Error adding contact:', error);
      alert(error.message || 'Error al agregar contacto.');
    }
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedContacts.length === 0) return;
    // El grupo se crea con nombre, avatar, descripción y los contactos seleccionados
    await createGroup(groupName, groupAvatar || '', groupDescription, selectedContacts);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-50 bg-wa-sidebar flex flex-col"
    >
      {/* Header Dinámico */}
      <div className="bg-[#6366f1] text-white shadow-md">
        <div className="h-[60px] flex items-center px-4 sm:px-6 gap-4 sm:gap-6">
          <ArrowLeft 
            className="cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => {
              if (step === 'list') setView('chats');
              else if (step === 'select-participants') setStep('list');
              else if (step === 'group-name') setStep('select-participants');
            }} 
          />
          <h2 className="text-[19px] font-medium">
            {step === 'list' ? 'Nuevo chat' : step === 'select-participants' ? 'Añadir participantes' : 'Nuevo grupo'}
          </h2>
        </div>
        
        {step === 'list' && (
          <div className="flex">
            <button 
              onClick={() => { setTab('contacts'); setQuery(''); }}
              className={cn(
                "flex-1 py-3 text-[14px] font-medium transition-all border-b-2",
                tab === 'contacts' ? "border-white text-white" : "border-transparent text-white/60 hover:text-white/80"
              )}
            >
              Mis Contactos
            </button>
            <button 
              onClick={() => setTab('search')}
              className={cn(
                "flex-1 py-3 text-[14px] font-medium transition-all border-b-2",
                tab === 'search' ? "border-white text-white" : "border-transparent text-white/60 hover:text-white/80"
              )}
            >
              Global
            </button>
          </div>
        )}
      </div>

      {/* Contenido Principal con Animaciones de Cambio de Paso */}
      <div className="flex-1 overflow-y-auto bg-wa-sidebar relative overflow-x-hidden">
        <AnimatePresence mode="wait">
          {step === 'list' ? (
            <motion.div 
              key="list-step"
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col"
            >
              {tab === 'search' && (
                <div className="p-4 border-b border-wa-border">
                  <div className="relative flex items-center bg-wa-bg rounded-xl px-3 py-2">
                    <Search size={20} className="text-wa-text-secondary" />
                    <input 
                      type="text" 
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Busca por nombre o teléfono"
                      className="ml-4 bg-transparent outline-none text-[15px] w-full"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col">
                {tab === 'contacts' && (
                  <>
                    {/* Botones de acción principal */}
                    <div className="py-2">
                      <div 
                        onClick={() => setStep('select-participants')}
                        className="flex items-center px-6 py-3.5 hover:bg-wa-hover cursor-pointer transition-colors group"
                      >
                        <div className="w-11 h-11 rounded-full bg-wa-teal flex items-center justify-center text-white shadow-sm">
                          <Users size={20} />
                        </div>
                        <div className="ml-4 border-b border-wa-border flex-1 py-1">
                          <h3 className="text-[16px] font-medium text-wa-text-primary">Nuevo grupo</h3>
                        </div>
                      </div>

                      <div 
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center px-6 py-3.5 hover:bg-wa-hover cursor-pointer transition-colors group"
                      >
                        <div className="w-11 h-11 rounded-full bg-wa-teal flex items-center justify-center text-white shadow-sm">
                          <UserPlus size={20} />
                        </div>
                        <div className="ml-4 flex-1 py-1">
                          <h3 className="text-[16px] font-medium text-wa-text-primary">Nuevo contacto</h3>
                        </div>
                      </div>

                      <div className="px-6 py-4 text-wa-teal text-[12.5px] font-bold uppercase tracking-widest bg-wa-bg/40 border-y border-wa-border">
                        Tus contactos · {contacts.length}
                      </div>
                    </div>

                    {contacts.map((contact: any) => (
                      <div 
                        key={contact.id}
                        onClick={() => startChat(contact.contactId)}
                        className="flex items-center px-6 py-3 hover:bg-wa-hover cursor-pointer border-b border-wa-border group"
                      >
                        <img src={getAvatar(contact.user)} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                        <div className="ml-4 flex-1">
                          <h3 className="text-[16px] font-medium text-wa-text-primary">{contact.nickname || contact.user?.name}</h3>
                          <p className="text-[13px] text-wa-text-secondary truncate">{contact.user?.about || '¡Hola! Estoy usando Asicme Chat.'}</p>
                        </div>
                        <MessageSquare size={18} className="text-wa-text-secondary sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                  </>
                )}
                
                {tab === 'search' && searchResults.map((user) => {
                   const isAdded = addedIds.has(user.id);
                   return (
                    <div key={user.id} className="flex items-center px-6 py-3 border-b border-wa-border group">
                      <img src={getAvatar(user)} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                      <div className="ml-4 flex-1">
                        <h3 className="text-[16px] font-medium text-wa-text-primary">{user.name}</h3>
                      </div>
                      {isAdded ? (
                        <Check className="text-wa-green" size={20} />
                      ) : (
                        <button 
                          onClick={() => addContact(user)}
                          className="bg-[#6366f1] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#0066d4]"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                   );
                })}
              </div>
            </motion.div>
          ) : step === 'select-participants' ? (
            <motion.div 
              key="select-participants-step"
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full"
            >
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-4 text-wa-teal text-[12.5px] font-bold uppercase tracking-widest bg-wa-bg/40 border-b border-wa-border">
                  Selecciona contactos
                </div>
                {contacts.map((contact: any) => {
                  const isSelected = selectedContacts.includes(contact.contactId);
                  return (
                    <div 
                      key={contact.id}
                      onClick={() => toggleContactSelection(contact.contactId)}
                      className="flex items-center px-6 py-3 hover:bg-wa-hover cursor-pointer border-b border-wa-border group"
                    >
                      <div className="relative">
                        <img src={getAvatar(contact.user)} className="w-12 h-12 rounded-full object-cover shadow-sm" />
                        {isSelected && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-wa-teal rounded-full flex items-center justify-center border-2 border-wa-sidebar">
                            <Check size={12} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="text-[16px] font-medium text-wa-text-primary">{contact.nickname || contact.user?.name}</h3>
                        <p className="text-[13px] text-wa-text-secondary truncate">{contact.user?.about || '¡Hola! Estoy usando Asicme Chat.'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {selectedContacts.length > 0 && (
                <div className="p-4 bg-wa-sidebar flex justify-end">
                  <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setStep('group-name')}
                    className="w-14 h-14 rounded-full bg-wa-teal flex items-center justify-center text-white shadow-lg"
                  >
                    <ArrowLeft size={24} className="rotate-180" />
                  </motion.button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="name-step"
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 30, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1 p-5 sm:p-8 flex flex-col items-center gap-8 bg-gradient-to-b from-transparent to-wa-bg/30 h-full overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="relative group cursor-pointer mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                />
                <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-full flex items-center justify-center text-wa-text-secondary border-[3px] border-dashed border-wa-border group-hover:border-[#6366f1] transition-all duration-300 shadow-lg overflow-hidden bg-wa-sidebar relative z-10">
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#6366f1] border-t-transparent"></div>
                  ) : groupAvatar ? (
                    <img src={groupAvatar} alt="Avatar grupo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 group-hover:scale-110 transition-transform duration-300 text-[#6366f1]/60 group-hover:text-[#6366f1]">
                      <Camera size={48} strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 backdrop-blur-[2px]">
                   <span className="text-white font-medium text-sm text-center px-4 uppercase tracking-wider drop-shadow-md">
                     {groupAvatar ? 'Cambiar foto' : 'Añadir foto'}
                   </span>
                </div>
              </motion.div>

              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-full max-w-sm space-y-8 mt-2"
              >
                <div className="space-y-2 relative group">
                  <label className="text-[12px] text-[#6366f1] font-bold px-1 uppercase tracking-widest opacity-80 transition-opacity group-focus-within:opacity-100">
                    Asunto del grupo
                  </label>
                  <div className="relative flex items-center bg-wa-bg rounded-t-xl overflow-hidden">
                    <input 
                      type="text" 
                      placeholder="Ej: Familia, Trabajo..." 
                      className="w-full bg-transparent border-b-2 border-wa-border focus:border-[#6366f1] outline-none px-4 py-3.5 text-[17px] transition-colors font-medium text-wa-text-primary"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                    {groupName && (
                      <X 
                        size={18} 
                        className="absolute right-4 text-wa-text-secondary cursor-pointer hover:text-red-500 transition-colors bg-wa-bg" 
                        onClick={() => setGroupName('')}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2 relative group">
                  <label className="text-[12px] text-[#6366f1] font-bold px-1 uppercase tracking-widest opacity-80 transition-opacity group-focus-within:opacity-100">
                    Descripción (Opcional)
                  </label>
                  <div className="relative flex items-start bg-wa-bg rounded-t-xl overflow-hidden">
                    <textarea 
                      placeholder="¿Cuál es el propósito del grupo?" 
                      rows={3}
                      className="w-full bg-transparent border-b-2 border-wa-border focus:border-[#6366f1] outline-none px-4 py-3 text-[15px] transition-colors resize-none scrollbar-none text-wa-text-primary"
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                    />
                  </div>
                </div>
              </motion.div>

              <div className="mt-auto pt-8 pb-6 w-full flex justify-center">
                <AnimatePresence>
                  {groupName.trim() && (
                    <motion.button
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCreateGroup}
                      disabled={isUploading}
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-[0_8px_30px_rgb(99,102,241,0.4)] transition-all ${
                        isUploading ? "bg-[#6366f1]/50 cursor-not-allowed" : "bg-gradient-to-tr from-[#6366f1] to-[#8b5cf6] hover:shadow-[0_8px_30px_rgb(99,102,241,0.6)]"
                      }`}
                    >
                      <Check size={28} strokeWidth={3} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <AddContactView onBack={() => setShowAddForm(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
