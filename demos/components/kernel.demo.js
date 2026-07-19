import {
  Component, formatDate, h, icon, icons, parseDate, position
} from '../../src/index.js';

const sectionStyle = {
  display: 'grid',
  gap: 'var(--zx-space-4)',
  marginBlockEnd: 'var(--zx-space-8)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)',
  padding: 'var(--zx-space-5)'
};

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--zx-space-3)'
};

export default {
  title: 'Kernel',
  group: 'Core',

  /**
   * Mounts interactive proofs for the core kernel APIs.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const positioned = positionPlayground();
    const component = componentPlayground();
    const marker = h('div', {},
      hyperscriptCard(),
      positioned.element,
      iconGallery(),
      dateRoundTrip(),
      component.element
    );
    container.append(marker);

    const observer = new MutationObserver(() => {
      if (marker.isConnected) return;
      positioned.cleanup();
      component.cleanup();
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
};

/** @returns {HTMLElement} */
function hyperscriptCard() {
  const refs = {};
  const card = h.scope(refs, () => section('h() with refs and events',
    h('p', {}, 'This card and its children are built with h(); the button and log are collected as refs.'),
    h('button', {
      ref: 'button',
      type: 'button',
      onclick: () => {
        refs.log.textContent = `Clicked at ${new Date().toLocaleTimeString()}`;
      }
    }, 'Write event log'),
    h('pre', {
      ref: 'log',
      ariaLive: 'polite',
      style: {
        margin: '0',
        color: 'var(--zx-color-text-muted)',
        fontFamily: 'var(--zx-font-mono)'
      }
    }, 'No events yet.')
  ));
  return card;
}

/** @returns {{element: HTMLElement, cleanup: () => void}} */
function positionPlayground() {
  let controller = null;
  const panel = h('div', {
    popover: 'manual',
    style: {
      maxInlineSize: '240px',
      border: '1px solid var(--zx-color-border-strong)',
      borderRadius: 'var(--zx-radius-md)',
      background: 'var(--zx-color-bg-raised)',
      boxShadow: 'var(--zx-overlay-shadow)',
      padding: 'var(--zx-space-4)'
    }
  },
  h('strong', {}, 'Anchored panel'),
  h('p', {}, 'Scroll the box: this popover follows the button and flips at viewport edges.'),
  h('button', { type: 'button', onclick: () => close() }, 'Close'));
  const anchor = h('button', { type: 'button', onclick: () => toggle() }, 'Toggle anchored panel');
  const placement = h('select', {
    ariaLabel: 'Popover placement',
    onchange: (event) => {
      if (!controller) return;
      controller.destroy();
      controller = position(anchor, panel, { placement: event.currentTarget.value });
    }
  }, ['bottom-start', 'bottom-end', 'top-start', 'top-end', 'bottom', 'top'].map((value) =>
    h('option', { value }, value)
  ));
  const scroller = h('div', {
    style: {
      overflow: 'auto',
      blockSize: '220px',
      border: '1px solid var(--zx-color-border)',
      borderRadius: 'var(--zx-radius-md)',
      background: 'var(--zx-color-bg-page)',
      paddingInline: 'var(--zx-space-5)'
    }
  },
  h('div', { style: { blockSize: '140px' } }),
  anchor,
  h('div', { style: { blockSize: '300px' } }),
  panel);

  /** @returns {void} */
  function toggle() {
    if (controller) close();
    else controller = position(anchor, panel, { placement: placement.value });
  }

  /** @returns {void} */
  function close() {
    controller?.destroy();
    controller = null;
  }

  return {
    element: section('position() playground', h('label', { style: rowStyle },
      h('span', {}, 'Placement'), placement
    ), scroller),
    cleanup: close
  };
}

/** @returns {HTMLElement} */
function iconGallery() {
  const gallery = h('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: 'var(--zx-space-3)'
    }
  });
  for (const name of Object.keys(icons)) {
    gallery.append(h('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--zx-space-2)',
        color: 'var(--zx-color-text-muted)',
        fontSize: 'var(--zx-text-sm)'
      }
    }, icon(name, { size: 18 }), h('span', {}, name)));
  }
  return section('Icon gallery', gallery);
}

/** @returns {HTMLElement} */
function dateRoundTrip() {
  const format = h('input', { value: '%d.%m.%Y %H:%M', ariaLabel: 'Date format' });
  const value = h('input', {
    value: formatDate(new Date(), format.value),
    ariaLabel: 'Formatted date value'
  });
  const output = h('output', {
    style: { color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
  });

  /** @returns {void} */
  function update() {
    const parsed = parseDate(value.value, format.value);
    output.textContent = parsed ?
      `Parsed ${parsed.toISOString()} → ${formatDate(parsed, format.value)}` :
      'No strict match';
  }
  format.addEventListener('input', update);
  value.addEventListener('input', update);
  update();

  return section('Date format / parse round trip',
    h('div', { style: rowStyle },
      h('label', {}, 'Format ', format),
      h('label', {}, 'Value ', value)
    ),
    output
  );
}

/** @returns {{element: HTMLElement, cleanup: () => void}} */
function componentPlayground() {
  let example = null;
  const log = h('pre', {
    ariaLive: 'polite',
    style: { margin: '0', color: 'var(--zx-color-text-muted)', fontFamily: 'var(--zx-font-mono)' }
  }, 'Create the component to begin.');
  const host = h('div', { style: rowStyle });

  host.addEventListener('zx-change', (event) => {
    log.textContent += `\nDOM zx-change bubbled: ${event.detail.value}`;
  });

  /** @returns {void} */
  function create() {
    if (example) return;
    example = new KernelExample(null, {
      start: 0,
      onchange: (event) => {
        log.textContent = `Component change: ${event.detail.value}`;
      }
    });
    example.on('change', (event) => {
      log.textContent += `\nComponent on(): ${event.detail.value}`;
    });
    host.append(example.toElement());
    log.textContent = `Created; Component.from(root) found it: ${Component.from(example.el) === example}`;
  }

  /** @returns {void} */
  function destroy() {
    example?.destroy();
    example = null;
    log.textContent = 'Destroyed; listeners, registry, and created root were cleaned up.';
  }

  const controls = h('div', { style: rowStyle },
    h('button', { type: 'button', onclick: create }, 'Create'),
    h('button', { type: 'button', onclick: destroy }, 'Destroy')
  );
  create();
  return {
    element: section('Component lifecycle and events', controls, host, log),
    cleanup: destroy
  };
}

/** Tiny component used by the lifecycle demo. */
class KernelExample extends Component {
  static cssName = 'kernel-example';
  static defaults = { start: 0 };

  /** @returns {HTMLElement} */
  render() {
    this.count = Number(this.options.start);
    const root = h('div', { style: rowStyle },
      h('button', { ref: 'increment', type: 'button' }, 'Increment'),
      h('output', { ref: 'value' }, String(this.count))
    );
    this.listen(this.refs.increment, 'click', () => {
      this.count += 1;
      this.refs.value.textContent = String(this.count);
      this.emit('change', { value: this.count });
    });
    return root;
  }
}

/** @param {string} title @param {...Node} children @returns {HTMLElement} */
function section(title, ...children) {
  return h('section', { style: sectionStyle }, h('h2', { style: { margin: '0' } }, title), children);
}
