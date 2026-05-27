'use strict';
/**
 * ── Cluster Manager ────────────────────────────────────────────────────────────
 * Production-grade multi-core Node.js clustering.
 *
 * Why: A single Node.js process uses ONE CPU core. On a 4-core server,
 * 75% of CPU capacity is wasted. Clustering spawns one worker per core,
 * multiplying throughput ~linearly.
 *
 * Architecture:
 *   Master process (this file)
 *     └── Worker 1  (server.js — handles HTTP + Socket.IO)
 *     └── Worker 2  (server.js)
 *     └── Worker 3  (server.js)
 *     └── Worker N  (server.js)
 *
 * Features:
 *   - Auto-detects CPU cores (configurable via WEB_CONCURRENCY env)
 *   - Automatic worker restart on crash with exponential backoff
 *   - Graceful shutdown on SIGTERM/SIGINT (zero-downtime deploys)
 *   - Health monitoring: restarts workers that stop sending heartbeats
 *   - Prevents fork-bomb via max restart limit per time window
 *
 * Usage:
 *   Production:  node cluster.js         (multi-core)
 *   Development: node server.js          (single process, easier debugging)
 */

const cluster = require('cluster');
const os = require('os');
const path = require('path');
const { logger } = require('./utils/logger');

// ── Configuration ──────────────────────────────────────────────────────────────
const redisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const requestedWorkers = parseInt(process.env.WEB_CONCURRENCY, 10) ||
                    Math.min(os.cpus().length, 8); // Cap at 8 to leave room for OS
const NUM_WORKERS = redisConfigured ? requestedWorkers : 1;
if (!redisConfigured) {
  logger.error('[cluster] Redis not configured — forcing single-worker mode so in-memory fallback stays consistent');
}
const RESTART_WINDOW_MS   = 60_000; // 1 minute
const MAX_RESTARTS_PER_WINDOW = NUM_WORKERS * 3; // prevent fork-bomb
const GRACEFUL_SHUTDOWN_MS = 15_000; // 15s grace for workers to finish requests (matches drain timeout)

// ── State ──────────────────────────────────────────────────────────────────────
const restartTimestamps = [];
let isShuttingDown = false;

if (cluster.isPrimary) {
  logger.error(`\n╔══════════════════════════════════════════════════╗`);
  logger.error(`║  Listifys Cluster Manager                       ║`);
  logger.error(`║  Primary PID: ${String(process.pid).padEnd(35)}║`);
  logger.error(`║  Workers:     ${String(NUM_WORKERS).padEnd(35)}║`);
  logger.error(`║  CPU Cores:   ${String(os.cpus().length).padEnd(35)}║`);
  logger.error(`╚══════════════════════════════════════════════════╝\n`);

  // ── Fork workers ──────────────────────────────────────────────────────────
  for (let i = 0; i < NUM_WORKERS; i++) {
    forkWorker();
  }

  // ── Handle worker exit ────────────────────────────────────────────────────
  cluster.on('exit', (worker, code, signal) => {
    if (isShuttingDown) return; // Expected during graceful shutdown

    logger.error(
      `[Cluster] Worker ${worker.process.pid} died ` +
      `(code=${code}, signal=${signal}). Restarting...`
    );

    // Clean up heartbeat entry for the dead worker
    workerHeartbeats.delete(worker.id);

    // Rate-limit restarts to prevent fork-bomb
    const now = Date.now();
    restartTimestamps.push(now);

    // Clean old timestamps outside the window
    while (restartTimestamps.length > 0 &&
           restartTimestamps[0] < now - RESTART_WINDOW_MS) {
      restartTimestamps.shift();
    }

    if (restartTimestamps.length > MAX_RESTARTS_PER_WINDOW) {
      logger.error(
        `[Cluster] Too many restarts (${restartTimestamps.length}) in ` +
        `${RESTART_WINDOW_MS / 1000}s — halting to prevent fork-bomb`
      );
      process.exit(1);
    }

    // Exponential backoff based on recent restart count
    const backoffMs = Math.min(1000 * Math.pow(2, restartTimestamps.length - 1), 30_000);
    setTimeout(() => {
      if (!isShuttingDown) forkWorker();
    }, backoffMs);
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdownCluster = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.error(`\n[Cluster] ${signal} received — graceful shutdown initiated`);

    // Send SIGTERM to all workers
    for (const id in cluster.workers) {
      const worker = cluster.workers[id];
      if (worker) {
        worker.process.kill('SIGTERM');
      }
    }

    // Force kill after grace period
    setTimeout(() => {
      logger.error('[Cluster] Grace period expired — force killing workers');
      for (const id in cluster.workers) {
        const worker = cluster.workers[id];
        if (worker) {
          worker.process.kill('SIGKILL');
        }
      }
      process.exit(0);
    }, GRACEFUL_SHUTDOWN_MS);
  };

  process.on('SIGTERM', () => shutdownCluster('SIGTERM'));
  process.on('SIGINT', () => shutdownCluster('SIGINT'));

  // ── Worker online notification ────────────────────────────────────────────
  cluster.on('online', (worker) => {
    logger.error(`[Cluster] Worker ${worker.process.pid} is online`);
    workerHeartbeats.set(worker.id, Date.now());
  });

  // ── Worker heartbeat monitoring ────────────────────────────────────────────
  const workerHeartbeats = new Map();
  const HEARTBEAT_INTERVAL_MS = 15_000;
  const HEARTBEAT_TIMEOUT_MS  = 45_000;

  // Workers send heartbeats via IPC
  cluster.on('message', (worker, msg) => {
    if (msg === 'heartbeat') {
      workerHeartbeats.set(worker.id, Date.now());
    }
  });

  // Check for unresponsive workers
  setInterval(() => {
    if (isShuttingDown) return;
    const now = Date.now();
    for (const id in cluster.workers) {
      const lastBeat = workerHeartbeats.get(Number(id));
      if (lastBeat && (now - lastBeat) > HEARTBEAT_TIMEOUT_MS) {
        logger.error(`[Cluster] Worker ${cluster.workers[id].process.pid} missed heartbeat — killing`);
        cluster.workers[id].process.kill('SIGTERM');
        workerHeartbeats.delete(Number(id));
      }
    }
  }, HEARTBEAT_INTERVAL_MS).unref();

} else {
  // ── Worker process: load the actual Express server ────────────────────────
  require('./server.js');

  // Send heartbeats to master
  setInterval(() => {
    try { process.send('heartbeat'); } catch { /* master may have exited */ }
  }, 10_000).unref();
}

function forkWorker() {
  const worker = cluster.fork();
  return worker;
}
