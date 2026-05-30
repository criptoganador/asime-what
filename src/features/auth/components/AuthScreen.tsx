import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../sidebar/store/useChatStore';
import { Phone, Check, ArrowRight, ArrowLeft, User, Camera, ShieldCheck, Copy, CheckCircle2, X, ChevronDown, Loader2, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parsePhoneNumberFromString, AsYouType, CountryCode } from 'libphonenumber-js';
import { generateECDHKeyPair, encryptPrivateKeyWithPIN } from '../../../utils/crypto';
import { uploadImage } from '../../../utils/upload';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type AuthStep = 'phone' | 'otp' | 'profile';

const CALLING_CODE_TO_ISO: Record<string, CountryCode> = {
  '+34': 'ES',
  '+58': 'VE',
  '+1': 'US',
  '+52': 'MX',
  '+54': 'AR',
  '+57': 'CO'
};

const isValidPhone = (value: string, callingCode: string) => {
  const isoCode = CALLING_CODE_TO_ISO[callingCode];
  if (!isoCode) return false;
  // Solo pasamos el national number, ya que parsePhoneNumberFromString espera un número y el ISO del país.
  // Pero a veces el número ya tiene un + código. libphonenumber-js lo maneja.
  const phoneNumber = parsePhoneNumberFromString(value, isoCode);
  return phoneNumber ? phoneNumber.isValid() : false;
};

const formatWithLib = (value: string, callingCode: string) => {
  const isoCode = CALLING_CODE_TO_ISO[callingCode];
  if (!isoCode) return value.replace(/\D/g, '');
  const formatter = new AsYouType(isoCode);
  return formatter.input(value);
};

const getDefaultCountryCode = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes('Caracas')) return '+58';
    if (tz.includes('Madrid') || tz.includes('Canary') || tz.includes('Ceuta')) return '+34';
    if (tz.includes('Mexico') || tz.includes('Tijuana') || tz.includes('Cancun') || tz.includes('Monterrey')) return '+52';
    if (tz.includes('Argentina') || tz.includes('Buenos_Aires')) return '+54';
    if (tz.includes('Bogota')) return '+57';
    if (tz.includes('America/New_York') || tz.includes('America/Chicago') || tz.includes('America/Los_Angeles') || tz.includes('America/Denver')) return '+1';
    
    // Si no coincide ninguna, por defecto +34
    return '+34';
  } catch {
    return '+34';
  }
};

