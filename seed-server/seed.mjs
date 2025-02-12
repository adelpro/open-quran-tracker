import fs from "fs";
import events from "events";
import chalk from "chalk";
import WebTorrent from "webtorrent";
import TRACKERS from "./constants/TRACKERS.js";
import MAGNETLINKS from "./constants/MAGNETLINKS.js";
import Semaphore from "./utils/semaphore.js";
import getInfoHashFromMagnetLink from "./utils/getInfoHashFromMagnetLink.js";

// Configuration Constants
const DOWNLOAD_PATH = "/app/downloads";
const MAX_CONCURRENT_DOWNLOADS = 3;
const MAX_CONNS = 100;
const MAX_LISTENERS = 20;
const CHECK_INTERVAL = 5000;
const SHUTDOWN_CHECK_INTERVAL = 100;
const INITIAL_WAIT_TIME = 100;
const MAX_WAIT_TIME = 5000;

events.EventEmitter.defaultMaxListeners = MAX_LISTENERS;

// Logging configuration
const log = {
  info: (msg) => console.log(chalk.blue(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warning: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.log(chalk.red(msg)),
  stats: (msg) => console.log(chalk.magenta(msg)),
  peer: (msg) => console.log(chalk.cyan(msg)),
};

// Validate trackers configuration
if (!Array.isArray(TRACKERS) {
  console.log(log.error('❌ Invalid trackers configuration'));
  process.exit(1);
}

// Speed formatting utility
function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
  return `${(bytesPerSecond / Math.pow(1024, exp)).toFixed(1)} ${units[exp]}`;
}

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOAD_PATH)) {
  fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });
  console.log(log.info('✅ Created downloads folder'));
}

// Initialize WebTorrent client
const client = new WebTorrent({ 
  maxConns: MAX_CONNS, 
  dht: true, 
  ut_pex: true 
});

const torrentOptions = {
  path: DOWNLOAD_PATH,
  announce: TRACKERS
};

async function processMagnetLinks() {
  const semaphore = new Semaphore(MAX_CONCURRENT_DOWNLOADS);

  try {
    for (const magnet of MAGNETLINKS) {
      await semaphore.acquire();

      try {
        const infoHash = getInfoHashFromMagnetLink(magnet);
        if (!infoHash) {
          console.log(log.error(`Invalid magnet link: ${magnet}`));
          semaphore.release();
          continue;
        }

        // Async torrent existence check
        const existingTorrent = await new Promise((resolve) => {
          client.get(infoHash, (torrent) => resolve(torrent));
        });

        if (existingTorrent) {
          console.log(log.warning(`Torrent ${existingTorrent.name} already exists`));
          semaphore.release();
          continue;
        }

        // Add new torrent with error handling
        const torrent = await new Promise((resolve, reject) => {
          const newTorrent = client.add(magnet, torrentOptions, (torrent) => {
            resolve(torrent);
          });
          newTorrent.on('error', reject);
        });

        console.log(log.peer(`Added torrent: ${torrent.name}`));

        // Progress tracking
        const speedInterval = setInterval(() => {
          console.log(log.stats(
            `[${torrent.name}] ↓ ${formatSpeed(torrent.downloadSpeed)}/s | ` +
            `↑ ${formatSpeed(torrent.uploadSpeed)}/s | ` +
            `Peers: ${torrent.numPeers} | ` +
            `Progress: ${(torrent.progress * 100).toFixed(1)}%`
          ));
        }, CHECK_INTERVAL);

        // Torrent completion handler
        const cleanup = () => {
          clearInterval(speedInterval);
          torrent.removeAllListeners();
          semaphore.release();
        };

        torrent.on('done', () => {
          console.log(log.success(`Completed: ${torrent.name}`));          
          cleanup();
        });

        torrent.on('error', (err) => {
          console.log(log.error(`Error in ${torrent.name}: ${err.message}`));
          cleanup();
        });

      } catch (error) {
        console.log(log.error(`Magnet processing failed: ${error.message}`));
        semaphore.release();
      }
    }

    // Wait for remaining downloads with progressive backoff
    let waitTime = INITIAL_WAIT_TIME;
    while (semaphore.availableSlots() < MAX_CONCURRENT_DOWNLOADS) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
      waitTime = Math.min(waitTime * 2, MAX_WAIT_TIME);
    }

  } catch (error) {
    console.log(log.error(`Critical error: ${error.message}`));
    process.exit(1);
  }
}

// Graceful shutdown handler
function setupShutdown() {
  process.on("SIGINT", async () => {
    console.log(log.info("\n🛑 Initiating graceful shutdown..."));

    client.torrents.forEach(torrent => {
      console.log(log.warning(`Destroying ${torrent.name}`));
      torrent.destroy();
    });

    client.destroy((err) => {
      if (err) {
        console.log(log.error(`Shutdown failed: ${err.message}`));
        process.exit(1);
      }
      console.log(log.success("Clean shutdown completed"));
      process.exit(0);
    });
  });
}

// Error handling setup
process.on('unhandledRejection', (err) => {
  console.log(log.error(`Unhandled rejection: ${err.message}`));
});

// Main execution
try {
  await processMagnetLinks();
  setupShutdown();
} catch (error) {
  console.log(log.error(`Initialization failed: ${error.message}`));
  process.exit(1);
}