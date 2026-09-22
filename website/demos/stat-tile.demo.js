import { button, h, statTile } from '../../src/index.js';

/**
 * One dashboard's worth of metrics, shaped the way a server sends them: the label, the intent
 * colour and the icon all travel with the record. Nothing in `StatTile` knows what a "quote" is.
 */
const METRICS = [
  {
    label: 'Awaiting acceptance',
    value: 3,
    icon: 'clock',
    kind: 'warning',
    delta: 2,
    deltaKind: 'negative',
    deltaLabel: 'vs. last week',
    href: '#components/stat-tile'
  },
  {
    label: 'Signed this month',
    value: 128400,
    format: 'currency',
    currency: 'EUR',
    locale: 'de-DE',
    icon: 'check',
    kind: 'success',
    delta: 0.12,
    deltaFormat: 'percent',
    deltaKind: 'positive',
    deltaLabel: 'vs. last month',
    trend: [82, 91, 88, 104, 99, 118, 128]
  },
  {
    label: 'Open tickets',
    value: 47,
    icon: 'warning',
    kind: 'danger',
    delta: 6,
    deltaKind: 'negative',
    deltaLabel: 'since Monday'
  },
  {
    label: 'Documents stored',
    value: 4823,
    icon: 'folder',
    kind: 'info',
    loading: true
  }
];

/** Every intent, in documentation order. */
const KINDS = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'];

/** A seven-day series, reused wherever an example needs a sparkline. */
const WEEK = [12, 9, 14, 13, 18, 16, 22];

/**
 * Builds one example's tiles and hands the page their lifecycles.
 *
 * `statTile()` returns a `StatTile`, not an element — the same shape as `tooltip()` — so each tile
 * is a component that gets destroyed when the reader navigates away.
 * @param {{cleanup: (fn: () => void) => void}} context The example context.
 * @param {object[]} specs One options object per tile.
 * @returns {object[]} The tiles, in order.
 */
function statTiles(context, specs) {
  return specs.map((spec) => {
    const tile = statTile(spec);
    context.cleanup(() => tile.destroy());
    return tile;
  });
}

/**
 * Lays tiles out the way a dashboard does: as many across as fit, never narrower than a number.
 * @param {...{toElement: () => Element}} tiles Tiles to place.
 * @returns {HTMLElement}
 */
function tileRow(...tiles) {
  return h('div', {
    style: {
      display: 'grid',
      'grid-template-columns': 'repeat(auto-fit, minmax(13rem, 1fr))',
      gap: 'var(--zx-space-3)',
      'inline-size': '100%'
    }
  }, tiles.map((tile) => tile.toElement()));
}

