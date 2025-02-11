import fs from 'fs';
import chalk from 'chalk';
import WebTorrent from 'webtorrent';
import  TRACKERS  from './constants/TRACKERS';
import  MAGNETLINKS  from './constants/MAGNETLINKS';

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

const options = {
  path: downloadPath,
  announce: TRACKERS
};

MAGNETLINKS.forEach((magnet) => {
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
