import { chromium } from 'playwright-core';

/**
 * Selects an explicitly configured installed browser; never downloads or substitutes one.
 * @param {Record<string, string|undefined>} [env=process.env] Environment to read.
 * @returns {import('playwright-core').LaunchOptions}
 */
export function browserLaunchOptions(env = process.env) {
  const channel = env.ZX_BROWSER_CHANNEL?.trim();
  const executablePath = env.ZX_BROWSER_EXECUTABLE_PATH?.trim();
  if (channel && executablePath) {
    throw new Error('ZX_BROWSER_CHANNEL and ZX_BROWSER_EXECUTABLE_PATH are mutually exclusive');
  }
  return executablePath ? { executablePath } : { channel: channel || 'chrome' };
}

/**
 * Recognizes only a missing browser executable, rather than permission, dependency or crash errors.
 * @param {unknown} error Browser launch failure.
 * @returns {boolean}
 */
export function isMissingBrowserError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:executable (?:doesn't|does not) exist|(?:chromium )?distribution ['"][^'"]+['"] is not found|spawn [^\n]+ ENOENT)/i.test(message);
}

/**
 * Launches the configured installed browser. Explicit suites always fail on launch errors; only
 * optional unit checks may return null when the configured browser executable is absent.
 * @param {{optional?: boolean, env?: Record<string, string|undefined>, browserType?: Pick<typeof chromium, 'launch'>}} [options={}]
 * @returns {Promise<import('playwright-core').Browser|null>}
 */
export async function launchBrowser({ optional = false, env = process.env, browserType = chromium } = {}) {
  const options = browserLaunchOptions(env);
  try {
    return await browserType.launch(options);
  } catch (error) {
    if (optional && isMissingBrowserError(error)) return null;
    throw error;
  }
}
