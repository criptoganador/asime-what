import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Status, GroupedStatus } from '../../sidebar/store/useChatStore';

interface StatusViewerProps {
  group: GroupedStatus;
  onClose: () => void;
}

export const StatusViewer = ({ group, onClose }: StatusViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentStatus = group.statuses[currentIndex];

  // Auto-advance logic (5 seconds per status)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentIndex < group.statuses.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onClose();
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [currentIndex, group.statuses.length, onClose]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < group.statuses.length - 1) setCurrentIndex(prev => prev + 1);
    else onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Progress Bars */}
      <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
        {group.statuses.map((_, idx) => (
          <div key={idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: idx === currentIndex ? '100%' : idx < currentIndex ? '100%' : '0%' }}
              transition={{ duration: idx === currentIndex ? 5 : 0, ease: 'linear' }}
              className="h-full bg-white"
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-10 text-white">
        <div className="flex items-center gap-3">
          <img src={group.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.userName)}`} className="w-10 h-10 rounded-full" alt="" />
          <div>
            <h3 className="font-bold">{group.userName}</h3>
            <p className="text-xs opacity-70">{new Date(currentStatus.createdAt).toLocaleTimeString()}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="w-full h-full flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStatus.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="w-full h-full flex items-center justify-center p-8"
            style={{ backgroundColor: currentStatus.type === 'text' ? (currentStatus.backgroundColor || '#6b21a8') : 'transparent' }}
          >
            {currentStatus.type === 'text' ? (
              <p className="text-white text-3xl text-center max-w-lg font-medium whitespace-pre-wrap">
                {currentStatus.content}
              </p>
            ) : (
              <img src={currentStatus.content} className="max-w-full max-h-full object-contain" alt="" />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Overlays */}
        <div className="absolute inset-y-0 left-0 w-1/4 cursor-pointer" onClick={handlePrev} />
        <div className="absolute inset-y-0 right-0 w-1/4 cursor-pointer" onClick={handleNext} />
      </div>
    </motion.div>
  );
};
