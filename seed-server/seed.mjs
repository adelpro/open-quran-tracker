import chalk from 'chalk';
import events from 'events';
import fs from 'fs';
import WebTorrent from 'webtorrent';
import Semaphore from './utils/semaphore.js';
import TRACKERS from './constants/TRACKERS.js';
import getInfoHashFromMagnetLink from './utils/getInfoHashFromMagnetLink.js';
import MAGNETLINKS from './constants/MAGNETLINKS.js';

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

// Starting the server
log.info('🚀 Starting the server...');

// Ensure the downloads folder exists
if (!fs.existsSync(DOWNLOAD_PATH)) {
  fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
  log.info('✅ Created downloads folder');
} else {
  log.warning('📂 Downloads folder already exists');
}

const client = new WebTorrent({ maxConns: MAX_CONNS, dht: true, ut_pex: true });

const semaphore = new Semaphore(MAX_CONCURRENT_DOWNLOADS);

const options = {
  path: DOWNLOAD_PATH,
  announce: TRACKERS
};

async function processMagnetLinks() {
  let fetchedMAGNETLINKS = MAGNETLINKS; // Default fallback
  try {
    const response = await fetch('https://tilawa.quran.us.kg/api/magnet-uris');

    // Check if the request was successful (status code 2xx)
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      // Check if the content type indicates JSON
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json(); // Parse JSON only if checks pass
        if (data && Array.isArray(data.magneturis)) {
           fetchedMAGNETLINKS = data.magneturis;
           log.success(`🔗 Fetched ${fetchedMAGNETLINKS.length} magnet links from tilawa.quran.us.kg/api/magnet-uris`);
        } else {
           log.warning('API response did not contain a valid magneturis array. Using default magnet links.');
        }
      } else {
        // Log warning if content type is not JSON (e.g., HTML error page)
        log.warning(`Received non-JSON response from API (Content-Type: ${contentType}). Using default magnet links.`);
      }
    } else {
      // Log warning if the HTTP status code indicates an error (e.g., 404, 500)
      log.warning(`API request failed with status ${response.status}. Using default magnet links.`);
    }
  } catch (fetchError) {
    // Log error if the fetch itself fails (e.g., network issue, DNS error)
    log.error(`Failed to fetch magnet links from API: ${fetchError.message}. Using default magnet links.`);
  }


  for (const magnet of fetchedMAGNETLINKS) {
    // Extract the info hash from the magnet link
    const infoHash = getInfoHashFromMagnetLink(magnet);

    // Try to acquire new slote
    await semaphore.acquire();

    if (!infoHash) {
      log.error('Invalid magnet link:', magnet);
      await semaphore.release();

      continue;
    }

    try {
      // Check if the torrent already exists (removed unnecessary await)
      const torrent = client.get(infoHash);
      if (torrent) {
        const name = torrent.name;
        const progress = (torrent.progress * 100).toFixed(2); // Progress as a percentage
        const totalSize = (torrent.length / (1024 * 1024)).toFixed(2); // Total size in MB
        log.info(`Name: ${name}, Progress: ${progress}%, Total Size: ${totalSize} MB`)
        log.warning(`Torrent ${name} (${infoHash}) - ${totalSize} MB already added; skipping.`)
        semaphore.release();
        continue;
      }

      client.add(magnet, options, function (torrent) {
        log.peer(`Torrent added: ${torrent.infoHash}`);

        // Add speed tracking interval
        const speedInterval = setInterval(() => {
          log.stats(
            `[${torrent.name}] ↓ ${formatSpeed(
              torrent.downloadSpeed
            )}/s | ↑ ${formatSpeed(torrent.uploadSpeed)}/s | ` +
            `Progress: ${(torrent.progress * 100).toFixed(1)}%`
          )
        }, 5000); // Update every 5 seconds

        const cleanup = () => {
          clearInterval(speedInterval);
          semaphore.release();
          torrent.removeAllListeners();
        };

        torrent.on('done', () => {
          log.peer(`Download completed: ${torrent.name}`);
          cleanup();
        });

        torrent.on('error', (err) => {
          log.error(`Error in torrent ${torrent.name}: ${err.message}`);
          cleanup();
        });

      });
    } catch (error) {
      log.error(`Error processing magnet link ${infoHash}: ${error.message}`);
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
