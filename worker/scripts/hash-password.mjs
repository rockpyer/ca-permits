// Prints the PBKDF2 hash to store as the Worker secret ADMIN_PW: node scripts/hash-password.mjs 'password'
import { hashPassword } from '../src/auth.mjs';
if (!process.argv[2]) { console.error("Usage: node scripts/hash-password.mjs 'password'"); process.exit(1); }
console.log(await hashPassword(process.argv[2]));
