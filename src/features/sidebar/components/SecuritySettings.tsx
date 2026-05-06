import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, Key, Smartphone, Lock, CheckCircle } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SecuritySettings = () => {
  const { setView } = useChatStore();
  const [twoStepEnabled, setTwoStepEnabled] = useState(false);

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
          <h2 className="text-[19px] font-medium">Seguridad</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-[#007bfc]/10 rounded-full flex items-center justify-center text-[#007bfc] mb-6">
            <ShieldCheck size={48} />
          </div>
          <h3 className="text-lg font-bold text-wa-text-primary mb-2">Tu privacidad es nuestra prioridad</h3>
          <p className="text-wa-text-secondary text-sm leading-relaxed">
            Asicme Web protege tus conversaciones con cifrado de extremo a extremo. Esto significa que tus mensajes y llamadas quedan entre tú y la persona con quien te comunicas.
          </p>
        </div>

        <div className="bg-white shadow-sm mb-6">
          <div className="px-6 py-4 flex items-center gap-4 border-b border-wa-border">
            <Lock className="text-wa-text-secondary" size={20} />
            <div className="flex-1">
              <span className="text-wa-text-primary text-[16px] block">Cifrado de extremo a extremo</span>
              <span className="text-wa-text-secondary text-[13px]">Tus mensajes y llamadas son seguros.</span>
            </div>
            <CheckCircle className="text-wa-teal" size={20} />
          </div>

          <div 
            onClick={() => setTwoStepEnabled(!twoStepEnabled)}
            className="px-6 py-4 flex items-center gap-4 hover:bg-wa-hover cursor-pointer transition-colors"
          >
            <Key className="text-wa-text-secondary" size={20} />
            <div className="flex-1">
              <span className="text-wa-text-primary text-[16px] block">Verificación en dos pasos</span>
              <span className="text-wa-text-secondary text-[13px]">
                {twoStepEnabled ? 'Activado' : 'Añade más seguridad a tu cuenta.'}
              </span>
            </div>
            <div className={cn(
              "w-10 h-5 rounded-full relative transition-colors",
              twoStepEnabled ? "bg-wa-teal" : "bg-gray-300"
            )}>
              <div className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-md",
                twoStepEnabled ? "left-5.5" : "left-0.5"
              )} />
            </div>
          </div>
        </div>

        <div className="bg-white shadow-sm">
          <div className="px-6 py-4 flex items-center gap-4">
            <Smartphone className="text-wa-text-secondary" size={20} />
            <div className="flex-1">
              <span className="text-wa-text-primary text-[16px] block">Cambiar número</span>
              <span className="text-wa-text-secondary text-[13px]">Migra tu cuenta y ajustes a un nuevo número.</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
