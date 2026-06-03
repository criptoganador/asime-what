import { motion } from 'framer-motion';
import { ArrowLeft, ShieldCheck, Lock, CheckCircle } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export const SecuritySettings = () => {
  const { setView } = useChatStore();

  return (
    <motion.div 
      initial={{ x: '-100%' }}
      animate={{ x: 0 }}
      exit={{ x: '-100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-full h-full absolute inset-0 z-50 bg-wa-bg flex flex-col overflow-hidden"
    >
      <div className="h-20 sm:h-[108px] bg-[#6366f1] flex items-end px-6 pb-4 text-white">
        <div className="flex items-center gap-6">
          <ArrowLeft 
            className="cursor-pointer hover:scale-110 transition-transform" 
            onClick={() => setView('settings')} 
          />
          <h2 className="text-[19px] font-medium">Seguridad</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-wa-bg">
        <div className="p-5 sm:p-8 flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-[#6366f1]/10 rounded-full flex items-center justify-center text-[#6366f1] mb-6">
            <ShieldCheck size={48} />
          </div>
          <h3 className="text-lg font-bold text-wa-text-primary mb-2">Tu privacidad es nuestra prioridad</h3>
          <p className="text-wa-text-secondary text-sm leading-relaxed">
            Asicme Chat protege tus conversaciones con cifrado de extremo a extremo. Esto significa que tus mensajes y llamadas quedan entre tú y la persona con quien te comunicas.
          </p>
        </div>

        <div className="bg-white shadow-sm mb-6">
          <div className="px-6 py-4 flex items-center gap-4">
            <Lock className="text-wa-text-secondary" size={20} />
            <div className="flex-1">
              <span className="text-wa-text-primary text-[16px] block">Cifrado de extremo a extremo</span>
              <span className="text-wa-text-secondary text-[13px]">Tus mensajes y llamadas son seguros.</span>
            </div>
            <CheckCircle className="text-wa-teal" size={20} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
