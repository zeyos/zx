import { Tooltip, button, describe, h, tooltip } from '../../src/index.js';

const PLACEMENTS = ['top', 'top-start', 'top-end', 'bottom', 'bottom-start', 'bottom-end'];

export default {
  title: 'Tooltip',
  group: 'Overlays',
  api: ['Tooltip', 'tooltip', 'describe'],
  blurb: 'A description bubble that never takes focus and never takes the pointer: hover opens it '
    + 'after a beat, keyboard focus opens it at once, and touch leaves it alone.',

  examples: [
    {
      title: 'Placements',
      blurb: 'tooltip(anchor, options) attaches a bubble to any element. The placement is a '
        + 'preference \u2014 a bubble that would leave the viewport flips to the other side.',
      render: ({ cleanup, log }) => {
        const tooltips = PLACEMENTS.map((placement) => {
          const anchor = button({ label: placement });
          const instance = tooltip(anchor, { content: `Placed ${placement}`, placement, delay: 120 });
          instance.on('open', () => log(`${placement}: open`));
          return { anchor, instance };
        });
        cleanup(() => tooltips.forEach(({ instance }) => instance.destroy()));
        return h('div', {
          style: {
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--zx-space-6)', placeItems: 'center', paddingBlock: 'var(--zx-space-6)'
          }
        }, tooltips.map(({ anchor }) => anchor));
      }
    },
    {
      title: 'describe() \u2014 the title attribute, done properly',
      blurb: 'One call, every default in place. Unlike title, the bubble appears on keyboard focus '
        + 'as well as hover, is styled with the rest of the application, and is wired as '
        + 'aria-describedby so a screen reader announces it with the control.',
      render: ({ cleanup }) => {
        const save = button({ label: 'Save', kind: 'primary' });
        const revert = button({ label: 'Revert' });
        const search = h('input', { type: 'search', placeholder: 'Search records', style: { inlineSize: '200px' } });
        const tooltips = [
          describe(save, 'Writes the record and closes the editor.'),
          describe(revert, 'Throws away every unsaved change.'),
          describe(search, 'Matches company, contact, and city.')
        ];
        cleanup(() => tooltips.forEach((instance) => instance.destroy()));
        return [save, revert, search];
      }
    },
    {
      title: 'Content',
      blurb: 'content takes a string, a node, or a function evaluated on every open \u2014 so a bubble '
        + 'can describe state that has moved since the page loaded. maxWidth wraps a long '
        + 'description instead of letting it stretch across the viewport.',
      render: ({ cleanup }) => {
        let opens = 0;
        const live = button({ label: 'Live content' });
        const rich = button({ label: 'Node content' });
        const narrow = button({ label: 'Narrow bubble' });
        const tooltips = [
          tooltip(live, {
            content: () => `Opened ${(opens += 1)} time${opens === 1 ? '' : 's'}`,
            placement: 'bottom',
            delay: 120
          }),
          tooltip(rich, {
            content: h('span', {},
              h('strong', {}, 'Danube Systems AG'), h('br'),
              'Quarterly business review every January.'),
            placement: 'bottom-start',
            delay: 120
          }),
          tooltip(narrow, {
            content: 'A long description wraps at maxWidth instead of stretching across the '
              + 'viewport, so it stays readable next to the control it belongs to.',
            maxWidth: 180,
            placement: 'bottom',
            delay: 120
          })
        ];
        cleanup(() => tooltips.forEach((instance) => instance.destroy()));
        return [live, rich, narrow];
      }
    },
    {
      title: 'Triggers',
      blurb: 'trigger narrows what opens the bubble: "hover", "focus", or "manual" for one driven '
        + 'entirely by toggle(). disable() suppresses a tooltip without tearing it down \u2014 for a '
        + 'control whose explanation only applies in some states.',
      render: ({ cleanup }) => {
        const hoverOnly = button({ label: 'Hover only' });
        const focusOnly = button({ label: 'Focus only' });
        const manualAnchor = button({ label: 'Manual' });
        const suppressibleAnchor = button({ label: 'Suppressible' });

        const manual = new Tooltip(manualAnchor, {
          content: 'Opened by toggle(), closed by nothing else.',
          trigger: 'manual',
          placement: 'top'
        });
        const suppressible = tooltip(suppressibleAnchor, { content: 'Enabled.', delay: 120 });
        const toggleButton = button({ label: 'disable()' });
        toggleButton.addEventListener('click', () => {
          const off = suppressible.isDisabled();
          if (off) suppressible.enable();
          else suppressible.disable();
          toggleButton.textContent = off ? 'disable()' : 'enable()';
        });

        const tooltips = [
          tooltip(hoverOnly, { content: 'Tabbing here shows nothing.', trigger: 'hover', delay: 120 }),
          tooltip(focusOnly, { content: 'Tab to me \u2014 the pointer is ignored.', trigger: 'focus' }),
          manual,
          suppressible
        ];
        cleanup(() => tooltips.forEach((instance) => instance.destroy()));
        return [
          hoverOnly,
          focusOnly,
          manualAnchor,
          button({ label: 'toggle()', onclick: () => manual.toggle() }),
          suppressibleAnchor,
          toggleButton
        ];
      }
    }
  ]
};
