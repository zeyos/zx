import { Form, h } from '../../src/index.js';

const panelStyle = {
  display: 'grid',
  gap: 'var(--zx-space-4)',
  padding: 'var(--zx-space-5)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)'
};

export default {
  title: 'Form system',
  group: 'Forms',

  /**
   * Mounts a complete contact form using every built-in field adapter.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', whiteSpace: 'pre-wrap' }
    }, 'Edit a value or submit the form.');
    const form = new Form(null, {
      fieldsets: [
        {
          title: 'Contact details',
          columns: 2,
          fields: {
            name: {
              type: 'text', label: 'Name', description: 'Full display name', required: true,
              placeholder: 'Ada Lovelace'
            },
            password: { type: 'password', label: 'Portal password', value: 'analytical-engine' },
            notes: { type: 'textarea', label: 'Notes', value: 'Prefers written correspondence.', props: { rows: 3 } },
            active: { type: 'checkbox', label: 'Active contact', value: true },
            visits: { type: 'int', label: 'Visits', value: '12', required: true },
            revenue: {
              type: 'float', label: 'Annual revenue', value: '1.234,56',
              description: 'Decimal comma and grouped values are accepted.'
            },
            country: {
              type: 'select', label: 'Country', value: 'AT',
              options: { AT: 'Austria', DE: 'Germany', CH: 'Switzerland' }
            },
            contactMethod: {
              type: 'optionlist', label: 'Preferred contact', value: 'email',
              options: { email: 'Email', phone: 'Phone', post: 'Post' }
            }
          }
        },
        {
          title: 'System data',
          columns: 2,
          fields: {
            recordId: { type: 'hidden', value: 'contact-1042' },
            summary: {
              type: 'html', label: 'Record status',
              value: 'This static field is display-only and safely rendered as text.'
            },
            priority: {
              type: 'custom', label: 'Priority', value: 60, adapter: rangeAdapter,
              props: { min: 0, max: 100, step: 10 }
            }
          }
        }
      ],
      actions: [
        { label: 'Reset', type: 'reset' },
        { label: 'Save contact', type: 'submit', kind: 'primary' }
      ],
      onchange: (event) => {
        log.textContent = `change ${event.detail.id}: ${JSON.stringify(event.detail.value)}`;
      },
      onsubmit: (event) => {
        log.textContent = `submit\n${JSON.stringify(event.detail.values, null, 2)}`;
      },
      oninvalid: (event) => {
        log.textContent = `invalid\n${JSON.stringify(event.detail.errors, null, 2)}`;
      }
    });

    const controls = h('div', {
      style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-2)' }
    },
    h('button', {
      class: 'zx-btn', type: 'button', onclick: () => form.setValues({ name: 'Grace Hopper', visits: 7, revenue: 9876.5 })
    }, 'setValues()'),
    h('button', {
      class: 'zx-btn', type: 'button', onclick: () => { log.textContent = JSON.stringify(form.getValues(), null, 2); }
    }, 'getValues()'),
    h('button', { class: 'zx-btn', type: 'button', onclick: () => form.reset() }, 'reset()'),
    h('button', {
      class: 'zx-btn', type: 'button', onclick: () => form.setHighlights({ name: 'Example danger highlight.', revenue: 'Review this amount.' })
    }, 'Show highlights'),
    h('button', { class: 'zx-btn', type: 'button', onclick: () => form.clearHighlights() }, 'Clear highlights'));
    const marker = h('section', { style: panelStyle },
      h('p', {}, 'Resize the demo pane to see the two-column fieldsets collapse through container queries.'),
      controls,
      form,
      log
    );
    container.append(marker);
    cleanupWhenRemoved(marker, () => form.destroy());
  }
};

/** @returns {import('../../src/components/field/field.js').FieldAdapter} */
function rangeAdapter(_field, options) {
  const input = h('input', { type: 'range', ...(options.props ?? {}) });
  return {
    el: input,
    get: () => Number(input.value),
    set: (value) => { input.value = String(value ?? 0); },
    focus: () => input.focus(),
    setDisabled: (disabled) => { input.disabled = disabled; }
  };
}

/** @param {Node} marker @param {() => void} cleanup @returns {void} */
function cleanupWhenRemoved(marker, cleanup) {
  const observer = new MutationObserver(() => {
    if (marker.isConnected) return;
    cleanup();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
