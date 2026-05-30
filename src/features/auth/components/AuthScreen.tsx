import React from 'react';
import { motion } from 'framer-motion';
import { BiometricAuth } from './BiometricAuth';

export const AuthScreen = () => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#f0f2f5] p-4">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 w-full h-[220px] bg-[#6366f1] shadow-lg"></div>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-full max-w-[450px] max-h-[100%] bg-white shadow-2xl rounded-2xl overflow-y-auto flex flex-col min-h-fit sm:min-h-[520px] custom-scrollbar"
      >
        <div className="p-6 sm:p-10 text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-wa-border p-1 overflow-hidden">
            <img src="/favicon.png" alt="Asicme Chat Logo" className="w-full h-full object-cover rounded-xl" />
          </div>
          <h2 className="text-[32px] font-bold text-[#6366f1] mb-1 tracking-tight">Asicme Chat</h2>
          <p className="text-wa-text-secondary text-[15px]">Inicio sin contraseñas</p>
        </div>

        <div className="flex-1 px-6 sm:px-10 pb-6 sm:pb-10 flex flex-col">
          <BiometricAuth />
        </div>
      </motion.div>
    </div>
  );
};
