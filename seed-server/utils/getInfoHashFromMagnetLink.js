export default function getInfoHashFromMagnetLink(magnet){
    const infoHash = magnet.match(/btih:([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
} 