import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, UserX, Eye, UserCircle, Info, Share2, ChevronRight } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PrivacySettings = () => {
  const { setView, privacySettings, updatePrivacySettings, blockedContacts } = useChatStore();

  const options = [
    { key: 'lastSeen', label: 'Hora de últ. vez', icon: <Eye size={20} /> },
    { key: 'profilePhoto', label: 'Foto de perfil', icon: <UserCircle size={20} /> },
    { key: 'about', label: 'Info.', icon: <Info size={20} /> },
    { key: 'status', label: 'Estado', icon: <Share2 size={20} /> },
  ];

  return (
    <motion.div 
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-0 z-50 bg-wa-bg flex flex-col"
    >
      <div className="h-[108px] bg-[#007bfc] flex items-end px-6 pb-4 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft 
            className="cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => setView('settings')} 
          />
          <h2 className="text-[19px] font-medium">Privacidad</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
        <div className="px-6 py-4">
          <h3 className="text-[#007bfc] text-[14px] font-medium uppercase mb-4">Quién puede ver mi información personal</h3>
          <p className="text-wa-text-secondary text-[13px] mb-6">Si no muestras la hora de tu últ. vez, no podrás ver la hora de últ. vez de los demás.</p>
        </div>

        <div className="bg-white shadow-sm mb-6">
          {options.map((opt) => (
            <div key={opt.key} className="px-6 py-4 flex items-center justify-between hover:bg-wa-hover cursor-pointer border-b border-wa-border last:border-none">
              <div className="flex items-center gap-4 text-wa-text-secondary">
                {opt.icon}
                <div className="flex flex-col">
                  <span className="text-wa-text-primary text-[16px]">{opt.label}</span>
                  <span className="text-wa-teal text-[13px] capitalize">
                    {(privacySettings as any)[opt.key] === 'everyone' ? 'Todos' : (privacySettings as any)[opt.key] === 'contacts' ? 'Mis contactos' : 'Nadie'}
                  </span>
                </div>
              </div>
              <select 
                value={(privacySettings as any)[opt.key]}
                onChange={(e) => updatePrivacySettings({ [opt.key]: e.target.value })}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                <option value="everyone">Todos</option>
                <option value="contacts">Mis contactos</option>
                <option value="nobody">Nadie</option>
              </select>
              <ChevronRight size={18} className="text-wa-text-secondary" />
            </div>
          ))}
        </div>

        <div className="bg-white shadow-sm mb-6">
          <div className="px-6 py-4 flex items-center justify-between hover:bg-wa-hover cursor-pointer">
            <div className="flex items-center gap-4 text-wa-text-secondary">
              <UserX size={20} />
              <div className="flex flex-col">
                <span className="text-wa-text-primary text-[16px]">Contactos bloqueados</span>
                <span className="text-wa-text-secondary text-[13px]">{blockedContacts.length} contactos</span>
              </div>
            </div>
            <ChevronRight size={18} className="text-wa-text-secondary" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
