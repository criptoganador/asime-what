import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, File as FileIcon, Music } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface PendingMedia {
  id: string;
  file: File;
  type: 'image' | 'video' | 'file' | 'audio';
  url: string;
  caption: string;
}

interface MediaPreviewModalProps {
  media: PendingMedia[];
  onSend: (media: PendingMedia[]) => void;
  onCancel: () => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({ media, onSend, onCancel }) => {
  const [items, setItems] = useState<PendingMedia[]>(media);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentItem = items[activeIndex];

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [activeIndex, currentItem?.caption]);

  const handleRemove = (id: string) => {
    const itemToRemove = items.find(m => m.id === id);
    if (itemToRemove) {
      URL.revokeObjectURL(itemToRemove.url); // Liberar RAM inmediatamente
    }
    
    const newItems = items.filter(m => m.id !== id);
    if (newItems.length === 0) {
      onCancel();
    } else {
      setItems(newItems);
      if (activeIndex >= newItems.length) {
        setActiveIndex(newItems.length - 1);
      }
    }
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setItems(prev => prev.map((item, idx) => 
      idx === activeIndex ? { ...item, caption: e.target.value } : item
    ));
  };

  const handleCancelClick = () => {
    // Solución al Memory Leak: Revocar todos los object URLs al cancelar el modal entero
    items.forEach(item => URL.revokeObjectURL(item.url));
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(items);
    }
  };

  if (!currentItem) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 z-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <button 
          onClick={handleCancelClick}
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex items-center justify-center relative px-4 sm:px-12 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentItem.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex items-center justify-center max-h-[70vh]"
          >
            {currentItem.type === 'image' && (
              <img src={currentItem.url} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            )}
            {currentItem.type === 'video' && (
              <video src={currentItem.url} controls playsInline className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
            )}
            {currentItem.type === 'audio' && (
              <div className="flex flex-col items-center justify-center bg-white/5 p-8 rounded-3xl border border-white/10 w-full max-w-sm shadow-2xl">
                <div className="w-20 h-20 bg-wa-teal rounded-full flex items-center justify-center mb-6 shadow-[0_4px_20px_rgba(0,168,132,0.4)]">
                  <Music size={40} className="text-white" />
                </div>
                <span className="text-white font-medium text-lg text-center break-all mb-4">{currentItem.file.name}</span>
                <audio src={currentItem.url} controls className="w-full" />
              </div>
            )}
            {currentItem.type === 'file' && (
              <div className="flex flex-col items-center justify-center bg-white/5 p-12 rounded-2xl border border-white/10">
                <FileIcon size={80} className="text-wa-teal mb-4" />
                <span className="text-white font-medium text-lg text-center break-all">{currentItem.file.name}</span>
                <span className="text-white/60 text-sm mt-2">{(currentItem.file.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Area */}
      <div className="p-4 sm:p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        
        {/* Caption Input */}
        <div className="w-full max-w-2xl relative flex items-center bg-white/10 rounded-2xl px-4 py-3 shadow-lg border border-white/20 focus-within:border-wa-teal focus-within:bg-white/15 transition-all">
          <textarea 
            ref={textareaRef}
            placeholder="Añade un comentario..."
            value={currentItem.caption}
            onChange={handleCaptionChange}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ minHeight: '24px', maxHeight: '100px' }}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/50 text-[15px] resize-none overflow-y-auto scrollbar-hide"
          />
        </div>

        {/* Carousel & Actions */}
        <div className="w-full flex items-center justify-between gap-4 max-w-4xl">
          <div className="flex-1 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {items.map((item, idx) => (
              <div 
                key={item.id} 
                className={cn(
                  "relative w-14 h-14 rounded-lg overflow-hidden shrink-0 cursor-pointer transition-all border-2",
                  activeIndex === idx ? "border-wa-teal scale-110" : "border-transparent opacity-60 hover:opacity-100"
                )}
                onClick={() => setActiveIndex(idx)}
              >
                {item.type === 'image' || item.type === 'video' ? (
                  <img src={item.url} alt="thumbnail" className="w-full h-full object-cover" />
                ) : item.type === 'audio' ? (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <Music size={20} className="text-white/80" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <FileIcon size={20} className="text-white/80" />
                  </div>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }}
                  className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5 text-white hover:bg-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <button 
            onClick={() => onSend(items)}
            className="w-14 h-14 bg-wa-teal hover:bg-[#00a884] rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(0,168,132,0.4)] hover:scale-105 transition-transform shrink-0"
          >
            <Send size={24} className="ml-1" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
