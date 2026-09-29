#!/usr/bin/env node
/**
 * Frees the Vite dev port before the dev server starts.
 *
 * Why this exists
 * ---------------
 * The preview runtime restarts `npm run dev` on every re-sync. `npm` does not
 * always forward the termination signal to its grandchild process, so the
 * previous `vite` can survive as an orphan still holding port 5173. When the
 * new Vite instance then tries to bind, it hits `EADDRINUSE` and — because
 * `vite.config.ts` sets `strictPort: true` — exits immediately with code 1:
 *
 *     error when starting dev server:
 *     Error: Port 5173 is already in use
 *
 * Running this script as the `predev` hook guarantees the port is released
 * before Vite binds it, so a restart can never fail on a stale listener.
 *
 * Usage:
 *   node scripts/free-port.mjs            # free the dev port (default 5173)
 *   node scripts/free-port.mjs 5199       # free a specific port
 *   node scripts/free-port.mjs --check    # report the holder, kill nothing
 */
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
// Keep in sync with `server.port` in vite.config.ts.
const PORT = Number(args.find((a) => /^\d+$/.test(a)) ?? 5173);

/** PIDs currently LISTENing on `port` (excluding this process). */
function listenersOn(port) {
  try {
    return [
      ...new Set(
        execFileSync('ss', ['-ltnp'], { encoding: 'utf8' })
          .split('\n')
          // Trailing space avoids matching ports like 51730.
          .filter((line) => line.includes(`:${port} `) && line.includes('LISTEN'))
          .flatMap((line) => [...line.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]))),
      ),
    ].filter((pid) => pid !== process.pid);
  } catch {
    // `ss` unavailable — treat the port as free rather than blocking startup.
    return [];
  }
}

function signal(pids, sig) {
  for (const pid of pids) {
    try {
      process.kill(pid, sig);
    } catch {
      /* already gone, or not ours — nothing to do */
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const stale = listenersOn(PORT);

if (stale.length === 0) {
  console.log(`[free-port] port ${PORT} is free`);
  process.exit(0);
}

if (CHECK_ONLY) {
  console.log(`[free-port] port ${PORT} is held by: ${stale.join(', ')}`);
  process.exit(0);
}

console.log(`[free-port] port ${PORT} held by ${stale.join(', ')} — terminating`);
signal(stale, 'SIGTERM');
await sleep(800);

const stubborn = listenersOn(PORT);
if (stubborn.length) {
  console.log(`[free-port] still up: ${stubborn.join(', ')} — forcing`);
  signal(stubborn, 'SIGKILL');
  await sleep(300);
}

console.log(`[free-port] port ${PORT} ready`);
