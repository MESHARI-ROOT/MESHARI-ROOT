import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb);
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
export function normalizeCode(value) {
  const code = String(value ?? '').trim().replace(/[٠-٩]/g, c => c.charCodeAt(0)-1632).replace(/[۰-۹]/g, c => c.charCodeAt(0)-1776);
  if (!/^\d{9}$/.test(code)) throw new ApiError(422, 'رمز الدخول يجب أن يتكوّن من 9 أرقام بالضبط.');
  return code;
}
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const codeHash = (code, pepper) => createHmac('sha256', pepper).update('code:'+code).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export async function passwordHash(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new ApiError(422, 'كلمة المرور من 12 إلى 128 حرفًا.');
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N:32768, r:8, p:1, maxmem:64*1024*1024 });
  return `scrypt$32768$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128 || !/^scrypt\$32768\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored ?? '')) return false;
  const [, , salt, expected] = stored.split('$');
  const hash = await scrypt(password, salt, 64, {N:32768,r:8,p:1,maxmem:64*1024*1024});
  return timingSafeEqual(hash, Buffer.from(expected,'hex'));
}
export function ipHint(ip='unknown') {
  return ip.includes(':') ? ip.split(':').slice(0,3).join(':')+'::' : ip.replace(/\.\d+$/,'.×').slice(0,80);
}
export function deviceHint(ua='') {
  const os = /Windows/i.test(ua)?'Windows':/Android/i.test(ua)?'Android':/iPhone|iPad/i.test(ua)?'iOS':/Mac/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'جهاز غير معروف';
  const browser = /Edg\//i.test(ua)?'Edge':/Chrome/i.test(ua)?'Chrome':/Firefox/i.test(ua)?'Firefox':/Safari/i.test(ua)?'Safari':'متصفح';
  return `${browser} · ${os}`;
}
