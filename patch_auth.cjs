const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'features', 'auth', 'components', 'AuthScreen.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Imports
content = content.replace(
  "import { generateECDHKeyPair, encryptPrivateKeyWithPIN } from '../../../utils/crypto';",
  "import { generateECDHKeyPair, encryptPrivateKeyWithPIN, encryptPrivateKeyWithPhrase, decryptPrivateKeyWithPhrase } from '../../../utils/crypto';\nimport * as bip39 from 'bip39';"
);

// 2. AuthStep
content = content.replace(
  "type AuthStep = 'phone' | 'otp' | 'profile';",
  "type AuthStep = 'phone' | 'otp' | 'profile' | 'recovery_phrase_display' | 'recovery_input';"
);

// 3. State
content = content.replace(
  "const [isRateLimited, setIsRateLimited] = useState(false);",
  "const [isRateLimited, setIsRateLimited] = useState(false);\n  const [recoveryPhrase, setRecoveryPhrase] = useState('');\n  const [recoveryInput, setRecoveryInput] = useState('');\n  const [newPinInput, setNewPinInput] = useState(['', '', '', '', '', '']);"
);

// 4. handleFinish / handleFinalizeRegistration / handleRecover
const oldHandleFinish = `  const handleFinish = async () => {
    if (!name.trim()) return;
    const cleanPhone = phone.replace(/\\s+/g, '');
    const pinString = otp.join('');
    const fullPhone = \`\${countryCode}\${cleanPhone}\`;
    
    setIsChecking(true);

    try {
      // Generar claves E2EE
      const keys = await generateECDHKeyPair();
      const encryptedPrivateKey = encryptPrivateKeyWithPIN(keys.privateKey, pinString);

      const res = await login({
        name: name.trim(),
        phone: fullPhone,
        pin: pinString,
        avatar: avatar || \`https://ui-avatars.com/api/?name=\${encodeURIComponent(name)}&background=007bfc&color=fff\`,
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
  };`;

const newHandlers = `  const handleFinish = async () => {
    if (!name.trim()) return;
    const phrase = bip39.generateMnemonic(128, bip39.wordlists.spanish || bip39.wordlists.english);
    setRecoveryPhrase(phrase);
    setStep('recovery_phrase_display');
  };

  const handleFinalizeRegistration = async () => {
    setIsChecking(true);
    const cleanPhone = phone.replace(/\\s+/g, '');
    const pinString = otp.join('');
    const fullPhone = \`\${countryCode}\${cleanPhone}\`;
    
    try {
      const keys = await generateECDHKeyPair();
      const encryptedPrivateKey = encryptPrivateKeyWithPIN(keys.privateKey, pinString);
      const recoveryEncryptedPrivateKey = encryptPrivateKeyWithPhrase(keys.privateKey, recoveryPhrase);

      const res = await login({
        name: name.trim(),
        phone: fullPhone,
        pin: pinString,
        avatar: avatar || \`https://ui-avatars.com/api/?name=\${encodeURIComponent(name)}&background=007bfc&color=fff\`,
        about: about,
        publicKey: keys.publicKey,
        encryptedPrivateKey: encryptedPrivateKey,
        recoveryPhrase: recoveryPhrase,
        recoveryEncryptedPrivateKey: recoveryEncryptedPrivateKey
      });
      setIsChecking(false);
      if (!res?.success) {
        alert(res?.error || 'Error al crear cuenta');
        setStep('profile');
      }
    } catch (error) {
      console.error('Error generando claves E2EE:', error);
      setIsChecking(false);
      alert('Error interno configurando seguridad E2EE.');
    }
  };

  const handleRecover = async () => {
    const pinString = newPinInput.join('');
    if (pinString.length !== 6 || !recoveryInput.trim()) return;
    
    setIsChecking(true);
    const fullPhone = \`\${countryCode}\${phone.replace(/\\s+/g, '')}\`;
    const { verifyRecoveryPhrase, resetPin } = useChatStore.getState();
    
    const verifyRes = await verifyRecoveryPhrase(fullPhone, recoveryInput.trim());
    if (!verifyRes.success) {
      alert(verifyRes.error || 'Frase incorrecta o servidor inactivo');
      setIsChecking(false);
      return;
    }
    
    const recoveryEncryptedPrivateKey = verifyRes.data.recoveryEncryptedPrivateKey;
    const privateKeyJWK = decryptPrivateKeyWithPhrase(recoveryEncryptedPrivateKey, recoveryInput.trim());
    
    if (!privateKeyJWK) {
      alert('No se pudo desencriptar tu cuenta. Es posible que la frase sea incorrecta.');
      setIsChecking(false);
      return;
    }
    
    const newEncryptedPrivateKey = encryptPrivateKeyWithPIN(privateKeyJWK, pinString);
    
    const resetRes = await resetPin({
      phone: fullPhone,
      recoveryPhrase: recoveryInput.trim(),
      newPin: pinString,
      newEncryptedPrivateKey
    });
    
    setIsChecking(false);
    if (!resetRes.success) {
      alert(resetRes.error || 'Error al restablecer tu PIN.');
    }
  };`;

content = content.replace(oldHandleFinish, newHandlers);

// 5. OTP UI (add 'Olvide mi PIN' link)
const oldOtpVerifyBtn = `<button onClick={() => handleVerifyOtp()} disabled={otp.some(d => !d)} className="mt-2 w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#4f46e5] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                  VERIFICAR AHORA
                  <Check size={20} />
                </button>`;
