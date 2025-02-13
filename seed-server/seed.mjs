import chalk from 'chalk';
import events from 'events';
import fs from 'fs';
import WebTorrent from 'webtorrent';
import MAGNETLINKS from './constants/MAGNETLINKS.js';
import TRACKERS from './constants/TRACKERS.js';
import getInfoHashFromMagnetLink from './utils/getInfoHashFromMagnetLink.js';

// CONSTANTS
const DOWNLOAD_PATH = '/app/downloads';
const MAX_CONNS = 100;
const MAX_LISTENERS = 20;
const MAX_CONCURRENT_DOWNLOADS = 3;

events.EventEmitter.defaultMaxListeners = MAX_LISTENERS; // Adjust the number as needed

// Initialize with color themes
const log = {
  info: (msg) => console.log(chalk.blue(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warning: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.log(chalk.red(msg)),
  stats: (msg) => console.log(chalk.magenta(msg)),
  peer: (msg) => console.log(chalk.cyan(msg)),
};

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exp = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
  return `${(bytesPerSecond / Math.pow(1024, exp)).toFixed(1)} ${units[exp]}`;
}

// Ensure the downloads folder exists
if (!fs.existsSync(DOWNLOAD_PATH)) {
  fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
  console.log(log.info('✅ Created downloads folder'));
} else {
  console.log(log.warning('📂 Downloads folder already exists'));
}

const client = new WebTorrent({ maxConns: MAX_CONNS, dht: true, ut_pex: true });

const semaphore = new Semaphore(MAX_CONCURRENT_DOWNLOADS);

const options = {
  path: DOWNLOAD_PATH,
  announce: TRACKERS
};

async function processMagnetLinks() {
  for (const magnet of MAGNETLINKS) {
    // Extract the info hash from the magnet link
    const infoHash = getInfoHashFromMagnetLink(magnet);

    // Try to acquire new slote
    await semaphore.acquire();

    if (!infoHash) {
      console.log(log.error('Invalid magnet link:', magnet));
      await semaphore.release();

      continue;
    }
  
    try {
      // Check if the torrent already exists
      const torrent = await client.get(infoHash);
      if (torrent) {
        const name = torrent.name;
        const progress = (torrent.progress * 100).toFixed(2); // Progress as a percentage
        const totalSize = (torrent.length / (1024 * 1024)).toFixed(2); // Total size in MB
        console.log(
          log.info(
            `Name: ${name}, Progress: ${progress}%, Total Size: ${totalSize} MB`
          )
        );
        console.log(
          log.warning(`Torrent ${name} (${infoHash}) - ${totalSize} MB already added; skipping.`)
        );
        semaphore.release();
        continue;
      }     

       client.add(magnet, options, function (torrent) {
        console.log(log.peer(`Torrent added: ${torrent.infoHash}`));

        // Add speed tracking interval
        const speedInterval = setInterval(() => {
          console.log(
            log.stats(
              `[${torrent.name}] ↓ ${formatSpeed(
                torrent.downloadSpeed
              )}/s | ↑ ${formatSpeed(torrent.uploadSpeed)}/s | ` +
                `Progress: ${(torrent.progress * 100).toFixed(1)}%`
            )
          );
        }, 5000); // Update every 5 seconds

        const cleanup = () => {
          clearInterval(speedInterval);
          semaphore.release();
          torrent.removeAllListeners();
        };

        torrent.on('done', () => {
          console.log(log.peer(`Download completed: ${torrent.name}`));
          cleanup();
        });

        torrent.on('error', (err) => {         
          console.log(log.error(`Error in torrent ${torrent.name}: ${err.message}`));
          cleanup();
        });

    });
  } catch (error) {
      console.log(log.error(`Error processing magnet link: ${error.message}`));
      semaphore.release();
    }
  }
}

function gracefulShutdown() {
  log.info('\n🛑 Shutting down gracefully...');
  client.destroy((err) => {
    if (err) {
      log.error(`❌ Error during client destruction: ${err.message}`);
      process.exit(1);
    } else {
      log.success('✅ Client destroyed successfully.');
      process.exit(0);
    }
  });
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start processing magnet links
await processMagnetLinks();
