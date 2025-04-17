import chalk from 'chalk';
import events from 'events';
import fs from 'fs';
import WebTorrent from 'webtorrent';
import Semaphore from './utils/semaphore.js';
import TRACKERS from './constants/TRACKERS.js';
import getInfoHashFromMagnetLink from './utils/getInfoHashFromMagnetLink.js';
import MAGNETLINKS from './constants/MAGNETLINKS.js';

// CONSTANTS
const DOWNLOAD_PATH = '/app/downloads'; // Assuming this path is correct inside the container/server environment
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
    const response = await fetch('https://quran.us.kg/api/magnet-uris');

    // Check if the request was successful (status code 2xx)
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      // Check if the content type indicates JSON
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json(); // Parse JSON only if checks pass
        if (data && Array.isArray(data.magneturis)) {
           fetchedMAGNETLINKS = data.magneturis;
           log.success(`🔗 Fetched ${fetchedMAGNETLINKS.length} magnet links from quran.us.kg/api/magnet-uris`);
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
    const infoHash = getInfoHashFromMagnetLink(magnet);

    // Acquire semaphore slot before processing
    await semaphore.acquire();

    if (!infoHash) {
      log.error('Invalid magnet link:', magnet);
      semaphore.release(); // Release slot if magnet is invalid
      continue;
    }

    try {
      // Let client.add handle adding or retrieving existing torrent
      client.add(magnet, options, function (torrent) {
        // Check if torrent was already completed *before* this script ran
        // Note: torrent.progress might be 1 even if just added if files exist
        if (torrent.done) {
            log.warning(`Torrent ${torrent.name || infoHash} already completed. Seeding.`);
            // We still want to seed completed torrents, so don't release semaphore here immediately
            // unless you only want to download, not seed long-term.
        } else {
            log.peer(`Adding/Resuming torrent: ${torrent.name || infoHash}`);
        }

        // Add speed tracking interval
        const speedInterval = setInterval(() => {
          // Check if torrent object still exists and has data
          if (torrent && torrent.name !== undefined) {
            log.stats(
              `[${torrent.name}] ↓ ${formatSpeed(
                torrent.downloadSpeed
              )}/s | ↑ ${formatSpeed(torrent.uploadSpeed)}/s | ` +
              `Peers: ${torrent.numPeers} | Progress: ${(torrent.progress * 100).toFixed(1)}%`
            );
          } else if (torrent) {
             log.stats(`[${infoHash}] Waiting for metadata... Peers: ${torrent.numPeers}`);
          }
        }, 5000); // Update every 5 seconds

        const cleanup = () => {
          clearInterval(speedInterval);
          semaphore.release(); // Release semaphore slot when done or error
          // Avoid removing all listeners if you want the client to keep seeding
          // torrent.removeAllListeners();
        };

        // Use 'ready' event to log when metadata is available
        torrent.once('ready', () => {
            log.success(`Metadata ready for: ${torrent.name} (${infoHash}) - Size: ${(torrent.length / (1024 * 1024)).toFixed(2)} MB`);
        });

        torrent.once('done', () => { // Use 'once' to avoid multiple triggers if script restarts
          log.success(`Download completed: ${torrent.name}`);
          // Decide if you want to stop tracking/release semaphore on 'done'
          // If you want to seed indefinitely, you might not call cleanup() here.
          // For now, let's assume we release the slot after download.
          cleanup();
        });

        torrent.once('error', (err) => { // Use 'once'
          log.error(`Error in torrent ${torrent.name || infoHash}: ${err.message}`);
          cleanup();
        });

        // Handle cases where torrent is added but might already be seeding (no 'done' event fires)
        // If torrent.progress is 1 when added, we might need to handle semaphore release differently
        // if we only want MAX_CONCURRENT_DOWNLOADS active *downloads*.
        // For now, the semaphore limits concurrent add operations + active downloads/seeds tracked by intervals.

      });
    } catch (error) {
      // This catch block might be less likely to trigger now,
      // as client.add usually emits 'error' event instead of throwing.
      log.error(`Error during client.add for ${infoHash}: ${error.message}`);
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
