// Initials for a photo-less avatar (handles Korean + Latin names).
export function initials(name) {
  if (!name) return '?';
  const n = name.trim();
  if (/[가-힣]/.test(n)) return n.slice(-2);
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
