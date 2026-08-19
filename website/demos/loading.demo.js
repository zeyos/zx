import { InlineLoading, ProgressBar, button, h, spinner } from '../../src/index.js';

export default {
  title: 'Loading',
  group: 'Feedback',
  api: ['Spinner', 'ProgressBar', 'InlineLoading'],
  blurb: 'Three shapes of "wait": a ring when the duration is unknown, a track when the share '
    + 'done is known, and a status line that resolves into its own outcome.',

  examples: [
    {
      title: 'Spinner',
      blurb: 'spinner() is a plain element — nothing to update, nothing to destroy. A spinner with '
        + 'a label announces itself; one without is marked decorative, which is what a ring inside '
        + 'an already-labelled button wants. kind: "current" makes it inherit the colour it sits in.',
      render: () => [
        h('div', { class: 'demo-field' }, h('span', {}, 'Sizes'),
          h('div', { class: 'demo-row' },
            spinner({ size: 'sm' }), spinner(), spinner({ size: 'lg' }))),
        h('div', { class: 'demo-field' }, h('span', {}, 'With a visible label'),
          spinner({ size: 'sm', label: 'Loading invoices', showLabel: true })),
        h('div', { class: 'demo-field' }, h('span', {}, 'Inside a button'),
          h('button', { class: 'zx-btn', type: 'button', 'data-kind': 'primary', disabled: true },
            spinner({ size: 'sm', kind: 'current' }), h('span', {}, 'Posting…')))
      ]
    },
    {
      title: 'Progress bar',
      blurb: 'The track carries role="progressbar" and its ARIA values, so the number is announced '
        + 'without any wiring. setStatus() colours a finished run; the value stays what it was, '
        + 'because a run that failed at 100% still finished.',
      render: ({ cleanup, log }) => {
        const upload = new ProgressBar(null, {
          label: 'Uploading attachments', value: 35, helperText: '3 of 8 files'
        });
        upload.on('complete', () => log('upload complete'));

        const done = new ProgressBar(null, {
          label: 'Import', value: 100, status: 'success', helperText: '1 204 records imported'
        });
        const failed = new ProgressBar(null, {
          label: 'Export', value: 62, status: 'error', helperText: 'Stopped: connection lost'
        });
        const thin = new ProgressBar(null, {
          label: 'Storage', value: 8.2, max: 10, size: 'sm',
          formatValue: (value, max) => `${value} of ${max} GB`
        });

        const bars = [upload, done, failed, thin];
        cleanup(() => bars.forEach((bar) => bar.destroy()));
        return [
          h('div', { class: 'demo-stack' }, ...bars.map((bar) => bar.toElement())),
          h('div', { class: 'demo-row' },
            button({ label: '+10%', onclick: () => upload.set(upload.get() + 10) }),
            button({ label: 'Finish', onclick: () => upload.set(100) }),
            button({ label: 'Reset', onclick: () => upload.set(0) }))
        ];
      }
    },
    {
      title: 'Unknown duration',
      blurb: 'An indeterminate bar drops aria-valuenow rather than reporting a number it does not '
        + 'have. Without motion the travelling band would read as a stalled bar, so reduced motion '
        + 'gets a muted full-width track instead — busy, but never a wrong number.',
      render: ({ cleanup }) => {
        const bar = new ProgressBar(null, {
          label: 'Rebuilding the search index', indeterminate: true, helperText: 'This can take a minute'
        });
        cleanup(() => bar.destroy());
        return [
          bar.toElement(),
          h('div', { class: 'demo-row' },
            button({
              label: 'Switch to a known share',
              onclick: () => bar.setIndeterminate(false).set(45)
            }),
            button({ label: 'Back to unknown', onclick: () => bar.setIndeterminate(true) }))
        ];
      }
    },
    {
      title: 'Inline loading',
      blurb: 'The status line that replaces a spinner once the wait resolves — "Saving…" becoming '
        + '"Saved" in the same place. The element is one polite live region, so the outcome is '
        + 'announced without moving focus away from the button that started it.',
      render: ({ cleanup, log }) => {
        const status = new InlineLoading(null, { status: 'inactive', description: '' });
        status.on('statuschange', ({ detail }) => log(`status → ${detail.status}`));

        const run = (outcome) => {
          status.set('active', 'Saving…');
          setTimeout(() => {
            if (outcome === 'success') status.set('success', 'Saved just now');
            else status.set('error', 'Could not save — try again');
          }, 1200);
        };

        cleanup(() => status.destroy());
        return [
          h('div', { class: 'demo-row' },
            button({ label: 'Save', kind: 'primary', onclick: () => run('success') }),
            button({ label: 'Save (fails)', onclick: () => run('error') }),
            status.toElement())
        ];
      }
    }
  ]
};
