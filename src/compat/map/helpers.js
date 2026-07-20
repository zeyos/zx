import { parse } from '../globals.js';

/** @param {Element|string|null|undefined} target @returns {Element|null} */
export function targetElement(target) {
  if (target == null) return null;
  if (typeof target === 'string') return document.querySelector(target);
  return target?.nodeType === 1 ? target : null;
}

/** @param {unknown} value @returns {unknown} */
export function legacyContent(value) {
  if (value == null || typeof value === 'string' || typeof value === 'number') return value;
  if (value?.nodeType || typeof value?.toElement === 'function' || typeof value === 'function') return value;
  return parse(value) || String(value);
}

/** @param {unknown} value @returns {'info'|'success'|'warning'|'error'} */
export function messageKind(value) {
  const name = String(value ?? '').toLowerCase().replace(/^s_msg_32_/, '').replace(/^icon-/, '');
  if (name.includes('error') || name.includes('danger') || name.includes('remove')) return 'error';
  if (name.includes('success') || name.includes('ok') || name.includes('check')) return 'success';
  if (name.includes('warn')) return 'warning';
  return 'info';
}

/** @param {Function} fn @param {string} legacyName @param {string} replacement @returns {void} */
export function warnFunctionOnce(fn, legacyName, replacement) {
  if (Object.hasOwn(fn, '_compatWarned')) return;
  Object.defineProperty(fn, '_compatWarned', { value: true });
  console.warn(`${legacyName} is running on the Zx compat layer — migrate to zx.${replacement}`);
}

/** @param {Function} owner @param {string} method @param {string} replacement @returns {void} */
export function warnMethodOnce(owner, method, replacement) {
  const key = `_compatMethod_${method}`;
  if (Object.hasOwn(owner, key)) return;
  Object.defineProperty(owner, key, { value: true });
  console.warn(`${owner.legacyName}.${method} has no direct Zx equivalent; use ${replacement}`);
}

/** @param {unknown} value @returns {string} */
export function textLabel(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return String(value.label ?? value.title ?? value.text ?? value.name ?? value.value ?? '');
}
