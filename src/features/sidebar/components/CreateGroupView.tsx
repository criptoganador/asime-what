import React, { useState } from 'react';
import { ArrowLeft, Camera, User, Check, Loader2 } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export const CreateGroupView = ({ onBack }: { onBack: () => void }) => {
  const { contacts, createGroup } = useChatStore();
  const [step, setStep] = useState<'info' | 'members'>('info');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatar(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedContacts.length === 0) return;
    setIsCreating(true);
    try {
      await createGroup(
        name,
        avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`,
        description,
        selectedContacts
      );
      onBack();
    } catch (error) {
      alert('Error al crear el grupo');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden">
      {/* Header simplificado para S8 */}
      <div className="h-[70px] bg-[#6366f1] flex items-center px-4 text-white shrink-0 shadow-sm">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="ml-4">
          <h2 className="text-[18px] font-semibold">
            {step === 'info' ? 'Nuevo Grupo' : 'Añadir Miembros'}
          </h2>
          {step === 'members' && (
            <p className="text-[12px] opacity-90">{selectedContacts.length} seleccionados</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {step === 'info' ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div
                className="relative w-28 h-28 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 cursor-pointer"
                onClick={() => document.getElementById('group-avatar')?.click()}
              >
                {avatar ? (
                  <img src={avatar} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="text-slate-400" size={32} />
                )}
                <input type="file" id="group-avatar" hidden accept="image/*" onChange={handleImageUpload} />
              </div>
              <p className="text-xs text-slate-500 font-medium tracking-wide">FOTO DEL GRUPO</p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del grupo"
                className="w-full border-b-2 border-slate-200 focus:border-[#6366f1] outline-none py-3 text-[17px] transition-all"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción (opcional)"
                className="w-full border-b-2 border-slate-200 focus:border-[#6366f1] outline-none py-3 text-[15px] text-slate-500 transition-all"
              />
            </div>

            <button
              disabled={!name.trim()}
              onClick={() => setStep('members')}
              className="w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 transition-all active:scale-95"
            >
              SIGUIENTE
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-1 mb-4">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => toggleContact(contact.contactId)}
                  className="flex items-center gap-4 p-3 hover:bg-slate-50 cursor-pointer rounded-xl transition-colors"
                >
                  <div className="relative">
                    <img src={contact.user.avatar} className="w-12 h-12 rounded-full object-cover" alt="" />
                    {selectedContacts.includes(contact.contactId) && (
                      <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border-2 border-white">
                        <Check size={12} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{contact.nickname || contact.user.name}</p>
                    <p className="text-xs text-slate-400">@{contact.user.phone}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled={selectedContacts.length === 0 || isCreating}
              onClick={handleCreate}
              className="w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreating ? <Loader2 className="animate-spin" /> : <Check size={20} />}
              CREAR GRUPO
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
