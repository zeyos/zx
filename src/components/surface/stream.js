// @ts-check
/**
 * Splitting streamed text into the operation lines of a surface.
 *
 * A surface arrives as JSON Lines. `lineSplitter()` turns string chunks of any size into whole
 * lines, and `inlineSplitter()` separates the lines of a fenced surface from the prose of an answer
 * that carries one, without holding the prose back.
 *
 * The module touches no DOM and imports nothing, so it runs unchanged in a browser and on a server.
 */

/** Longest line `lineSplitter()` buffers by default: 256 KiB of characters. */
export const MAX_LINE = 262144;

/** The line that opens a surface inside answer text. */
export const OPEN_FENCE = '```zx-surface';

/** The line that closes it. */
export const CLOSE_FENCE = '```';

/**
 * A problem found while splitting a stream.
 * - `line-too-long`: a line grew past `maxLine`; it is dropped up to its end.
 * - `unterminated-fence`: the text ended inside a surface fence.
 * @typedef {Object} StreamError
 * @property {'line-too-long'|'unterminated-fence'} code What went wrong.
 * @property {string} message Human-readable description.
 */

/**
 * Options of `lineSplitter()`.
 * @typedef {Object} LineSplitterOptions
 * @property {number} [maxLine=262144] Longest line, in characters, that is buffered. A longer one
 *   is reported once and dropped up to its end rather than held in memory.
 * @property {(error: StreamError) => void} [onerror] Receives an over-long line's report.
 */

/**
 * What both splitters return: feed it chunks, then end it once.
 * @typedef {Object} StreamSplitter
 * @property {(chunk: string) => void} write Takes the next chunk. Chunk boundaries may fall
 *   anywhere, between `\r` and `\n` included.
 * @property {() => void} end Flushes what is left: a last line without a line break is emitted.
 *   Writing after `end()` is ignored.
 */

/**
 * Splits string chunks into whole lines. Lines end at `\n`; a `\r` right before it is removed, so
 * `\r\n` works too. Every line is emitted, empty ones included, without its line break.
 * @param {(line: string) => void} onLine Receives each complete line.
 * @param {LineSplitterOptions} [options]
 * @returns {StreamSplitter}
 */
export function lineSplitter(onLine, options = {}) {
  const maxLine = positive(options.maxLine, MAX_LINE);
  const onerror = typeof options.onerror === 'function' ? options.onerror : () => {};
  let buffer = '';
  let skipping = false;
  let ended = false;

  const report = () => onerror({ code: 'line-too-long', message: `A line is longer than ${maxLine} characters and was dropped` });

  /** @param {string} line A whole line, possibly still ending in `\r`. */
  const emit = (line) => {
    const text = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (text.length > maxLine) report();
    else onLine(text);
  };

  return {
    write(chunk) {
      if (ended || typeof chunk !== 'string' || chunk === '') return;
      let start = 0;
      for (let newline = chunk.indexOf('\n'); newline !== -1; newline = chunk.indexOf('\n', start)) {
        const piece = chunk.slice(start, newline);
        start = newline + 1;
        // The end of a line already reported as too long: drop it and start afresh.
        if (skipping) {
          skipping = false;
          continue;
        }
        const line = buffer + piece;
        buffer = '';
        emit(line);
      }
      if (skipping) return;
      buffer += chunk.slice(start);
      // One more character than the limit is tolerated: it may be the `\r` of a `\r\n`.
      if (buffer.length > maxLine + 1) {
        buffer = '';
        skipping = true;
        report();
      }
    },
    end() {
      if (ended) return;
      ended = true;
      if (!skipping && buffer !== '') emit(buffer);
      buffer = '';
    }
  };
}

/**
 * Callbacks of `inlineSplitter()`.
 * @typedef {Object} InlineSplitterOptions
 * @property {(text: string) => void} [ontext] Receives prose, as it arrives, unchanged.
 * @property {(line: string) => void} [online] Receives each line inside a surface fence.
 * @property {(error: StreamError) => void} [onerror] Receives an over-long line inside a fence and
 *   a fence still open at `end()`.
 * @property {number} [maxLine=262144] Longest line inside a fence.
 */

