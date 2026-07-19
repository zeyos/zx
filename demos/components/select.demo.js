import { h, Select } from '../../src/index.js';
import { matchItems } from '../../src/components/select/filter.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-3)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

export default {
  title: 'Select',
  group: 'Inputs',

  /**
   * Mounts Select variants and a shared event log.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const components = [];
    const cleanups = [];
    const log = eventLog();
    const staticItems = makeItems(100, 'Static item');
    const localItems = [
      { ID: 1, name: 'Crème Brûlée', department: 'Dessert' },
      { ID: 2, name: 'Apple Strudel', department: 'Dessert' },
      { ID: 3, name: 'Vienna Roast', department: 'Coffee' },
      { ID: 4, name: 'Green Tea', department: 'Tea' },
      { ID: 5, name: 'Club Sandwich', department: 'Kitchen' }
    ];

    const readonly = addExample('Readonly — 100 static items', {
      items: staticItems,
      value: 9,
      placeholder: 'Choose an item'
    });
    const local = addExample('Local filter + clearable', {
      items: localItems,
      filter: 'local',
      searchKeys: ['name', 'department'],
      clearable: true,
      placeholder: 'Search food and drinks'
    });

    const asyncItems = makeItems(80, 'Remote result');
    const source = createAsyncSource(asyncItems);
    cleanups.push(source.abort);
    const asyncSelect = addExample('Async filter — abortable fake fetch with jitter', {
      filter: source.filter,
      debounce: 40,
      placeholder: 'Type to fetch',
      clearable: true
    });

    const custom = addExample('Custom avatar-style options', {
      items: [
        { ID: 'as', name: 'Ava Stone', role: 'Administrator' },
        { ID: 'bk', name: 'Ben Keller', role: 'Operations' },
        { ID: 'cm', name: 'Cara Müller', role: 'Sales' }
      ],
      value: 'bk',
      renderValue: (item) => item.name,
      renderItem: (item) => h('span', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--zx-space-2)'
        }
      },
      h('span', {
        ariaHidden: 'true',
        style: {
          display: 'grid',
          placeItems: 'center',
          inlineSize: '28px',
          blockSize: '28px',
          flex: 'none',
          borderRadius: 'var(--zx-radius-full)',
          background: 'var(--zx-color-bg-selected)',
          color: 'var(--zx-color-accent)',
          fontWeight: '700'
        }
      }, initials(item.name)),
      h('span', { style: { display: 'grid' } },
        h('strong', {}, item.name),
        h('small', { style: { color: 'var(--zx-color-text-muted)' } }, item.role)
      ))
    });

    const fast = addExample('Local filter — 1,000 items', {
      items: makeItems(1000, 'Inventory record'),
      filter: 'local',
      placeholder: 'Filter 1,000 records'
    });
    const disabled = addExample('Disabled', {
      items: staticItems.slice(0, 5),
      value: 2,
      disabled: true
    });

    const priorityHost = h('div', { style: { maxInlineSize: '360px' } });
    const priority = Select.priority(priorityHost, {
      value: 2,
      msg: {
        'priority.lowest': 'Lowest',
        'priority.low': 'Low',
        'priority.normal': 'Normal',
        'priority.high': 'High',
        'priority.highest': 'Highest'
      }
    });
    priority.refs.input.setAttribute('aria-label', 'Priority preset');
    components.push(priority);
    bindEvents(priority, 'Priority', log.write);

    const marker = h('div', {
      style: { display: 'grid', gap: 'var(--zx-space-5)' }
    },
    readonly, local, asyncSelect, custom, fast,
    section('Priority preset', priorityHost),
    disabled,
    section('Event log', log.element));
    container.append(marker);

    const observer = new MutationObserver(() => {
      if (marker.isConnected) return;
      components.forEach((component) => component.destroy());
      cleanups.forEach((cleanup) => cleanup());
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    /** @param {string} title @param {import('../../src/components/select/select.js').SelectOptions} options @returns {HTMLElement} */
    function addExample(title, options) {
      const host = h('div', { style: { maxInlineSize: '360px' } });
      const select = new Select(host, options);
      select.refs.input.setAttribute('aria-label', title);
      components.push(select);
      bindEvents(select, title, log.write);
      return section(title, host);
    }
  }
};

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: sectionStyle },
    h('h2', { style: { margin: '0', fontSize: 'var(--zx-text-lg)' } }, title),
    children
  );
}

/** @param {number} count @param {string} prefix @returns {Array<{ID: number, name: string}>} */
function makeItems(count, prefix) {
  return Array.from({ length: count }, (_, index) => ({ ID: index, name: `${prefix} ${index + 1}` }));
}

/**
 * @param {Select} select
 * @param {string} label
 * @param {(message: string) => void} write
 * @returns {void}
 */
function bindEvents(select, label, write) {
  for (const type of ['change', 'open', 'close', 'query', 'loaded']) {
    select.on(type, (event) => {
      const detail = event.detail;
      let summary = '';
      if (type === 'change') summary = ` value=${String(detail.value)}`;
      if (type === 'query') summary = ` query="${detail.query}"`;
      if (type === 'loaded') summary = ` items=${detail.items.length}`;
      write(`${label}: ${type}${summary}`);
    });
  }
}

/** @returns {{element: HTMLElement, write: (message: string) => void}} */
function eventLog() {
  const lines = [];
  const element = h('pre', {
    ariaLive: 'polite',
    style: {
      minBlockSize: '80px',
      margin: '0',
      color: 'var(--zx-color-text-muted)',
      fontFamily: 'var(--zx-font-mono)',
      fontSize: 'var(--zx-text-xs)',
      whiteSpace: 'pre-wrap'
    }
  }, 'Interact with a select to see events.');
  return {
    element,
    write(message) {
      lines.unshift(message);
      element.textContent = lines.slice(0, 12).join('\n');
    }
  };
}

/**
 * @param {Array<{ID: number, name: string}>} items
 * @returns {{filter: (query: string) => Promise<Array<{ID: number, name: string}>>, abort: () => void}}
 */
function createAsyncSource(items) {
  let controller = null;
  return {
    async filter(query) {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const jitter = 100 + ((query.length * 137) % 420);
      await abortableDelay(jitter, signal);
      return matchItems(items, query, ['name']);
    },
    abort() {
      controller?.abort();
    }
  };
}

/** @param {number} ms @param {AbortSignal} signal @returns {Promise<void>} */
function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Request aborted'));
    }, { once: true });
  });
}

/** @param {string} name @returns {string} */
function initials(name) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}
