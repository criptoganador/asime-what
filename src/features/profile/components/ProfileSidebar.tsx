import React, { useState } from 'react';
import { ArrowLeft, Camera, Pencil, Check } from 'lucide-react';
import { useChatStore } from '../../sidebar/store/useChatStore';

export const ProfileSidebar = () => {
  const { setView } = useChatStore();
  const [name, setName] = useState('AsicMe Studio');
  const [about, setAbout] = useState('Construyendo el futuro de la tecnología 🚀');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAbout, setIsEditingAbout] = useState(false);

  return (
    <div className="w-[400px] h-full flex flex-col bg-wa-bg border-r border-wa-border overflow-hidden animate-in fade-in slide-in-from-left-4 duration-300">
      {/* Header */}
      <div className="h-[108px] bg-wa-nav-rail flex items-end px-6 pb-5 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft 
            size={24} 
            className="cursor-pointer hover:opacity-70 transition-opacity" 
            onClick={() => setView('chats')}
          />
          <h1 className="text-[19px] font-medium">Perfil</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-wa-bg scrollbar-hide">
        {/* Profile Picture */}
        <div className="flex justify-center py-8">
          <div className="relative group cursor-pointer">
            <div className="w-[200px] h-[200px] rounded-full overflow-hidden">
              <img 
                src="https://i.pravatar.cc/300?u=me" 
                className="w-full h-full object-cover" 
                alt="Perfil" 
              />
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-center px-4">
              <Camera size={32} className="mb-2" />
              <span className="text-[13px] font-medium uppercase">Cambiar foto de perfil</span>
            </div>
          </div>
        </div>

        {/* Name Section */}
        <div className="bg-white px-8 py-4 shadow-sm mb-7">
          <label className="text-[14px] text-wa-teal font-medium block mb-4">Tu nombre</label>
          <div className="flex items-center justify-between">
            {isEditingName ? (
              <div className="flex-1 flex items-center border-b-2 border-wa-teal pb-1">
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  className="w-full outline-none text-[17px] text-wa-text-primary"
                />
                <Check 
                  size={20} 
                  className="text-wa-text-secondary cursor-pointer hover:text-wa-teal" 
                  onClick={() => setIsEditingName(false)}
                />
              </div>
            ) : (
              <>
                <span className="text-[17px] text-wa-text-primary">{name}</span>
                <Pencil 
                  size={20} 
                  className="text-wa-text-secondary cursor-pointer hover:text-wa-teal" 
                  onClick={() => setIsEditingName(true)}
                />
              </>
            )}
          </div>
          <p className="mt-6 text-[14px] text-wa-text-secondary leading-relaxed">
            Este no es un nombre de usuario ni un PIN. Este nombre será visible para tus contactos de WhatsApp.
          </p>
        </div>

        {/* About Section */}
        <div className="bg-white px-8 py-4 shadow-sm">
          <label className="text-[14px] text-wa-teal font-medium block mb-4">Info.</label>
          <div className="flex items-center justify-between">
            {isEditingAbout ? (
              <div className="flex-1 flex items-center border-b-2 border-wa-teal pb-1">
                <input 
                  type="text" 
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  autoFocus
                  className="w-full outline-none text-[17px] text-wa-text-primary"
                />
                <Check 
                  size={20} 
                  className="text-wa-text-secondary cursor-pointer hover:text-wa-teal" 
                  onClick={() => setIsEditingAbout(false)}
                />
              </div>
            ) : (
              <>
                <span className="text-[17px] text-wa-text-primary">{about}</span>
                <Pencil 
                  size={20} 
                  className="text-wa-text-secondary cursor-pointer hover:text-wa-teal" 
                  onClick={() => setIsEditingAbout(true)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
