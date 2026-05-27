import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, Pencil, Check, UserPlus, X, MessageCircle, LogOut, ShieldCheck, ShieldAlert, MoreVertical } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { API_URL } from '../../../config';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GroupInfoView = () => {
  const { viewingGroup, updateGroup, setView, chats, activeChatId, participants, fetchParticipants, contacts, addParticipant, removeParticipant, currentUser, startChat, leaveGroup, updateParticipantRole } = useChatStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Defensa nivel 1: Encontrar el grupo de forma síncrona
  const currentGroup = viewingGroup || chats.find(c => c.id === activeChatId);
  
  // Verificar si soy admin
  const isAdmin = participants.find(p => p.id === currentUser?.id)?.role === 'admin';
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  
  // Defensa nivel 2: Estados inicializados siempre con strings vacíos
  const [tempName, setTempName] = useState('');
  const [tempDescription, setTempDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Sincronización segura de datos y carga de participantes
  React.useEffect(() => {
    if (currentGroup) {
      setTempName(currentGroup.name || '');
      setTempDescription(currentGroup.description || '');
      fetchParticipants(currentGroup.id);
    }
  }, [currentGroup?.id, currentGroup?.name, currentGroup?.description]);

  // Si no hay grupo, mostramos un estado de carga elegante
  if (!currentGroup) {
    return (
      <motion.div 
        key="loading"
        initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
        className="absolute inset-0 z-[60] bg-[#f0f2f5] flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#6366f1] border-t-transparent" />
          <p className="text-wa-text-secondary text-sm font-medium">Cargando info...</p>
        </div>
      </motion.div>
    );
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file || !currentGroup?.id) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      await updateGroup(currentGroup.id, { avatar: data.imageUrl });
    } catch (error) {
      console.error('Error uploading group avatar:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const saveName = async () => {
    if (!currentGroup?.id || !isAdmin) return;
    await updateGroup(currentGroup.id, { name: tempName });
    setIsEditingName(false);
  };

  const saveDescription = async () => {
    if (!currentGroup?.id || !isAdmin) return;
    await updateGroup(currentGroup.id, { description: tempDescription });
    setIsEditingDescription(false);
  };

  const handleAddMember = async (contactId: string) => {
    if (!currentGroup?.id || !isAdmin) return;
    await addParticipant(currentGroup.id, contactId);
    setShowAddMember(false);
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!currentGroup?.id || !isAdmin) return;
    if (window.confirm(`¿Seguro que quieres eliminar a ${userName} del grupo?`)) {
      await removeParticipant(currentGroup.id, userId);
    }
  };

  const handlePrivateMessage = (userId: string) => {
    if (userId === currentUser?.id) return;
    startChat(userId);
  };

  const handleLeaveGroup = async () => {
    if (!currentGroup?.id) return;
    if (window.confirm('¿Estás seguro de que quieres salir del grupo? Esta acción no se puede deshacer.')) {
      await leaveGroup(currentGroup.id);
      setView('chats');
    }
  };

  const handleUpdateRole = async (userId: string, currentRole: string) => {
    if (!currentGroup?.id || !isAdmin) return;
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const action = newRole === 'admin' ? 'hacer administrador' : 'quitar como administrador';
    if (window.confirm(`¿Quieres ${action} a este usuario?`)) {
      await updateParticipantRole(currentGroup.id, userId, newRole);
    }
  };

  return (
    <motion.div 
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 z-[60] bg-wa-bg flex flex-col"
    >
      {/* Header */}
      <div className="h-[108px] bg-[#6366f1] flex items-end px-6 pb-4 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft 
            className="cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => setView('chats')} 
          />
          <h2 className="text-[19px] font-medium">Info. del grupo</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f0f2f5] pb-10">
        {/* Foto del Grupo */}
        <div className="flex justify-center py-8">
          <div 
            className={cn(
              "relative w-40 h-40 sm:w-52 sm:h-52 group",
              isAdmin ? "cursor-pointer" : "cursor-default"
            )}
            onClick={() => isAdmin && fileInputRef.current?.click()}
          >
            {isAdmin && (
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload} 
              />
            )}
            <div className="w-full h-full rounded-full overflow-hidden shadow-xl border-4 border-white transition-all group-hover:opacity-50 bg-gray-200 flex items-center justify-center">
              {isUploading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366f1]"></div>
              ) : (
                <img 
                  src={currentGroup?.avatar || ''} 
                  alt="Avatar Grupo" 
                  className="w-full h-full object-cover" 
                />
              )}
            </div>
            {isAdmin && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={32} />
                <span className="text-[13px] font-medium uppercase mt-2 text-center px-4">Cambiar icono</span>
              </div>
            )}
          </div>
        </div>

        {/* Sección de Nombre */}
        <div className="bg-white px-5 sm:px-8 py-4 shadow-sm mb-7">
          <label className="text-[14px] text-[#6366f1] mb-4 block font-medium uppercase tracking-wider">Nombre del grupo</label>
          <div className="flex items-center justify-between group">
            {isEditingName && isAdmin ? (
              <div className="flex-1 flex items-center border-b-2 border-[#6366f1] pb-1">
                <input 
                  type="text" 
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                  className="flex-1 outline-none text-[17px] bg-transparent"
                />
                <Check className="text-wa-teal cursor-pointer" onClick={saveName} />
              </div>
            ) : (
              <>
                <span className="text-[17px] text-wa-text-primary font-medium">{currentGroup?.name || 'Grupo'}</span>
                {isAdmin && (
                  <Pencil 
                    size={20} 
                    className="text-wa-text-secondary cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={() => setIsEditingName(true)}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Sección de Descripción */}
        <div className="bg-white px-5 sm:px-8 py-4 shadow-sm mb-7">
          <label className="text-[14px] text-[#6366f1] mb-4 block font-medium uppercase tracking-wider">Descripción</label>
          <div className="flex items-center justify-between group">
            {isEditingDescription && isAdmin ? (
              <div className="flex-1 flex items-center border-b-2 border-[#6366f1] pb-1">
                <textarea 
                  value={tempDescription}
                  onChange={(e) => setTempDescription(e.target.value)}
                  autoFocus
                  rows={3}
                  className="flex-1 outline-none text-[17px] bg-transparent resize-none"
                />
                <Check className="text-wa-teal cursor-pointer self-end mb-1" onClick={saveDescription} />
              </div>
            ) : (
              <>
                <span className="text-[17px] text-wa-text-primary whitespace-pre-wrap">
                  {currentGroup?.description || 'Sin descripción'}
                </span>
                {isAdmin && (
                  <Pencil 
                    size={20} 
                    className="text-wa-text-secondary cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" 
                    onClick={() => setIsEditingDescription(true)}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Sección de Participantes */}
        <div className="bg-white shadow-sm mb-7">
          <div className="px-5 sm:px-8 py-4 flex justify-between items-center border-b border-wa-border">
            <span className="text-[14px] text-[#6366f1] font-medium uppercase tracking-wider">{participants.length} participantes</span>
          </div>

          {isAdmin && (
            <div 
              onClick={() => setShowAddMember(true)}
              className="px-5 sm:px-8 py-4 flex items-center gap-4 hover:bg-wa-hover cursor-pointer transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-[#6366f1] flex items-center justify-center text-white shadow-sm">
                <UserPlus size={20} />
              </div>
              <span className="text-[16px] text-wa-text-primary font-medium">Añadir participante</span>
            </div>
          )}

          {participants.map((p) => (
            <div 
              key={p.id} 
              onClick={() => handlePrivateMessage(p.id)}
              className={cn(
                "px-5 sm:px-8 py-3 flex items-center gap-4 border-t border-wa-border/50 group/member transition-colors",
                p.id !== currentUser?.id && "cursor-pointer hover:bg-wa-hover"
              )}
            >
              <img src={p.avatar} alt={p.name} className="w-12 h-12 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-medium text-wa-text-primary truncate">
                      {p.id === currentUser?.id ? 'Tú' : p.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {p.role === 'admin' && (
                        <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded border border-green-200 font-bold uppercase tracking-tighter">Admin</span>
                      )}
                      {p.id !== currentUser?.id && (
                        <MessageCircle size={14} className="text-wa-teal opacity-0 group-hover/member:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                  {isAdmin && p.id !== currentUser?.id && (
                    <div className="flex items-center gap-2 opacity-0 group-hover/member:opacity-100 transition-opacity">
                      <button 
                        title={p.role === 'admin' ? "Quitar admin" : "Hacer admin"}
                        onClick={(e) => { e.stopPropagation(); handleUpdateRole(p.id, p.role); }}
                        className={cn(
                          "p-1 rounded-full hover:bg-wa-bg transition-all",
                          p.role === 'admin' ? "text-orange-500" : "text-wa-teal"
                        )}
                      >
                        {p.role === 'admin' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                      </button>
                      <button 
                        title="Eliminar del grupo"
                        onClick={(e) => { e.stopPropagation(); handleRemoveMember(p.id, p.name); }}
                        className="p-1 rounded-full hover:bg-red-50 text-red-500 transition-all"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[13px] text-wa-text-secondary truncate">{p.about || '¡Hola! Estoy usando Asicme.'}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Zona de Peligro: Salir del Grupo */}
        <div className="bg-white shadow-sm mb-10">
          <div 
            onClick={handleLeaveGroup}
            className="px-5 sm:px-8 py-4 flex items-center gap-4 text-red-500 hover:bg-red-50 cursor-pointer transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-500 shadow-sm group-hover:scale-110 transition-transform">
              <LogOut size={20} />
            </div>
            <span className="text-[16px] font-medium">Salir del grupo</span>
          </div>
        </div>
      </div>

      {/* Selector de Contactos para Añadir */}
      <AnimatePresence>
        {showAddMember && (
          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="absolute inset-0 z-[70] bg-white flex flex-col"
          >
            <div className="h-[60px] bg-[#6366f1] flex items-center px-6 gap-6 text-white shadow-md">
              <ArrowLeft className="cursor-pointer" onClick={() => setShowAddMember(false)} />
              <h2 className="text-[19px] font-medium">Añadir participante</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {contacts
                .filter(c => !participants.some(p => p.id === c.contactId))
                .map(contact => (
                  <div 
                    key={contact.id}
                    onClick={() => handleAddMember(contact.contactId)}
                    className="flex items-center px-6 py-3 hover:bg-wa-hover cursor-pointer border-b border-wa-border"
                  >
                    <img src={contact.user.avatar} className="w-12 h-12 rounded-full object-cover" />
                    <div className="ml-4">
                      <h3 className="text-[16px] font-medium text-wa-text-primary">{contact.nickname || contact.user.name}</h3>
                      <p className="text-[13px] text-wa-text-secondary">{contact.user.phone}</p>
                    </div>
                  </div>
                ))}
              {contacts.filter(c => !participants.some(p => p.id === c.contactId)).length === 0 && (
                <div className="p-10 text-center text-wa-text-secondary">
                  No hay más contactos para añadir.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
