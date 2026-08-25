import { AppIcon, h } from '../../src/index.js';
import {
  ZEYOS_LAUNCHER_APPLICATIONS, moduleInfo, zeyosAppIcon
} from '../../src/zeyos/index.js';
import { demoZeyosAppIcon } from '../zeyos-demo-icons.js';

export default {
  title: 'AppIcon',
  group: 'Layout',
  api: ['AppIcon'],
  blurb: 'A stable application-identity tile with a centred white glyph, module colour, accessible labeling, hover/focus feedback, badges, selection state, and an optional CSS-first glass material.',
  examples: [
    {
      id: 'zeyos-app-icon',
      title: 'zeyosAppIcon()',
      preset: true,
      blurb: 'The ZeyOS adapter maps every application in the current launcher catalogue to its canonical colour and a consistently centred white glyph. This offline gallery supplies built-in glyph overrides; an application that calls useZeyosIcons() receives the exact existing ZeyOS glyphs.',
      render: () => h('div', {
        style: {
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
          gap: 'var(--zx-space-4)', inlineSize: '100%'
        }
      }, ZEYOS_LAUNCHER_APPLICATIONS.map((name) => h('div', {
        style: { display: 'grid', justifyItems: 'center', gap: 'var(--zx-space-2)', textAlign: 'center' }
      },
      demoZeyosAppIcon(name, { size: 44, label: moduleInfo(name).label }),
      h('span', { style: { fontSize: 'var(--zx-text-xs)', color: 'var(--zx-color-text-muted)' } }, moduleInfo(name).label))))
    },
    {
      title: 'Material and state',
      blurb: 'AppIcon itself is product-agnostic. The subtle treatment uses borders and a specular highlight; only strong glass opts into backdrop blur, and reduced-transparency preferences fall back to a solid identity tile.',
      render: ({ cleanup }) => {
        const icons = [
          new AppIcon(null, { icon: 'folder', color: '#bc3885', size: 48, label: 'Flat account', glass: false }),
          new AppIcon(null, { icon: 'calendar', color: '#bd1e32', size: 48, label: 'Calendar', glass: 'subtle' }),
          new AppIcon(null, { icon: 'file', color: '#535494', size: 48, label: 'Selected billing', selected: true, glass: 'strong' }),
          new AppIcon(null, { icon: 'info', color: '#31a8e0', size: 48, label: 'Messages, three unread', badge: 3 })
        ];
        cleanup(() => icons.forEach((item) => item.destroy()));
        return h('div', { class: 'demo-row' }, icons.map((item) => item.toElement()));
      }
    },
    {
      title: 'Host-provided identity',
      blurb: 'Forks, weblets, and other front ends can use the same component with their own colour and glyph. The adapter is a preset, not a restriction on the core AppIcon contract.',
      render: () => h('div', { class: 'demo-row' },
        zeyosAppIcon('projects', { size: 42, icon: 'folder', label: 'Projects' }),
        zeyosAppIcon('transactions.billing', { size: 42, icon: 'file', label: 'Billing transactions' }))
    }
  ]
};