const newOtpVerifyBtn = `<button onClick={() => handleVerifyOtp()} disabled={otp.some(d => !d)} className="mt-2 w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#4f46e5] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                  VERIFICAR AHORA
                  <Check size={20} />
                </button>
                {userExists && (
                  <button onClick={() => setStep('recovery_input')} className="mt-2 text-[13px] text-wa-text-secondary hover:text-[#6366f1] underline transition-colors">
                    ¿Olvidaste tu PIN? Recupéralo aquí
                  </button>
                )}`;
content = content.replace(oldOtpVerifyBtn, newOtpVerifyBtn);

// 6. Append new steps UI
const stepProfileEnd = `                <button onClick={handleFinish} disabled={!name.trim()} className="mt-4 w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#4f46e5] transition-all disabled:opacity-50">
                  COMENZAR A CHATEAR
                </button>
              </motion.div>
            )}`;

const additionalUIs = `                <button onClick={handleFinish} disabled={!name.trim()} className="mt-4 w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#4f46e5] transition-all disabled:opacity-50">
                  COMENZAR A CHATEAR
                </button>
              </motion.div>
            )}

            {step === 'recovery_phrase_display' && (
              <motion.div key="recovery_phrase_display" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col gap-6 text-center">
                <div className="flex justify-center mb-2">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-500">
                    <ShieldCheck size={32} />
                  </div>
                </div>
                <h3 className="text-[22px] font-bold text-wa-text-primary">Tu frase de recuperación</h3>
                <p className="text-[14px] text-wa-text-secondary">Escribe estas 12 palabras en un papel y guárdalas en un lugar seguro. Son la <b>única forma</b> de recuperar tus chats si olvidas tu PIN.</p>
                
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 grid grid-cols-3 gap-3">
                  {recoveryPhrase.split(' ').map((word, i) => (
                    <div key={i} className="flex gap-1.5 items-center bg-white px-2 py-1.5 rounded shadow-sm border border-slate-100">
                      <span className="text-[10px] text-slate-400 font-mono">{i + 1}.</span>
                      <span className="text-[13px] font-bold text-slate-700 break-all">{word}</span>
                    </div>
                  ))}
                </div>
                
                <button onClick={() => { navigator.clipboard.writeText(recoveryPhrase); alert("Frase copiada al portapapeles"); }} className="text-[#6366f1] text-[14px] font-bold hover:underline flex items-center justify-center gap-2">
                  <Copy size={16} /> COPIAR FRASE
                </button>

                <button onClick={handleFinalizeRegistration} disabled={isChecking} className="mt-2 w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#4f46e5] transition-all flex justify-center items-center gap-2">
                  {isChecking ? <Loader2 className="animate-spin" size={20} /> : "ENTENDIDO, YA LA GUARDÉ"}
                </button>
              </motion.div>
            )}

            {step === 'recovery_input' && (
              <motion.div key="recovery_input" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col gap-6 text-center relative">
                <button 
                  onClick={() => setStep('otp')}
                  className="absolute -top-2 left-0 p-2 text-wa-text-secondary hover:text-[#6366f1] transition-colors rounded-full hover:bg-[#6366f1]/10"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="space-y-2 mt-4">
                  <h3 className="text-[22px] font-bold text-wa-text-primary">Recuperar Cuenta</h3>
                  <p className="text-[14px] text-wa-text-secondary">Ingresa tus 12 palabras y crea un nuevo PIN de 6 dígitos.</p>
                </div>
                
                <textarea 
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  placeholder="ej. manzana gato mesa..."
                  className="w-full bg-slate-50/50 backdrop-blur-sm border-2 border-slate-200/60 focus:bg-white focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10 outline-none p-4 rounded-xl text-[14px] text-wa-text-primary transition-all duration-300 shadow-sm resize-none h-24"
                />

                <div className="flex justify-center gap-2 mt-2">
                  {newPinInput.map((digit, i) => (
                    <input key={\`new-pin-\${i}\`} id={\`new-pin-\${i}\`} type="text" maxLength={1} value={digit} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!/^\\d*$/.test(val)) return;
                        const newPin = [...newPinInput];
                        newPin[i] = val.slice(-1);
                        setNewPinInput(newPin);
                        if (val && i < 5) document.getElementById(\`new-pin-\${i + 1}\`)?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !newPinInput[i] && i > 0) {
                          const newPin = [...newPinInput];
                          newPin[i - 1] = '';
                          setNewPinInput(newPin);
                          document.getElementById(\`new-pin-\${i - 1}\`)?.focus();
                        }
                      }}
                      className="w-10 h-12 bg-slate-50 border-2 border-slate-200 focus:border-[#6366f1] outline-none text-center text-xl font-bold rounded-xl" 
                    />
                  ))}
                </div>

                <button onClick={handleRecover} disabled={newPinInput.some(d => !d) || !recoveryInput.trim() || isChecking} className="w-full bg-[#6366f1] text-white py-4 rounded-xl font-bold shadow-lg hover:bg-[#4f46e5] disabled:opacity-50 transition-all flex justify-center items-center gap-2 mt-2">
                  {isChecking ? <Loader2 className="animate-spin" size={20} /> : "RESTAURAR CUENTA"}
                </button>
              </motion.div>
            )}`;

content = content.replace(stepProfileEnd, additionalUIs);

fs.writeFileSync(filePath, content);
console.log('AuthScreen patched successfully.');
