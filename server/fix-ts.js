const fs = require('fs');
let code = fs.readFileSync('index.ts', 'utf8');
code = code.replace(/bcrypt\.compare\(pin,\s*user\.pin\)/g, 'bcrypt.compare(pin, user.pin!)');
code = code.replace(/decryptPhone\(safeUser\.phone\)/g, 'decryptPhone(safeUser.phone!)');
code = code.replace(/decryptPhone\(user\.phone\)/g, 'decryptPhone(user.phone!)');
code = code.replace(/encryptPhone\(phone\)/g, 'encryptPhone(phone!)'); // just in case
fs.writeFileSync('index.ts', code);
