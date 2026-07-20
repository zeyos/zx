/** Browser entry point for the gx compatibility bundle. */
import * as zx from './index.js';
import gx, { install, installElementStorage } from './compat/index.js';

const host = typeof window === 'undefined' ? globalThis : window;
installElementStorage(host);
install(host);
host.zx = zx;

export { gx, zx };
export default gx;
