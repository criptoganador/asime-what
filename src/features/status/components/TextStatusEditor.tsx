import React, { useState } from 'react';
import { X, Send, Palette } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChatStore } from '../../sidebar/store/useChatStore';

const BACKGROUND_COLORS = [
  '#6b21a8', // Purple
  '#1e40af', // Blue
  '#b91c1c', // Red
  '#15803d', // Green
  '#a16207', // Orange
  '#4c1d95', // Dark Purple
  '#0f172a', // Slate
];

interface TextStatusEditorProps {
  onClose: () => void;
}

export const TextStatusEditor = ({ onClose }: TextStatusEditorProps) => {
  const [text, setText] = useState('');
  const [bgColorIndex, setBgColorIndex] = useState(0);
  const { createStatus } = useChatStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSend = async () => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      await createStatus({
        type: 'text',
        content: text,
        backgroundColor: BACKGROUND_COLORS[bgColorIndex]
      });
      onClose();
    } catch (error) {
      alert('Error al publicar el estado');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cycleColor = () => {
    setBgColorIndex((prev) => (prev + 1) % BACKGROUND_COLORS.length);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: BACKGROUND_COLORS[bgColorIndex] }}
    >
      <div className="flex justify-between items-center p-6 text-white">
        <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors">
          <X size={24} />
        </button>
        <div className="flex gap-4">
          <button onClick={cycleColor} className="hover:bg-white/10 p-2 rounded-full transition-colors">
            <Palette size={24} />
          </button>
          <button 
            onClick={handleSend} 
            disabled={!text.trim() || isSubmitting}
            className="bg-white text-black p-2 rounded-full disabled:opacity-50 transition-all hover:scale-110 active:scale-95"
          >
            <Send size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un estado"
          className="bg-transparent border-none outline-none text-white text-3xl text-center w-full max-h-[50%] resize-none placeholder:text-white/50"
          maxLength={700}
        />
      </div>
    </motion.div>
  );
};
