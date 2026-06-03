import React, { useState } from 'react';
import { ArrowLeft, Search, UserPlus, Loader2, User, Check } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { API_URL } from '../../../config';

export const AddContactView = ({ onBack }: { onBack: () => void }) => {
  const { currentUser, fetchContacts, contacts } = useChatStore();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setLoading(true);
    setError('');
    setResults([]);
    
    try {
      const res = await fetch(`${API_URL}/api/users/search?query=${encodeURIComponent(query.trim())}&currentUserId=${currentUser?.id}`);
      if (!res.ok) throw new Error('Error al buscar usuarios');
      const found = await res.json();
      
      if (found.length === 0) {
        setError('No encontramos a nadie con ese nombre o usuario.');
      } else {
        setResults(found);
      }
    } catch (err) {
      setError('Error de conexión al buscar.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (contactUser: any) => {
    // Verificar si ya es contacto de forma segura
    const safeContacts = Array.isArray(contacts) ? contacts : [];
    if (safeContacts.some(c => c.contactId === contactUser.id)) {
      alert('Este usuario ya está en tus contactos.');
      return;
    }

    setAddingId(contactUser.id);
    try {
      const res = await fetch(`${API_URL}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: currentUser?.id,
          contactId: contactUser.id,
          nickname: contactUser.name // Por defecto guardamos su nombre real
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al agregar en el servidor');
      }

      if (currentUser?.id) {
        await fetchContacts(currentUser.id);
      }
      
      // onBack(); // Removemos auto-cierre para mejor UX
    } catch (err: any) {
      alert(err.message || 'Error al agregar contacto.');
    } finally {
      setAddingId(null);
    }
  };

  const safeContacts = Array.isArray(contacts) ? contacts : [];

  return (
    <div 
      className="w-full h-full absolute inset-0 z-[100] bg-[#f0f2f5] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="h-[80px] sm:h-[108px] bg-[#6366f1] flex items-end px-4 sm:px-6 pb-4 text-white shadow-md z-10 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-[19px] font-semibold">Buscar Contacto</h2>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
        {/* Barra de Búsqueda */}
        <form onSubmit={handleSearch} className="mb-6 relative shrink-0">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por @username o Nombre..."
            className="w-full bg-white border-none shadow-sm focus:ring-2 focus:ring-[#6366f1] outline-none py-3.5 pl-12 pr-12 rounded-xl text-[16px] text-slate-800 transition-all duration-300 placeholder-slate-400"
          />
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <button 
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-2 bg-[#6366f1] text-white p-1.5 rounded-lg hover:bg-[#4f46e5] transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 text-red-500 p-4 rounded-xl text-sm font-medium text-center border border-red-100 mb-4 shrink-0">
            {error}
          </div>
        )}

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-2xl shadow-sm border border-slate-100">
          {results.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {results.map((user) => (
                <div key={user.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="text-indigo-400" size={24} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 text-[15px] truncate">{user.name}</h4>
                    <p className="text-[13px] text-[#6366f1] font-medium truncate">@{user.username}</p>
                  </div>
                  <button 
                    onClick={() => handleAdd(user)}
                    disabled={addingId === user.id || safeContacts.some(c => c.contactId === user.id)}
                    className="flex-shrink-0 w-10 h-10 bg-indigo-50 text-[#6366f1] rounded-full flex items-center justify-center hover:bg-[#6366f1] hover:text-white transition-colors disabled:opacity-50 disabled:bg-green-50 disabled:text-green-500"
                  >
                    {addingId === user.id ? <Loader2 size={20} className="animate-spin" /> : safeContacts.some(c => c.contactId === user.id) ? <Check size={20} className="text-green-500" /> : <UserPlus size={20} />}
                  </button>
                </div>
              ))}
            </div>
          ) : !loading && query && !error ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center gap-3">
              <Search size={48} className="text-slate-200" />
              <p>No encontramos a nadie. Verifica el nombre o el username.</p>
            </div>
          ) : !query && !loading ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center gap-3">
              <UserPlus size={48} className="text-slate-200" />
              <p>Escribe un nombre o @username arriba para buscar nuevos amigos.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
