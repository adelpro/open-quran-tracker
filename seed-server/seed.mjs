import fs from 'fs';
import chalk from 'chalk';
import WebTorrent from 'webtorrent';

const downloadPath = '/app/downloads';

// Initialize with color themes
const log = {
  info: (msg) => console.log(chalk.blue(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warning: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.log(chalk.red(msg)),
  stats: (msg) => console.log(chalk.magenta(msg)),
  peer: (msg) => console.log(chalk.cyan(msg))
};

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
  return `${(bytesPerSecond / Math.pow(1024, exp)).toFixed(1)} ${units[exp]}`;
}

// Ensure the downloads folder exists
if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath, { recursive: true });
  console.log(log.info('✅ Created downloads folder'));
} else {
  console.log(log.warning('📂 Downloads folder already exists'));
}

const client = new WebTorrent({ maxConns: 100,  dht: true, 
  ut_pex: true });

const magnetLinks = [
  'magnet:?xt=urn:btih:14cfaedfe76a3aafc2ae58f17eb4f830ff964aca&dn=Maher_Al-Muaiqly&tr=https%3A%2F%2Ftorrent.islamhouse.com%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:eb11251ff351a202a72f2959fae7e3a4183a6fb9&dn=AbdulRahman_Al-Sudais&tr=http%3A%2F%2Ftorrent.islamhouse.com%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:f456e1a32123a31b3e80148ba66301b768303acc&dn=Saad_Alghamdi&tr=http%3A%2F%2Ftorrent.mp3quran.net%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:f34936b46c18b3ff2a7eb42d1f2c30d4b8f02b03&dn=Ahmed_Alajmi&tr=http%3A%2F%2Ftorrent.mp3quran.net%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:331e7486de1a8c634f4e1e5c78906e015187a76d&dn=Abdulbasit_Abdulsamad_Mojawwad&tr=http%3A%2F%2Ftorrent.mp3quran.net%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:87c83e0b4432d70565e2dbc4e20988285778e189&dn=Mahmoud_Khalil_Al-Hussary_(warsh)&tr=http%3A%2F%2Ftorrent.mp3quran.net%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:110eedff1111d5028bfb853dd13ca903cffd4d10&dn=Abdulbasit_Abdussamad_Warsh_an_Nafi&tr=http%3A%2F%2Ftorrent.mp3quran.net%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:47db7a2155fef5797c046105aaa6eb16be47a7ed&dn=Shaik_Abu_Baker_Shatri&tr=http%3A%2F%2Ftorrent.mp3quran.net%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:65495a38fa9b277fc7fde00d5df94ddd4f0b332b&dn=Khalid_Aljleel_Update2&tr=http%3A%2F%2Ftorrent.mp3quran.net%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:5e0becf35d91ea4602f04db90d74621a172aa396&dn=Saad_Alghamdi&tr=http%3A%2F%2Ftorrent.mp3quran.net%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  'magnet:?xt=urn:btih:823CE8332E2BD3D555B5C35FC12BAB50A6976481&dn=Mishary_Rashid_Al_Afasy&tr=udp%3A%2F%2Ftracker.bitsearch.to%3A1337%2Fannounce&tr=udp%3A%2F%2Ftracker.zerobytes.xyz%3A1337%2Fannounce&tr=udp%3A%2F%2F9.rarbg.com%3A2920%2Fannounce&tr=udp%3A%2F%2Ftracker.0x.tf%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker2.dler.com%3A80%2Fannounce',
];


const options = {
  path: '/app/downloads', // Set download path
  announce: [
    'ws://tracker:8083',
    'wss://tracker.openquran.us.kg',
    'udp://tracker.openwebtorrent.com',
    'wss://tracker.btorrent.xyz',
    'wss://tracker.webtorrent.dev',
    'udp://tracker.coppersurfer.tk:6969',
    'udp://tracker.leechers-paradise.org:6969',
    'wss://tracker.openwebtorrent.com'
  ]
};

magnetLinks.forEach((magnet) => {
  // Extract the info hash from the magnet link (assuming the magnet link format is standard)
  const infoHashMatch = magnet.match(/btih:([a-zA-Z0-9]+)/);
  if (!infoHashMatch) {
    console.log(log.error('Invalid magnet link:', magnet));
    return;
  }
  const infoHash = infoHashMatch[1];

  // Check if the torrent already exists
  if (client.get(infoHash)) {
    console.log(log.info(`Torrent ${infoHash} already added; skipping.`));
    return;
  }

  client.add(magnet, {...options}, function (torrent) {
    console.log(log.peer(`Torrent added: ${torrent.infoHash}`));
    
    // Add speed tracking interval
    const speedInterval = setInterval(() => {
    console.log(
      log.stats(`[${torrent.name}] ↓ ${formatSpeed(torrent.downloadSpeed)}/s | ↑ ${formatSpeed(torrent.uploadSpeed)}/s | ` +
      `Progress: ${(torrent.progress * 100).toFixed(1)}%`)
    );
  }, 5000); // Update every 5 seconds

    torrent.on('done', () => {
      clearInterval(speedInterval);
      console.log(log.peer(`Download completed: ${torrent.name}`));
    });
  });
});

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log(log.info('\n🛑 Shutting down gracefully...'));
  client.destroy(err => {
    if (err) console.log(log.error(`❌ Shutdown error: ${err.message}`));
    process.exit(err ? 1 : 0);
  });
});