export const AuthScreen = () => {
  const [step, setStep] = useState<AuthStep>('phone');
  const [countryCode, setCountryCode] = useState(getDefaultCountryCode);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('¡Hola! Estoy usando Asicme Chat.');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);

  const { login, checkUser } = useChatStore();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('¡Ups! Esta foto pesa más de 2MB. Por favor, elige una más ligera para mantener el chat rápido. 🚀');
        return;
      }
      setIsUploadingAvatar(true);
      try {
        const imageUrl = await uploadImage(file);
        setAvatar(imageUrl);
      } catch (error: any) {
        alert(error.message || '¡Ups! Esta foto pesa más de 2MB, elige una más ligera.');
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  // Validación inteligente del número de teléfono
  useEffect(() => {
    const cleanPhone = phone.replace(/\s+/g, '');
    const isValid = isValidPhone(cleanPhone, countryCode);

    if (isValid) {
      const timer = setTimeout(async () => {
        setIsChecking(true);
        setIsRateLimited(false);
        const fullPhone = `${countryCode}${cleanPhone}`;
        try {
          const user = await checkUser(fullPhone);
          if (user && user.rateLimited) {
            setIsRateLimited(true);
            setUserExists(null);
          } else {
            setUserExists(!!user);
          }
        } catch (error) {
          setUserExists(null);
        } finally {
          setIsChecking(false);
        }
      }, 800); // Debounce aumentado a 800ms para prevención
      return () => clearTimeout(timer);
    } else {
      setUserExists(null);
      setIsChecking(false);
      setIsRateLimited(false);
    }
  }, [phone, countryCode, checkUser]);

  const handleSendCode = () => {
    const cleanPhone = phone.replace(/\s+/g, '');
    const isValid = isValidPhone(cleanPhone, countryCode);
    
    if (!isValid) return;

    setStep('otp');
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
    
    if (newOtp.every(d => d !== '')) {
      handleVerifyOtp(newOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
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
      
      if (newOtp.every(d => d !== '')) {
        handleVerifyOtp(newOtp);
      }
    }
  };

  const handleVerifyOtp = async (otpToVerify = otp) => {
    const pinString = otpToVerify.join('');
    if (pinString.length !== 6) return;

    setIsChecking(true);
    const fullPhone = `${countryCode}${phone.replace(/\s+/g, '')}`;

    if (userExists) {
      // Login API call
      const res = await login({ phone: fullPhone, pin: pinString });
      setIsChecking(false);
      if (!res?.success) {
        alert(res?.error || 'PIN incorrecto. Inténtalo de nuevo.');
        setOtp(['', '', '', '', '', '']);
        document.getElementById('otp-0')?.focus();
      }
    } else {
      setIsChecking(false);
      setStep('profile');
    }
  };

  const handleFinish = async () => {
    if (!name.trim()) return;
    const cleanPhone = phone.replace(/\s+/g, '');
    const pinString = otp.join('');
    const fullPhone = `${countryCode}${cleanPhone}`;
    
    setIsChecking(true);

    try {
      // Generar claves E2EE
      const keys = await generateECDHKeyPair();
      const encryptedPrivateKey = encryptPrivateKeyWithPIN(keys.privateKey, pinString);

      const res = await login({
        name: name.trim(),
        phone: fullPhone,
        pin: pinString,
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=007bfc&color=fff`,
        about: about,
        publicKey: keys.publicKey,
        encryptedPrivateKey: encryptedPrivateKey
      });
      setIsChecking(false);
      if (!res?.success) {
        alert(res?.error || 'Error al crear cuenta');
      }
    } catch (error) {
      console.error('Error generando claves E2EE:', error);
      setIsChecking(false);
      alert('Error interno configurando seguridad E2EE.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#f0f2f5]">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 w-full h-[220px] bg-[#6366f1] shadow-lg"></div>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}></div>
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-[95vw] max-w-[450px] bg-white shadow-2xl rounded-2xl overflow-hidden flex flex-col min-h-[480px] sm:min-h-[520px]"
      >
        <div className="p-6 sm:p-10 text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-2xl border border-wa-border p-1 overflow-hidden">
            <img src="/favicon.png" alt="Asicme Chat Logo" className="w-full h-full object-cover rounded-xl" />
          </div>
          <h2 className="text-[32px] font-bold text-[#6366f1] mb-1 tracking-tight">Asicme Chat</h2>
          <p className="text-wa-text-secondary text-[15px]">Conectando tu mundo con estilo</p>
        </div>

        <div className="flex-1 px-6 sm:px-10 pb-6 sm:pb-10 flex flex-col">
          <AnimatePresence mode="wait">
            {step === 'phone' && (
              <motion.div key="phone" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col gap-6">
                <div className="space-y-4">
                  <label className="text-[12px] text-[#6366f1] font-bold uppercase tracking-widest">Número de teléfono</label>
                  <div className="flex gap-2">
                    <div className="relative group min-w-[100px]">
                      <select
                        value={countryCode}
                        onChange={(e) => {
                          setCountryCode(e.target.value);
                          setPhone(formatWithLib(phone, e.target.value));
                        }}
                        className="w-full bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 outline-none py-3.5 px-4 text-[17px] rounded-xl transition-all duration-300 appearance-none cursor-pointer font-medium shadow-sm focus:shadow-lg"
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
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-wa-text-secondary group-focus-within:text-[#6366f1] transition-colors"><Phone size={20} /></div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatWithLib(e.target.value, countryCode))}
                        placeholder="Número de móvil"
                        className="w-full bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 focus:shadow-lg outline-none py-3.5 pl-12 pr-12 text-[18px] rounded-xl transition-all duration-300 shadow-sm"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {isChecking ? (
                          <Loader2 size={18} className="text-[#6366f1] animate-spin" />
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
                  <p className={cn("text-[12px] leading-relaxed", isRateLimited ? "text-red-500 font-medium" : "text-wa-text-secondary")}>
                    {isRateLimited 
                      ? "Por seguridad, has superado el límite de intentos. Espera 1 minuto."
                      : !isValidPhone(phone.replace(/\s+/g, ''), countryCode)
                        ? "Ingresa un número válido."
                        : userExists
                          ? "¡Bienvenido de nuevo! Haz clic en Entrar para continuar."
                          : "Te enviaremos un código de seguridad para verificar tu identidad."}
                  </p>
                </div>
                <button 
                  onClick={handleSendCode} 
                  disabled={!isValidPhone(phone.replace(/\s+/g, ''), countryCode) || isChecking || isRateLimited} 
                  className="mt-4 w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#4f46e5] transition-all disabled:opacity-50 flex items-center justify-center gap-3 group"
                >
                  {userExists ? 'ENTRAR' : 'SIGUIENTE'}
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div key="otp" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="flex flex-col gap-8 text-center relative">
                <button 
                  onClick={() => setStep('phone')}
                  className="absolute -top-2 left-0 p-2 text-wa-text-secondary hover:text-[#6366f1] transition-colors rounded-full hover:bg-[#6366f1]/10"
                  title="Cambiar número de teléfono"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="space-y-2 mt-2">
                  <p className="text-[15px] text-wa-text-primary">{userExists ? 'Ingresa tu PIN de seguridad' : 'Crea tu PIN de seguridad'}</p>
                  <p className="text-[13px] text-wa-text-secondary">PIN de 6 dígitos para <span className="font-bold">{countryCode} {phone}</span></p>
                </div>
                <div className="flex justify-center gap-3">
                  {otp.map((digit, i) => (
                    <input key={i} id={`otp-${i}`} type="text" maxLength={1} value={digit} onPaste={handlePaste} onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleKeyDown(i, e)} className="w-10 h-14 sm:w-12 sm:h-16 bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 outline-none text-center text-xl sm:text-2xl font-bold rounded-xl transition-all duration-300 shadow-sm focus:shadow-lg" />
                  ))}
                </div>
                <button onClick={() => handleVerifyOtp()} disabled={otp.some(d => !d)} className="mt-2 w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#4f46e5] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
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
                    <div className={cn(
                      "w-32 h-32 bg-wa-bg rounded-full flex items-center justify-center text-wa-text-secondary overflow-hidden border-2 border-wa-border group-hover:border-[#6366f1] transition-all shadow-inner relative",
                      isUploadingAvatar && "opacity-50"
                    )}>
                      {avatar ? <img src={avatar} alt="Preview" className="w-full h-full object-cover" /> : <User size={64} />}
                      {isUploadingAvatar && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 size={32} className="text-[#6366f1] animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="absolute bottom-1 right-1 w-10 h-10 bg-[#6366f1] text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Camera size={20} />
                    </div>
                  </div>
                  <p className="text-[13px] text-wa-text-secondary font-medium">Personaliza tu perfil</p>
                </div>
                <div className="space-y-6 w-full">
                  <div className="relative">
                    <input 
                      type="text" 
                      maxLength={25}
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="¿Cómo te llamas?" 
                      className="w-full bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 focus:shadow-lg outline-none py-3.5 px-4 rounded-xl text-[16px] text-wa-text-primary transition-all duration-300 shadow-sm pr-16" 
                    />
                    <span className={cn(
                      "absolute right-4 bottom-3.5 text-[12px] font-medium transition-colors",
                      name.length >= 25 ? "text-red-500" : name.length >= 20 ? "text-yellow-500" : "text-wa-text-secondary/60"
                    )}>
                      {name.length}/25
                    </span>
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      maxLength={130}
                      value={about} 
                      onChange={(e) => setAbout(e.target.value)} 
                      placeholder="Tu estado actual" 
                      className="w-full bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 focus:shadow-lg outline-none py-3.5 px-4 rounded-xl text-[15px] text-wa-text-secondary transition-all duration-300 shadow-sm pr-20" 
                    />
                    <div className="absolute right-3 bottom-3.5 flex items-center gap-2">
                      <span className={cn(
                        "text-[12px] font-medium transition-colors",
                        about.length >= 130 ? "text-red-500" : about.length >= 110 ? "text-yellow-500" : "text-wa-text-secondary/60"
                      )}>
                        {about.length}/130
                      </span>
                      <button 
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="text-wa-text-secondary hover:text-[#6366f1] transition-colors"
                      >
                        <Smile size={18} />
                      </button>
                    </div>
                    {showEmojiPicker && (
                      <div className="absolute z-50 right-0 top-12 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)}></div>
                        <div className="relative z-50">
                          <EmojiPicker 
                            onEmojiClick={(emojiData) => {
                              if (about.length + emojiData.emoji.length <= 130) {
                                setAbout(prev => prev + emojiData.emoji);
                              }
                              setShowEmojiPicker(false);
                            }}
                            width={300}
                            height={400}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={handleFinish} disabled={!name.trim()} className="mt-4 w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#4f46e5] transition-all disabled:opacity-50">
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
