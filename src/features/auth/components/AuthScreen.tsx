import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../sidebar/store/useChatStore';
import { Phone, Check, ArrowRight, User, Camera, ShieldCheck, Copy, CheckCircle2, X, ChevronDown, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AuthStep = 'phone' | 'otp' | 'profile';

export const AuthScreen = () => {
  const [step, setStep] = useState<AuthStep>('phone');
  const [countryCode, setCountryCode] = useState('+34');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [generatedCode, setGeneratedCode] = useState('');
  const [name, setName] = useState('');
  const [about, setAbout] = useState('¡Hola! Estoy usando Asicme Web.');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);

  const { login, checkUser } = useChatStore();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Validación inteligente del número de teléfono
  useEffect(() => {
    const cleanPhone = phone.replace(/\s+/g, '');
    if (cleanPhone.length >= 8) {
      const timer = setTimeout(async () => {
        setIsChecking(true);
        const fullPhone = `${countryCode}${cleanPhone}`;
        try {
          const user = await checkUser(fullPhone);
          setUserExists(!!user);
        } catch (error) {
          setUserExists(null);
        } finally {
          setIsChecking(false);
        }
      }, 500); // Debounce de 500ms
      return () => clearTimeout(timer);
    } else {
      setUserExists(null);
      setIsChecking(false);
    }
  }, [phone, countryCode, checkUser]);

  const handleSendCode = () => {
    // Limpiar el número de espacios o guiones
    const cleanPhone = phone.replace(/\s+/g, '');
    if (cleanPhone.length < 7) return;

    const fullPhone = `${countryCode}${cleanPhone}`;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setStep('otp');
    setTimeout(() => setShowToast(true), 500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasteData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pasteData)) {
      const newOtp = [...otp];
      pasteData.split('').forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      const lastIndex = Math.min(pasteData.length, 5);
      document.getElementById(`otp-${lastIndex}`)?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.join('') === generatedCode) {
      setShowToast(false);
      const fullPhone = `${countryCode}${phone.replace(/\s+/g, '')}`;

      // Validar si el usuario ya existe en la BD
      const existingUser = await useChatStore.getState().checkUser(fullPhone);

      if (existingUser) {
        // Si ya existe, iniciamos sesión directamente con sus datos
        login(existingUser);
      } else {
        // Si no existe, vamos al paso de perfil (registro)
        setStep('profile');
      }
    } else {
      alert('Código incorrecto. Inténtalo de nuevo.');
    }
  };

  const handleFinish = () => {
    if (!name.trim()) return;
    const cleanPhone = phone.replace(/\s+/g, '');
    login({
      name: name.trim(),
      phone: `${countryCode}${cleanPhone}`,
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=007bfc&color=fff`,
      about: about
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#f0f2f5]">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 w-full h-[220px] bg-[#007bfc] shadow-lg"></div>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>
      </div>

      {/* Toast de Simulación de SMS */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-[110] bg-white shadow-2xl rounded-2xl p-4 border-l-4 border-[#007bfc] flex items-center gap-4 w-[90vw] max-w-[380px] cursor-pointer group"
            onClick={handleCopyCode}
          >
            <div className="w-10 h-10 bg-[#007bfc]/10 rounded-full flex items-center justify-center text-[#007bfc]">
              <ShieldCheck size={24} />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-wa-text-secondary font-bold uppercase tracking-widest">Seguridad Asicme</p>
              <p className="text-[15px] text-wa-text-primary">Código: <span className="font-bold text-[#007bfc] text-lg">{generatedCode}</span></p>
            </div>
            <div className="flex items-center gap-2 text-[#007bfc]">
              {isCopied ? <CheckCircle2 size={20} className="text-wa-green" /> : <Copy size={20} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
              <span className="text-[12px] font-medium">{isCopied ? '¡Copiado!' : 'Copiar'}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-[95vw] max-w-[450px] bg-white shadow-2xl rounded-2xl overflow-hidden flex flex-col min-h-[480px] sm:min-h-[520px]"
      >
        <div className="p-6 sm:p-10 text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-wa-border p-1 overflow-hidden">
            <img src="/favicon.png" alt="Asicme Logo" className="w-full h-full object-cover rounded-xl" />
          </div>
          <h2 className="text-[32px] font-bold text-[#007bfc] mb-1 tracking-tight">Asicme Web</h2>
          <p className="text-wa-text-secondary text-[15px]">Conectando tu mundo con estilo</p>
        </div>

        <div className="flex-1 px-6 sm:px-10 pb-6 sm:pb-10 flex flex-col">
          <AnimatePresence mode="wait">
            {step === 'phone' && (
              <motion.div key="phone" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col gap-6">
                <div className="space-y-4">
                  <label className="text-[12px] text-[#007bfc] font-bold uppercase tracking-widest">Número de teléfono</label>
                  <div className="flex gap-2">
                    <div className="relative group min-w-[100px]">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="w-full bg-wa-bg border-b-2 border-transparent focus:border-[#007bfc] outline-none py-3.5 px-3 text-[17px] rounded-t-xl transition-all appearance-none cursor-pointer font-medium"
                      >
                        <option value="+34">🇪🇸 +34</option>
                        <option value="+58">🇻🇪 +58</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+52">🇲🇽 +52</option>
                        <option value="+54">🇦🇷 +54</option>
                        <option value="+57">🇨🇴 +57</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-wa-text-secondary" />
                    </div>
                    <div className="relative group flex-1">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-wa-text-secondary group-focus-within:text-[#007bfc] transition-colors"><Phone size={20} /></div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="Número de móvil"
                        className="w-full bg-wa-bg border-b-2 border-transparent focus:border-[#007bfc] outline-none py-3.5 pl-12 pr-12 text-[18px] rounded-t-xl transition-all"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {isChecking ? (
                          <Loader2 size={18} className="text-[#007bfc] animate-spin" />
                        ) : userExists ? (
                          <div className="flex items-center gap-2 animate-in zoom-in duration-300">
                            <CheckCircle2 size={18} className="text-wa-green" />
                            <span className="text-[10px] font-bold text-wa-green uppercase">Registrado</span>
                          </div>
                        ) : userExists === false ? (
                          <div className="flex items-center gap-2 animate-in zoom-in duration-300">
                            <User size={18} className="text-wa-text-secondary" />
                            <span className="text-[10px] font-bold text-wa-text-secondary uppercase">Nuevo</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <p className="text-[12px] text-wa-text-secondary leading-relaxed">
                    {userExists
                      ? "¡Bienvenido de nuevo! Haz clic en Entrar para continuar."
                      : "Te enviaremos un código de seguridad para verificar tu identidad."}
                  </p>
                </div>
                <button onClick={handleSendCode} disabled={phone.length < 8 || isChecking} className="mt-4 w-full bg-[#007bfc] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#005bb5] transition-all disabled:opacity-50 flex items-center justify-center gap-3 group">
                  {userExists ? 'ENTRAR' : 'ENVIAR CÓDIGO'}
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col gap-8 text-center">
                <div className="space-y-2">
                  <p className="text-[15px] text-wa-text-primary">Verificación de seguridad</p>
                  <p className="text-[13px] text-wa-text-secondary">Pega el código recibido o escríbelo</p>
                </div>
                <div className="flex justify-center gap-3">
                  {otp.map((digit, i) => (
                    <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={digit} onPaste={handlePaste} onChange={(e) => handleOtpChange(i, e.target.value)} className="w-10 h-14 sm:w-12 sm:h-16 bg-wa-bg border-b-2 border-wa-border focus:border-[#007bfc] outline-none text-center text-xl sm:text-2xl font-bold rounded-t-xl transition-all shadow-sm" />
                  ))}
                </div>
                <button onClick={handleVerifyOtp} disabled={otp.some(d => !d)} className="mt-2 w-full bg-[#007bfc] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#005bb5] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                  VERIFICAR AHORA
                  <Check size={20} />
                </button>
              </motion.div>
            )}

            {step === 'profile' && (
              <motion.div key="profile" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-4 mb-4">
                  <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload')?.click()}>
                    <input type="file" id="avatar-upload" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <div className="w-32 h-32 bg-wa-bg rounded-full flex items-center justify-center text-wa-text-secondary overflow-hidden border-2 border-wa-border group-hover:border-[#007bfc] transition-all shadow-inner">
                      {avatar ? <img src={avatar} alt="Preview" className="w-full h-full object-cover" /> : <User size={64} />}
                    </div>
                    <div className="absolute bottom-1 right-1 w-10 h-10 bg-[#007bfc] text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Camera size={20} /></div>
                  </div>
                  <p className="text-[13px] text-wa-text-secondary font-medium">Personaliza tu perfil</p>
                </div>
                <div className="space-y-5">
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="¿Cómo te llamas?" className="w-full border-b-2 border-wa-border focus:border-[#007bfc] outline-none py-2.5 text-[18px] transition-all" />
                  <input type="text" value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Tu estado actual" className="w-full border-b-2 border-wa-border focus:border-[#007bfc] outline-none py-2.5 text-[15px] text-wa-text-secondary transition-all" />
                </div>
                <button onClick={handleFinish} disabled={!name.trim()} className="mt-4 w-full bg-[#007bfc] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#005bb5] transition-all disabled:opacity-50">
                  COMENZAR A CHATEAR
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