export default {
  title: 'Stat Tile',
  group: 'Data',
  api: ['StatTile'],
  blurb: 'A labelled number: the metric loud, the label small above it, and — when there is one — '
    + 'a signed change that says which way it went without claiming that way is good.',

  examples: [
    {
      title: 'A dashboard row',
      blurb: 'Four metrics as a server would send them, each with its own label, intent colour and '
        + 'icon. The second carries a sparkline, the fourth has not loaded yet. statTile() returns '
        + 'the component, as tooltip() does, so .toElement() gives you the node to place and '
        + 'destroy() takes it away again.',
      layout: 'stack',
      render: (context) => tileRow(...statTiles(context, METRICS))
    },
    {
      title: 'A delta is never colour alone',
      blurb: 'Every tile below went up by the same six. The sign and the arrow say so; deltaKind '
        + 'says whether that is good news, and it defaults to neutral. A rising ticket count is '
        + 'not a success, so "up is good" is never assumed — the metric\'s owner decides.',
      layout: 'stack',
      render: (context) => tileRow(...statTiles(context, [
        { label: 'Deals won', value: 34, delta: 6, deltaKind: 'positive', deltaLabel: 'this week' },
        { label: 'Open tickets', value: 47, delta: 6, deltaKind: 'negative', deltaLabel: 'this week' },
        { label: 'Records touched', value: 812, delta: 6, deltaLabel: 'this week' },
        { label: 'Backlog', value: 47, delta: -6, deltaKind: 'positive', deltaLabel: 'this week' }
      ]))
    },
    {
      title: 'Formats',
      blurb: 'format routes the value through the shared formatters, so a tile prints numbers the '
        + 'way the rest of the application does. locale and currency travel with it. null prints '
        + 'the value untouched, a callback takes the value and returns whatever it likes, and a '
        + 'string value is always rendered exactly as given.',
      layout: 'stack',
      render: (context) => tileRow(...statTiles(context, [
        { label: 'Records', value: 1284000, format: 'number', locale: 'en-US' },
        { label: 'Pipeline', value: 128400.5, format: 'currency', currency: 'EUR', locale: 'de-DE' },
        { label: 'Win rate', value: 0.42, format: 'percent' },
        { label: 'Attachments', value: 74283008, format: 'fileSize' },
        { label: 'Build', value: 4471, format: null },
        { label: 'Capacity', value: 0.82, format: (value) => `${Math.round(value * 100)} of 100` },
        { label: 'Coverage', value: '3 of 5 regions' }
      ]))
    },
    {
      title: 'Intents',
      blurb: 'kind tints the icon and the sparkline. It never touches the value, which stays at '
        + 'full text contrast whatever intent a record carries.',
      layout: 'stack',
      render: (context) => tileRow(...statTiles(context, KINDS.map((kind) => ({
        label: kind, value: 128, kind, icon: 'star', trend: WEEK
      }))))
    },
    {
      title: 'The element follows the behaviour',
      blurb: 'A tile with href is an <a>, a tile with onclick and no href is a <button>, and a tile '
        + 'with neither is a <div>. There is no fourth case: a div never gets a click handler, so '
        + 'a tile you can activate is always something the keyboard and the browser already know '
        + 'how to activate. onclick is the tile\'s click event, so on(\'click\', …) reaches it too.',
      layout: 'stack',
      render: (context) => {
        const tiles = statTiles(context, [
          { label: 'Open tickets', value: 47, kind: 'info', icon: 'tag', href: '#components/stat-tile' },
          {
            label: 'Needs review',
            value: 8,
            kind: 'warning',
            icon: 'eye',
            onclick: (event) => context.log(`activated by ${event.detail.event.type}`)
          },
          { label: 'Records touched', value: 812, icon: 'list' }
        ]);
        return [
          tileRow(...tiles),
          h('div', { class: 'demo-row' },
            h('span', { class: 'demo-caption' },
              tiles.map((tile) => `<${tile.el.tagName.toLowerCase()}>`).join(' · ')))
        ];
      }
    },
    {
      title: 'Loading, then loaded',
      blurb: 'loading: true draws the tile\'s own shape in grey through skeleton() — not a spinner '
        + '— so nothing moves when the numbers arrive. update() then swaps the placeholder for the '
        + 'real metric in place, and the accessible name is rebuilt with it.',
      layout: 'stack',
      render: (context) => {
        const [tile] = statTiles(context, [{
          label: 'Signed this month', kind: 'success', icon: 'check',
          format: 'currency', currency: 'EUR', locale: 'de-DE',
          delta: 0, trend: WEEK, loading: true
        }]);

        const load = button({
          label: 'Load', kind: 'primary',
          onclick: () => {
            tile.update({
              loading: false, value: 128400, delta: 0.12, deltaFormat: 'percent',
              deltaKind: 'positive', deltaLabel: 'vs. last month', trend: WEEK
            });
            context.log(`accessible name: ${tile.getAccessibleName()}`);
          }
        });
        const reset = button({
          label: 'Reset',
          onclick: () => tile.update({ loading: true })
        });
        return [tileRow(tile), h('div', { class: 'demo-row' }, load, reset)];
      }
    }
  ]
};
