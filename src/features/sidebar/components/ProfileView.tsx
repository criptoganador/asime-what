import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Pencil, Check, Loader2, X } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { uploadImage } from '../../../utils/upload';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ProfileView = () => {
  const { currentUser, updateProfile, setView } = useChatStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [tempName, setTempName] = useState(currentUser?.name || '');
  const [tempAbout, setTempAbout] = useState(currentUser?.about || '');

  if (!currentUser) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const imageUrl = await uploadImage(file);
        await updateProfile({ avatar: imageUrl });
      } catch (error) {
        alert('Error al subir la imagen');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const saveName = () => {
    updateProfile({ name: tempName });
    setIsEditingName(false);
  };

  const saveAbout = () => {
    updateProfile({ about: tempAbout });
    setIsEditingAbout(false);
  };

  return (
    <motion.div 
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 z-50 bg-wa-bg flex flex-col"
    >
      {/* Header Estilo WhatsApp/Asicme */}
      <div className="h-20 sm:h-[108px] bg-[#007bfc] flex items-end px-4 sm:px-6 pb-4 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft 
            className="cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => setView('chats')} 
          />
          <h2 className="text-[19px] font-medium">Perfil</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-wa-bg">
        {/* Foto de Perfil con efecto Hover */}
        <div className="flex justify-center py-6 sm:py-8">
          <div 
            className="relative w-40 h-40 sm:w-52 sm:h-52 group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            <div className={cn(
              "w-full h-full rounded-full overflow-hidden shadow-xl border-4 border-white transition-all group-hover:opacity-50 relative",
              isUploading && "opacity-50"
            )}>
              <img 
                src={currentUser.avatar} 
                alt="Avatar" 
                className="w-full h-full object-cover" 
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={40} className="text-wa-teal animate-spin" />
                </div>
              )}
            </div>
            {/* Overlay de cámara al hacer hover */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 sm:bg-transparent rounded-full">
              <Camera size={28} className="sm:hidden" />
              <Camera size={32} className="hidden sm:block" />
              <span className="text-[11px] sm:text-[13px] font-medium uppercase mt-1 sm:mt-2 text-center px-4 leading-tight">Cambiar foto</span>
            </div>
          </div>
        </div>

        {/* Sección de Nombre */}
        <div className="bg-white px-5 sm:px-8 py-4 shadow-sm mb-0.5">
          <label className="text-[14px] text-[#007bfc] mb-4 block font-medium">Tu nombre</label>
          <div className="flex items-center justify-between group h-10">
            {isEditingName ? (
              <div className="flex-1 flex items-center border-b-2 border-[#007bfc] pb-1 animate-in fade-in slide-in-from-bottom-1">
                <input 
                  type="text" 
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="flex-1 outline-none text-[17px] bg-transparent"
                />
                <div className="flex gap-3 ml-2">
                  <X className="text-wa-text-secondary cursor-pointer hover:text-red-500 transition-colors" size={20} onClick={() => { setTempName(currentUser.name); setIsEditingName(false); }} />
                  <Check className="text-wa-teal cursor-pointer hover:scale-110 transition-transform" size={20} onClick={saveName} />
                </div>
              </div>
            ) : (
              <>
                <span className="text-[17px] text-wa-text-primary">{currentUser.name}</span>
                <Pencil 
                  size={20} 
                  className="text-wa-text-secondary cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-[#007bfc]" 
                  onClick={() => setIsEditingName(true)}
                />
              </>
            )}
          </div>
        </div>

        <div className="px-5 sm:px-8 py-4 mb-7 bg-wa-bg">
          <p className="text-[13.5px] text-wa-text-secondary leading-tight">
            Este no es un nombre de usuario ni un PIN. Este nombre será visible para tus contactos de Asicme Web.
          </p>
        </div>

        {/* Sección de Info */}
        <div className="bg-white px-5 sm:px-8 py-4 shadow-sm mb-7">
          <label className="text-[14px] text-[#007bfc] mb-4 block font-medium">Info.</label>
          <div className="flex items-center justify-between group h-10">
            {isEditingAbout ? (
              <div className="flex-1 flex items-center border-b-2 border-[#007bfc] pb-1 animate-in fade-in slide-in-from-bottom-1">
                <input 
                  type="text" 
                  value={tempAbout}
                  onChange={(e) => setTempAbout(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && saveAbout()}
                  className="flex-1 outline-none text-[17px] bg-transparent"
                />
                <div className="flex gap-3 ml-2">
                  <X className="text-wa-text-secondary cursor-pointer hover:text-red-500 transition-colors" size={20} onClick={() => { setTempAbout(currentUser.about); setIsEditingAbout(false); }} />
                  <Check className="text-wa-teal cursor-pointer hover:scale-110 transition-transform" size={20} onClick={saveAbout} />
                </div>
              </div>
            ) : (
              <>
                <span className="text-[17px] text-wa-text-primary line-clamp-1">{currentUser.about}</span>
                <Pencil 
                  size={20} 
                  className="text-wa-text-secondary cursor-pointer sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:text-[#007bfc]" 
                  onClick={() => setIsEditingAbout(true)}
                />
              </>
            )}
          </div>
        </div>

        {/* Sección de Teléfono (Solo lectura) */}
        <div className="bg-white px-5 sm:px-8 py-4 shadow-sm">
          <label className="text-[14px] text-[#007bfc] mb-4 block font-medium">Teléfono</label>
          <div className="flex items-center h-10">
            <span className="text-[17px] text-wa-text-primary">{currentUser.phone}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
