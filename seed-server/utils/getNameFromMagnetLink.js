export function getNameFromMagnetLink (magnet) {
    const match = magnet.match(/(?:\?|&)dn=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}