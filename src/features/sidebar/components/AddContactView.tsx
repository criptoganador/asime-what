import React, { useState } from 'react';
import { ArrowLeft, User, Phone } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export const AddContactView = ({ onBack }: { onBack: () => void }) => {
      const { currentUser, fetchContacts } = useChatStore();
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+34');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const cleanPhone = phone.replace(/\s+/g, '');
      const fullPhone = `${countryCode}${cleanPhone}`;
      
      const res = await fetch(`http://localhost:3001/api/users/search?query=${encodeURIComponent(fullPhone)}&currentUserId=${currentUser?.id}`);
      const found = await res.json();
      
      if (found.length === 0) {
        setError('Este número no existe en la app.');
        setLoading(false);
        return;
      }

      await fetch('http://localhost:3001/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: currentUser?.id,
          contactId: found[0].id,
          nickname: name
        })
      });

      if (currentUser?.id) await fetchContacts(currentUser.id);
      setSuccess(true);
      setTimeout(onBack, 1000);
    } catch (err) {
      setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[999] bg-[#f0f2f5] flex flex-col">
      {/* Encabezado Azul Fuerte */}
      <div className="h-[110px] bg-[#005cb4] flex items-center px-6 text-white pt-10">
        <ArrowLeft className="cursor-pointer mr-4 w-6 h-6" onClick={onBack} />
        <h2 className="text-xl font-bold">Agregar nuevo contacto</h2>
      </div>

      <div className="p-8 flex-1">
        {success ? (
          <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <p className="text-green-600 font-bold text-lg">¡Guardado con éxito!</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-8 bg-white p-6 rounded-xl shadow-sm">
            <div className="border-b-2 border-gray-100 py-2">
              <label className="text-xs text-[#005cb4] font-bold uppercase">Nombre Completo</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent outline-none py-2 text-lg text-gray-800"
                placeholder="Ej: Mi Amigo"
                required
              />
            </div>

            <div className="border-b-2 border-gray-100 py-2">
              <label className="text-xs text-[#005cb4] font-bold uppercase">Número de Teléfono</label>
              <div className="flex gap-2 items-center">
                <select 
                  value={countryCode} 
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="bg-transparent outline-none py-2 text-lg text-gray-800 font-medium cursor-pointer border-r border-gray-100 pr-2"
                >
                  <option value="+34">🇪🇸 +34</option>
                  <option value="+58">🇻🇪 +58</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+52">🇲🇽 +52</option>
                  <option value="+54">🇦🇷 +54</option>
                  <option value="+57">🇨🇴 +57</option>
                </select>
                <input 
                  type="tel" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-transparent outline-none py-2 text-lg text-gray-800"
                  placeholder="000 000 000"
                  required
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#005cb4] text-white py-4 rounded-xl font-bold hover:bg-[#004a91] transition-colors shadow-md disabled:opacity-50"
            >
              {loading ? 'BUSCANDO...' : 'GUARDAR CONTACTO'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
