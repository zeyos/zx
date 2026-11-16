import { Aurora, Card, badge, button, h } from '../../src/index.js';

const PALETTES = {
  northern: ['#21cc75', '#2b7fff', '#9a67ff', '#ffb900'],
  solar: ['#ff6f54', '#ffb900', '#d946ef', '#2b7fff'],
  polar: ['#2b7fff', '#06b6d4', '#21cc75', '#9a67ff']
};

function surface(title, subtitle) {
  const card = new Card(null, {
    variant: 'raised',
    title,
    content: h('div', { class: 'demo-row' },
      badge({ label: 'Open 18', kind: 'info' }),
      badge({ label: 'Due today 5', kind: 'warning' }),
      badge({ label: 'Waiting 12', kind: 'neutral' })),
    footer: subtitle
  });
  return {
    target: h('section', { class: 'demo-aurora-surface' }, card.toElement()),
    card
  };
}

export default {
  title: 'Aurora',
  group: 'Layout',
  api: ['Aurora'],
  blurb: 'A CSS-driven, multicolour ambient light field that decorates an existing surface '
    + 'without owning its content or application logic.',

  examples: [
    {
      title: 'Enhance an existing surface',
      blurb: 'Aurora keeps the surface’s semantics and children intact. Geometry, colours, and '
        + 'intensity can change without rebuilding the content.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const { target, card } = surface('Northwind operations', 'Current workspace');
        const aurora = new Aurora(target, {
          preset: 'source',
          colors: PALETTES.northern,
          intensity: 'balanced'
        });
        cleanup(() => {
          card.destroy();
          aurora.destroy();
        });
        return [
          target,
          h('div', { class: 'demo-row' },
            button({ label: 'Horizon', onclick: () => {
              aurora.setPreset('horizon');
              log('Preset: horizon');
            } }),
            button({ label: 'Solar palette', onclick: () => {
              aurora.setColors(PALETTES.solar);
              log('Palette: solar');
            } }),
            button({ label: 'Reduce intensity', onclick: () => {
              aurora.setIntensity('subtle');
              log('Intensity: subtle');
            } }))
        ];
      }
    },
    {
      title: 'Multicolour geometry presets',
      blurb: 'Every geometry consumes the same four-colour palette differently. Data-heavy '
        + 'surfaces usually start with Source, Horizon, or Edge; Mesh, Ribbon, and Bloom are the '
        + 'richer fields for a hero, a sign-in page, or an empty workspace.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const instances = ['source', 'confluence', 'horizon', 'diagonal', 'edge', 'curtain', 'mesh', 'ribbon', 'bloom']
          .map((preset) => {
            const { target, card } = surface(preset[0].toUpperCase() + preset.slice(1), 'Aurora preset');
            target.classList.add('demo-aurora-surface--compact');
            const aurora = new Aurora(target, {
              preset,
              colors: PALETTES.polar,
              intensity: 'balanced'
            });
            return { target, aurora, card };
          });
        cleanup(() => instances.forEach(({ aurora, card }) => {
          card.destroy();
          aurora.destroy();
        }));
        return h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--zx-space-3)'
          }
        }, instances.map(({ target }) => target));
      }
    },
    {
      title: 'Ambient motion',
      blurb: 'motion: "drift" lets the field breathe while two lights wander across it; "flow" '
        + 'turns a disc of colour slowly behind it. Both move by transform alone, so nothing '
        + 'repaints, and both stay still for readers who ask for reduced motion. '
        + '--zx-aurora-duration sets the pace.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const target = h('section', { class: 'demo-aurora-surface demo-aurora-surface--large' });
        const aurora = new Aurora(target, {
          preset: 'mesh',
          colors: PALETTES.northern,
          intensity: 'vivid',
          motion: 'drift'
        });
        const card = new Card(null, {
          title: 'Good morning, Ines',
          variant: 'raised',
          content: 'Three approvals and one review are waiting for you.',
          footer: 'Workspace · Northwind'
        });
        card.toElement().style.maxInlineSize = '24rem';
        target.append(card.toElement());
        cleanup(() => {
          card.destroy();
          aurora.destroy();
        });
        const choose = (motion, preset) => {
          aurora.setMotion(motion).setPreset(preset);
          log(`motion: ${motion} · preset: ${preset}`);
        };
        return [
          target,
          h('div', { class: 'demo-row' },
            button({ label: 'Drift over Mesh', onclick: () => choose('drift', 'mesh') }),
            button({ label: 'Flow under Ribbon', onclick: () => choose('flow', 'ribbon') }),
            button({ label: 'Flow under Bloom', onclick: () => choose('flow', 'bloom') }),
            button({ label: 'Still', onclick: () => choose('none', 'mesh') }))
        ];
      }
    },
    {
      title: 'Aurora behind Liquid Glass',
      blurb: 'Aurora supplies colour and depth; the raised Card remains responsible for the '
        + 'translucent material, border, blur, and readable content surface.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const target = h('section', { class: 'demo-aurora-surface demo-aurora-surface--large' });
        const aurora = new Aurora(target, {
          preset: 'confluence',
          colors: PALETTES.northern,
          intensity: 'vivid'
        });
        const card = new Card(null, {
          title: 'Quarterly review',
          variant: 'raised',
          content: 'Eight workstreams · 42 open decisions',
          footer: 'Updated a few seconds ago'
        });
        card.toElement().style.maxInlineSize = '24rem';
        target.append(card.toElement());
        cleanup(() => {
          card.destroy();
          aurora.destroy();
        });
        return target;
      }
    }
  ]
};
