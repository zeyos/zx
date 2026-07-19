import { Form, h } from '../../src/index.js';

const WIDGET_IDS = [
  'status', 'permissions', 'dueDate', 'billingMonth', 'appointment', 'effort', 'tags',
  'reviewers', 'attachment', 'disableAll'
];

const ROUND_TRIP_VALUES = {
  status: 'done',
  permissions: ['read', 'approve'],
  dueDate: new Date(2026, 9, 20),
  billingMonth: new Date(2026, 10, 1),
  appointment: new Date(2026, 9, 21, 14, 30),
  effort: 135,
  tags: ['adapter', 'round-trip'],
  reviewers: ['Grace', 'Linus'],
  attachment: null,
  disableAll: false
};

const panelStyle = {
  display: 'grid',
  gap: 'var(--zx-space-4)',
  padding: 'var(--zx-space-5)',
  border: '1px solid var(--zx-color-border)',
  borderRadius: 'var(--zx-radius-lg)',
  background: 'var(--zx-color-bg-surface)'
};

export default {
  title: 'Form widgets',
  group: 'Forms',

  /**
   * Mounts one Form containing every component-backed field type.
   * @param {HTMLElement} container Demo stage.
   * @returns {void}
   */
  mount(container) {
    const log = h('pre', {
      ariaLive: 'polite',
      style: { margin: '0', color: 'var(--zx-color-text-muted)', whiteSpace: 'pre-wrap' }
    }, 'Use getValues() or setValues() to inspect the complete widget value object.');
    const form = new Form(null, {
      fieldsets: [{
        title: 'Component-backed fields',
        columns: 2,
        fields: {
          status: {
            type: 'zxselect',
            label: 'Status',
            value: 'open',
            description: 'Date and datetime use Datebox; month uses MonthPicker.',
            props: {
              items: [
                { ID: 'open', name: 'Open' },
                { ID: 'review', name: 'In review' },
                { ID: 'done', name: 'Done' }
              ],
              filter: 'local',
              clearable: true
            }
          },
          permissions: {
            type: 'checklist',
            label: 'Permissions',
            value: ['read'],
            props: {
              height: 160,
              items: [
                { ID: 'read', name: 'Read' },
                { ID: 'write', name: 'Write' },
                { ID: 'approve', name: 'Approve' }
              ]
            }
          },
          dueDate: {
            type: 'date', label: 'Due date', value: new Date(2026, 6, 19),
            props: { clearable: true }
          },
          billingMonth: {
            type: 'month', label: 'Billing month', value: new Date(2026, 6, 1)
          },
          appointment: {
            type: 'datetime', label: 'Appointment', value: new Date(2026, 6, 19, 9, 30)
          },
          effort: {
            type: 'time', label: 'Effort', value: 90,
            description: 'Numeric duration in the configured unit.',
            props: { unit: 'minutes', signed: true }
          },
          tags: {
            type: 'valuelist', label: 'Tags', value: ['forms', 'widgets'],
            props: { placeholder: 'Type a tag and press Enter' }
          },
          reviewers: {
            type: 'multivalueeditor', label: 'Reviewers', value: ['Ada', 'Margaret'],
            props: { addLabel: 'Add reviewer' }
          },
          attachment: {
            type: 'upload', label: 'Attachment', value: null,
            description: 'Upload values remain null because the server owns the persisted value.',
            props: { autoUpload: false, preview: true }
          },
          disableAll: {
            type: 'toggle', label: 'Disable all widgets', value: false,
            props: { label: 'Disabled' }
          }
        }
      }]
    });

    const syncDisabled = (disabled) => {
      for (const id of WIDGET_IDS) {
        if (id !== 'disableAll') form.getField(id)?.setDisabled(disabled);
      }
    };
    const printValues = (action) => {
      log.textContent = `${action}\n${JSON.stringify(form.getValues(), null, 2)}`;
    };
    form.on('change', (event) => {
      if (event.detail.id === 'disableAll') syncDisabled(Boolean(event.detail.value));
      printValues(`change ${event.detail.id}`);
    });

    const controls = h('div', {
      style: { display: 'flex', flexWrap: 'wrap', gap: 'var(--zx-space-2)' }
    },
    h('button', {
      class: 'zx-btn', type: 'button', onclick: () => printValues('getValues()')
    }, 'getValues()'),
    h('button', {
      class: 'zx-btn',
      type: 'button',
      onclick: () => {
        form.setValues(ROUND_TRIP_VALUES, { silent: true });
        syncDisabled(Boolean(form.getValue('disableAll')));
        printValues('setValues() round-trip');
      }
    }, 'setValues() round-trip'),
    h('button', {
      class: 'zx-btn',
      type: 'button',
      onclick: () => form.getField('status')?.setHighlight('Select highlight on a widget field.', 'warning')
    }, 'Highlight zxselect'),
    h('button', {
      class: 'zx-btn', type: 'button', onclick: () => form.clearHighlights()
    }, 'Clear highlights'));

    form.getField('status')?.setHighlight('Select highlight on a widget field.', 'warning');
    const marker = h('section', { style: panelStyle }, controls, form, log);
    container.append(marker);
    cleanupWhenRemoved(marker, () => form.destroy());
  }
};

/** @param {Node} marker @param {() => void} cleanup @returns {void} */
function cleanupWhenRemoved(marker, cleanup) {
  const observer = new MutationObserver(() => {
    if (marker.isConnected) return;
    cleanup();
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
