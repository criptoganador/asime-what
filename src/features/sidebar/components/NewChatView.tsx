import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, UserPlus, MessageSquare, Check, Users, X } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { AddContactView } from './AddContactView';
import { API_URL } from '../../../config';
import { compressAvatar } from '../../../utils/upload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NewChatView = ({ initialStep = 'list' }: { initialStep?: 'list' | 'group-name' } = {}) => {
  const { setView, currentUser, contacts, fetchContacts, startChat, createGroup } = useChatStore();
  const [tab, setTab] = useState<'contacts' | 'search'>('contacts');
  const [showAddForm, setShowAddForm] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  
  // Estados para el flujo interno de creación de grupo
  const [step, setStep] = useState<'list' | 'group-name'>(initialStep);
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
      await fetch(`${API_URL}/api/contacts`, {
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

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    // El grupo se crea con nombre, avatar, descripción y el creador
    await createGroup(groupName, groupAvatar || '', groupDescription, []);
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
            onClick={() => step === 'list' ? setView('chats') : setStep('list')} 
          />
          <h2 className="text-[19px] font-medium">
            {step === 'list' ? 'Nuevo chat' : 'Nuevo grupo'}
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
                        onClick={() => setStep('group-name')}
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
          ) : (
            <motion.div 
              key="name-step"
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 30, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-1 p-5 sm:p-8 flex flex-col items-center gap-6 sm:gap-10 bg-wa-bg/10 h-full overflow-y-auto"
            >
              <div 
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                />
                <div className="w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-wa-bg flex items-center justify-center text-wa-text-secondary border-2 border-dashed border-wa-border group-hover:border-[#6366f1] transition-all shadow-inner overflow-hidden">
                  {isUploading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366f1]"></div>
                  ) : groupAvatar ? (
                    <img src={groupAvatar} alt="Avatar grupo" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={64} />
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/30 sm:bg-black/0 sm:group-hover:bg-black/20 flex items-center justify-center transition-all">
                   <div className="text-white sm:opacity-0 sm:group-hover:opacity-100 font-medium text-xs sm:text-sm text-center px-4 uppercase tracking-tighter">Cambiar icono</div>
                </div>
              </div>

              <div className="w-full max-w-sm space-y-8">
                <div className="space-y-3">
                  <label className="text-[14px] text-[#6366f1] font-medium px-1 uppercase tracking-wider">Asunto del grupo</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      placeholder="Ej: Familia, Trabajo..." 
                      className="w-full bg-transparent border-b-2 border-wa-border focus:border-[#6366f1] outline-none py-3 text-xl transition-all font-medium"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      autoFocus
                    />
                    {groupName && (
                      <X 
                        size={20} 
                        className="absolute right-0 text-wa-text-secondary cursor-pointer hover:text-wa-text-primary" 
                        onClick={() => setGroupName('')}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[14px] text-[#6366f1] font-medium px-1 uppercase tracking-wider">Descripción (Opcional)</label>
                  <div className="relative flex items-center">
                    <textarea 
                      placeholder="¿De qué trata este grupo?" 
                      rows={2}
                      className="w-full bg-transparent border-b-2 border-wa-border focus:border-[#6366f1] outline-none py-2 text-[16px] transition-all resize-none scrollbar-none"
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                    />
                    {groupDescription && (
                      <X 
                        size={18} 
                        className="absolute right-0 top-2 text-wa-text-secondary cursor-pointer hover:text-wa-text-primary" 
                        onClick={() => setGroupDescription('')}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-auto pb-12 w-full flex justify-center">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreateGroup}
                  disabled={!groupName.trim() || isUploading}
                  className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all ${
                    groupName.trim() && !isUploading ? "bg-wa-green hover:bg-[#008f6f]" : "bg-gray-300 cursor-not-allowed opacity-50"
                  }`}
                >
                  <Check size={32} />
                </motion.button>
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
