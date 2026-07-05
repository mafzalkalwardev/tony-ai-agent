/**
 * TONY 24/7 Daemon — keeps gateway, goal loops, and health checks running continuously.
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const config = require('../config');

const root = path.resolve(__dirname, '../..');
const PID_FILE = path.join(config.dataDir, 'tony-daemon.pid');
const LOG_FILE = path.join(config.dataDir, 'tony-daemon.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}

async function healthCheck() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${config.port}/health`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, data: JSON.parse(body) });
        } catch {
          resolve({ ok: false });
        }
      });
    });
    req.on('error', () => resolve({ ok: false }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ ok: false });
    });
  });
}

function startGateway() {
  log('Starting TONY gateway…');
  return spawn(process.execPath, [path.join(root, 'src/gateway/server.js')], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    detached: false,
  });
}

async function runGoalTick(sessionId) {
  const goalStore = require('../goals/store');
  const { runGoal } = require('../goals/runner');
  const active = goalStore.list('active');
  if (!active.length) return;
  const goal = active[0];
  log(`Goal tick: ${goal.title}`);
  try {
    await runGoal({ goalId: goal.id, sessionId, maxRounds: 2 });
  } catch (e) {
    log(`Goal tick error: ${e.message}`);
  }
}

async function runDaemon() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
  log(`TONY daemon started (pid ${process.pid})`);

  let gateway = startGateway();
  const sessionId = `daemon-${Date.now()}`;
  const intervalMs = Number(process.env.TONY_DAEMON_INTERVAL_MS || 300000);
  const graphIntervalMs = Number(process.env.TONY_DAEMON_GRAPH_MS || 3600000);

  let lastGraph = 0;

  const tick = async () => {
    const h = await healthCheck();
    if (!h.ok) {
      log('Gateway unhealthy — restarting…');
      try {
        gateway.kill();
      } catch {
        /* ignore */
      }
      gateway = startGateway();
      await new Promise((r) => setTimeout(r, 5000));
      return;
    }

    if (config.daemon.autoGoals) {
      await runGoalTick(sessionId);
    }

    if (Date.now() - lastGraph > graphIntervalMs) {
      try {
        const graphify = require('../brain/graphify');
        const g = graphify.buildFromWorkspace();
        log(`Graphify rebuilt: ${g.nodes.length} nodes`);
        lastGraph = Date.now();
      } catch (e) {
        log(`Graphify error: ${e.message}`);
      }
    }
  };

  await new Promise((r) => setTimeout(r, 8000));
  await tick();
  setInterval(tick, intervalMs);

  process.on('SIGINT', () => {
    log('Daemon shutting down…');
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
      /* ignore */
    }
    gateway.kill();
    process.exit(0);
  });
}

if (require.main === module) {
  runDaemon().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { runDaemon, healthCheck };
