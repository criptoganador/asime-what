import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Pencil, Check } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ProfileView = () => {
  const { currentUser, login, setView } = useChatStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [isEditingAbout, setIsEditingAbout] = React.useState(false);
  const [tempName, setTempName] = React.useState(currentUser?.name || '');
  const [tempAbout, setTempAbout] = React.useState(currentUser?.about || '');

  if (!currentUser) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        login({ ...currentUser, avatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveName = () => {
    login({ ...currentUser, name: tempName });
    setIsEditingName(false);
  };

  const saveAbout = () => {
    login({ ...currentUser, about: tempAbout });
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
      <div className="h-[108px] bg-[#007bfc] flex items-end px-6 pb-4 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft 
            className="cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => setView('chats')} 
          />
          <h2 className="text-[19px] font-medium">Perfil</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
        {/* Foto de Perfil con efecto Hover */}
        <div className="flex justify-center py-8">
          <div 
            className="relative w-52 h-52 group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            <div className="w-full h-full rounded-full overflow-hidden shadow-xl border-4 border-white transition-all group-hover:opacity-50">
              <img 
                src={currentUser.avatar} 
                alt="Avatar" 
                className="w-full h-full object-cover" 
              />
            </div>
            {/* Overlay de cámara al hacer hover */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={32} />
              <span className="text-[13px] font-medium uppercase mt-2 text-center px-4 leading-tight">Cambiar foto de perfil</span>
            </div>
          </div>
        </div>

        {/* Sección de Nombre */}
        <div className="bg-white px-8 py-4 shadow-sm mb-7">
          <label className="text-[14px] text-[#007bfc] mb-4 block">Tu nombre</label>
          <div className="flex items-center justify-between group">
            {isEditingName ? (
              <div className="flex-1 flex items-center border-b-2 border-[#007bfc] pb-1">
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
                <span className="text-[17px] text-wa-text-primary">{currentUser.name}</span>
                <Pencil 
                  size={20} 
                  className="text-wa-text-secondary cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" 
                  onClick={() => setIsEditingName(true)}
                />
              </>
            )}
          </div>
        </div>

        <div className="px-8 mb-7">
          <p className="text-[14px] text-wa-text-secondary leading-relaxed">
            Este no es un nombre de usuario ni un PIN. Este nombre será visible para tus contactos de Asicme Web.
          </p>
        </div>

        {/* Sección de Info */}
        <div className="bg-white px-8 py-4 shadow-sm">
          <label className="text-[14px] text-[#007bfc] mb-4 block">Info.</label>
          <div className="flex items-center justify-between group">
            {isEditingAbout ? (
              <div className="flex-1 flex items-center border-b-2 border-[#007bfc] pb-1">
                <input 
                  type="text" 
                  value={tempAbout}
                  onChange={(e) => setTempAbout(e.target.value)}
                  autoFocus
                  className="flex-1 outline-none text-[17px] bg-transparent"
                />
                <Check className="text-wa-teal cursor-pointer" onClick={saveAbout} />
              </div>
            ) : (
              <>
                <span className="text-[17px] text-wa-text-primary">{currentUser.about}</span>
                <Pencil 
                  size={20} 
                  className="text-wa-text-secondary cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" 
                  onClick={() => setIsEditingAbout(true)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