/**
 * Separates surface fences from the prose of an answer. A fence opens with a line reading exactly
 * `` ```zx-surface `` and closes with a line reading exactly `` ``` ``; the fence lines themselves
 * go nowhere, and each line between them goes to `online`. Prose goes to `ontext` as soon as it
 * arrives: only the start of a line that could still turn out to be the opening fence is held
 * back, and only until it can no longer be one. Any other line starting with three backticks stays
 * prose.
 * @param {InlineSplitterOptions} options
 * @returns {StreamSplitter}
 */
export function inlineSplitter(options = {}) {
  const ontext = typeof options.ontext === 'function' ? options.ontext : () => {};
  const online = typeof options.online === 'function' ? options.online : () => {};
  const onerror = typeof options.onerror === 'function' ? options.onerror : () => {};

  /** `start`: at the beginning of a prose line; `held`: holding a possible opening fence; `prose`: inside a prose line; `fence`: inside a surface. */
  let mode = /** @type {'start'|'held'|'prose'|'fence'} */ ('start');
  let held = '';
  let ended = false;

  const closeFence = () => { mode = 'start'; };
  /** @type {StreamSplitter} */
  let lines = fenceLines();

  /** @returns {StreamSplitter} A line splitter for one fence's body. */
  function fenceLines() {
    return lineSplitter((line) => {
      if (mode !== 'fence') return;
      if (line === CLOSE_FENCE) closeFence();
      else online(line);
    }, { maxLine: options.maxLine, onerror });
  }

  /**
   * @param {string} text
   * @returns {void}
   */
  function feed(text) {
    let index = 0;
    while (index < text.length) {
      if (mode === 'fence') {
        // Hand the fence body to the line splitter up to and including the closing line; what
        // follows the closing line is prose again.
        const closed = feedFence(text.slice(index));
        if (closed < 0) return;
        index += closed;
        continue;
      }
      if (mode === 'prose') {
        const newline = text.indexOf('\n', index);
        if (newline === -1) {
          ontext(text.slice(index));
          return;
        }
        ontext(text.slice(index, newline + 1));
        index = newline + 1;
        mode = 'start';
        continue;
      }
      // `start` or `held`: compare against the opening fence one character at a time.
      const char = text[index];
      const candidate = held + char;
      if (OPEN_FENCE.startsWith(candidate) || candidate === `${OPEN_FENCE}\r`) {
        held = candidate;
        mode = 'held';
        index += 1;
        continue;
      }
      if (char === '\n' && (held === OPEN_FENCE || held === `${OPEN_FENCE}\r`)) {
        held = '';
        mode = 'fence';
        lines = fenceLines();
        index += 1;
        continue;
      }
      // It can no longer be the fence: release what was held and carry on as prose.
      const release = held;
      held = '';
      mode = 'prose';
      if (release) ontext(release);
    }
  }

  /**
   * Feeds fence text line by line until the closing line, so the prose after it is not swallowed.
   * @param {string} text
   * @returns {number} Characters consumed when the fence closed, or -1 when all were consumed.
   */
  function feedFence(text) {
    let index = 0;
    while (index < text.length) {
      const newline = text.indexOf('\n', index);
      if (newline === -1) {
        lines.write(text.slice(index));
        return -1;
      }
      lines.write(text.slice(index, newline + 1));
      index = newline + 1;
      if (mode !== 'fence') return index;
    }
    return -1;
  }

  return {
    write(chunk) {
      if (ended || typeof chunk !== 'string' || chunk === '') return;
      feed(chunk);
    },
    end() {
      if (ended) return;
      ended = true;
      if (mode === 'held') {
        if (held === OPEN_FENCE || held === `${OPEN_FENCE}\r`) {
          onerror({ code: 'unterminated-fence', message: 'The answer ended inside a surface fence' });
        } else {
          ontext(held);
        }
        held = '';
        return;
      }
      if (mode === 'fence') {
        lines.end();
        if (mode === 'fence') onerror({ code: 'unterminated-fence', message: 'The answer ended inside a surface fence' });
      }
    }
  };
}

/** @param {unknown} value @param {number} fallback @returns {number} */
function positive(value, fallback) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}
