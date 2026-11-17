/**
 * Starts this tree's `tools/serve.js` as a child process for a browser suite, and resolves only
 * once that server — not merely something on the port — is listening and serving a known file.
 *
 * Polling a fixed port for any answer cannot tell a server that failed to bind (the port is taken)
 * from one that started: the answer then comes from whatever else holds the port, and the suite
 * tests the wrong tree. So the child binds a port the operating system picks (`PORT=0`) unless one
 * is asked for, and the line it prints once listening is the signal and the source of the port. A
 * spawn error, an exit before that line, or anything on its stderr fails the start with the reason.
 */
import { spawn } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** What `tools/serve.js` prints once it is listening; the port is the one it actually bound. */
const LISTENING = /^Zx dev server \(.*\): http:\/\/[^\s/]+:(\d+)\//m;

/**
 * @typedef {Object} ServeChildOptions
 * @property {number} [port=0] Port to bind; 0 lets the operating system choose a free one.
 * @property {string} [serveRoot='.'] Directory served, relative to the repository (`SERVE_ROOT`).
 * @property {string} [readyPath] Path that must answer 200 before the server counts as ready, such
 *   as `tests/smoke/smoke.html`. Proves the tree served is the one the suite expects.
 * @property {number} [timeout=10000] Milliseconds to wait for the server.
 * @property {Record<string, string|undefined>} [env=process.env] Environment for the child.
 * @property {string} [root] Repository root; defaults to this file's tree.
 */

/**
 * @typedef {Object} ServeChild
 * @property {string} base Origin of the server, `http://127.0.0.1:<port>`.
 * @property {number} port The port it bound.
 * @property {import('node:child_process').ChildProcess} child The server process.
 * @property {() => string} errors Whatever the server wrote to stderr since it started.
 * @property {() => void} stop Stops the server. Safe to call more than once.
 */

/**
 * Starts the development server and waits until it is ours and ready.
 * @param {ServeChildOptions} [options={}]
 * @returns {Promise<ServeChild>}
 */
export async function startServer({
  port = 0, serveRoot = '.', readyPath, timeout = 10_000, env = process.env, root = ROOT
} = {}) {
  const child = spawn(process.execPath, [join(root, 'tools/serve.js')], {
    cwd: root,
    env: { ...env, HOST: '127.0.0.1', PORT: String(port), SERVE_ROOT: serveRoot },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const stop = () => { if (child.exitCode === null && !child.killed) child.kill(); };
  process.once('exit', stop);

  try {
    const bound = await new Promise((done, fail) => {
      let stdout = '';
      const timer = setTimeout(() => fail(new Error(`the dev server did not start within ${timeout} ms${stderr ? `: ${stderr.trim()}` : ''}`)), timeout);
      const settle = (callback, value) => {
        clearTimeout(timer);
        callback(value);
      };
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        const match = LISTENING.exec(stdout);
        if (match) settle(done, Number(match[1]));
      });
      child.once('error', (error) => settle(fail, new Error(`the dev server could not be spawned: ${error.message}`)));
      child.once('exit', (code, signal) => settle(fail, new Error(
        `the dev server exited (${signal ?? `code ${code}`}) before listening${stderr ? `: ${stderr.trim()}` : ''}`
      )));
    });
    // Keep draining stdout so a chatty server can never block on a full pipe.
    child.stdout.resume();

    const base = `http://127.0.0.1:${bound}`;
    if (readyPath) {
      const url = `${base}/${readyPath.replace(/^\//, '')}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
      if (!response.ok) throw new Error(`the dev server answered ${response.status} for ${url}`);
      await response.body?.cancel();
    }
    if (stderr) throw new Error(`the dev server reported an error: ${stderr.trim()}`);
    return { base, port: bound, child, errors: () => stderr, stop };
  } catch (error) {
    stop();
    process.removeListener('exit', stop);
    throw error;
  }
}
