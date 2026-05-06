import React, { useState } from 'react';
import { Plus, MoreVertical, Camera, Pencil, X, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useChatStore } from '../../sidebar/store/useChatStore';
import { uploadImage } from '../../../utils/upload';
import { TextStatusEditor } from './TextStatusEditor';
import { StatusViewer } from './StatusViewer';
import { AnimatePresence } from 'framer-motion';
import { GroupedStatus } from '../../sidebar/store/useChatStore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const StatusSidebar = () => {
  const { currentUser, updateProfile, statuses, fetchStatuses, createStatus } = useChatStore();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const statusInputRef = React.useRef<HTMLInputElement>(null);

  console.log('Statuses in Sidebar:', statuses);

  const myGroup = statuses.find(s => s.userId === currentUser?.id);
  const hasMyStatus = myGroup && myGroup.statuses.length > 0;

  React.useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    avatarInputRef.current?.click();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const imageUrl = await uploadImage(file);
        await updateProfile({ avatar: imageUrl });
      } catch (error) {
        alert('Error al subir el avatar');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleStatusImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const imageUrl = await uploadImage(file);
        await createStatus({
          type: 'image',
          content: imageUrl
        });
      } catch (error) {
        alert('Error al publicar el estado');
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="w-[400px] h-full flex flex-col bg-wa-sidebar border-r border-wa-border overflow-hidden relative">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center bg-wa-sidebar">
        <h1 className="text-xl font-bold text-wa-text-primary">Estados</h1>
        <div className="flex gap-4 text-wa-text-secondary">
          <MoreVertical size={20} className="cursor-pointer hover:bg-wa-hover rounded-full transition-colors" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* My Status */}
        <div 
          onClick={() => {
            if (hasMyStatus) setSelectedGroup(myGroup);
            else setShowCreateMenu(!showCreateMenu);
          }}
          className="px-4 py-3 flex items-center hover:bg-wa-hover cursor-pointer transition-colors mt-2"
        >
          <div className="relative group" onClick={handleAvatarClick}>
            <input 
              type="file" 
              ref={avatarInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleAvatarUpload} 
            />
            <input 
              type="file" 
              ref={statusInputRef} 
              className="hidden" 
              accept="image/*,video/*" 
              onChange={handleStatusImageUpload} 
            />
            <div className="w-12 h-12 rounded-full overflow-hidden relative">
              <img 
                src={currentUser?.avatar || "https://i.pravatar.cc/150?u=me"} 
                className={cn("w-full h-full object-cover transition-opacity", isUploading && "opacity-50")} 
                alt="Mi estado" 
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 size={20} className="text-wa-teal animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={16} className="text-white" />
              </div>
            </div>
            <div className={cn(
              "absolute bottom-0 right-0 rounded-full p-0.5 border-2 border-white transition-all duration-300 z-10",
              showCreateMenu ? "bg-red-500 rotate-45" : "bg-wa-green rotate-0"
            )}>
              <Plus size={14} className="text-white" />
            </div>
          </div>
          <div className="ml-4">
            <h3 className="text-[17px] font-medium text-wa-text-primary leading-tight">Mi estado</h3>
            <p className="text-[14px] text-wa-text-secondary">
              {hasMyStatus 
                ? `Último hoy a las ${new Date(myGroup.statuses[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : "Añade una actualización"}
            </p>
          </div>
        </div>

        {/* Floating Creation Menu */}
        {showCreateMenu && (
          <div className="mx-4 mb-2 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200">
            <div 
              onClick={() => { setShowTextEditor(true); setShowCreateMenu(false); }}
              className="flex items-center gap-3 p-3 bg-wa-bg rounded-xl hover:bg-wa-hover cursor-pointer transition-all border border-wa-border shadow-sm"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white">
                <Pencil size={20} />
              </div>
              <span className="text-[15px] font-medium text-wa-text-primary">Estado de texto</span>
            </div>
            <div 
              onClick={() => { statusInputRef.current?.click(); setShowCreateMenu(false); }}
              className="flex items-center gap-3 p-3 bg-wa-bg rounded-xl hover:bg-wa-hover cursor-pointer transition-all border border-wa-border shadow-sm"
            >
              <div className="w-10 h-10 bg-wa-green rounded-full flex items-center justify-center text-white">
                <Camera size={20} />
              </div>
              <span className="text-[15px] font-medium text-wa-text-primary">Fotos y videos</span>
            </div>
          </div>
        )}

        {/* Section Title */}
        <div className="px-6 py-4">
          <h2 className="text-[14px] text-wa-teal font-medium uppercase tracking-wider">Recientes</h2>
        </div>

        {/* Real Statuses */}
        {statuses.length === 0 ? (
          <div className="px-8 py-4 text-center text-wa-text-secondary text-sm">
            No hay actualizaciones recientes
          </div>
        ) : (
          statuses.map((group) => (
            <div 
              key={group.userId} 
              onClick={() => setSelectedGroup(group)}
              className="px-4 py-3 flex items-center hover:bg-wa-hover cursor-pointer transition-colors"
            >
              <div className="relative p-[2px] rounded-full border-2 border-wa-green border-solid">
                <img 
                  src={group.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(group.userName)}`} 
                  className="w-11 h-11 rounded-full object-cover border-2 border-white" 
                  alt="" 
                />
              </div>
              <div className="ml-4 flex-1 border-b border-wa-border pb-3">
                <h3 className="text-[17px] font-medium text-wa-text-primary leading-tight">{group.userName}</h3>
                <p className="text-[14px] text-wa-text-secondary">
                  {new Date(group.statuses[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showTextEditor && <TextStatusEditor onClose={() => setShowTextEditor(false)} />}
        {selectedGroup && <StatusViewer group={selectedGroup} onClose={() => setSelectedGroup(null)} />}
      </AnimatePresence>
    </div>
  );
};
