export const rupees = (n) => '₹' + Math.round(n || 0).toLocaleString('en-IN');

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export const firstName = (name = '') => name.trim().split(/\s+/)[0] || name;

/** 9845012345 -> "+91 98450 12345" */
export function phoneDisplay(p = '') {
  const d = p.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return p;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

export const isValidPhone = (p = '') => /^[6-9]\d{9}$/.test(p);

export const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
