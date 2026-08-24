import { Avatar, Card, h, icon } from '../../src/index.js';

function media(module, glyph) {
  return h('div', {
    style: {
      display: 'grid',
      placeItems: 'center',
      minBlockSize: '8rem',
      blockSize: '100%',
      background: `var(--zx-module-${module})`,
      color: 'var(--zx-color-text-invert)'
    }
  }, icon(glyph, { size: 30 }));
}

export default {
  title: 'Card',
  group: 'Layout',
  api: ['Card'],
  blurb: 'A semantic content or record surface with optional media, a native title link, '
    + 'secondary actions, and metadata.',

  examples: [
    {
      title: 'Content cards',
      blurb: 'Outlined, raised, and filled variants share one quiet anatomy. A linked card uses '
        + 'a real title anchor; the root never becomes a synthetic button.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const variants = ['outlined', 'raised', 'filled'];
        const cards = variants.map((variant, index) => new Card(null, {
          title: ['Northwind renewal', 'Quarterly forecast', 'Design review'][index],
          variant,
          link: '#components/card',
          content: ['Account · Opportunity', 'Revenue · Report', 'Project · Appointment'][index],
          footer: ['Updated 12 minutes ago', '€184,250 pipeline', 'Tomorrow at 10:00'][index],
          actions: [{
            icon: 'dots',
            kind: 'ghost',
            size: 'sm',
            title: `Actions for ${variant} card`,
            onclick: () => log(`${variant}: actions`)
          }]
        }));
        cleanup(() => cards.forEach((card) => card.destroy()));
        return h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 'var(--zx-space-4)'
          }
        }, cards);
      }
    },
    {
      title: 'Media and horizontal records',
      blurb: 'Horizontal cards work for entity and transaction summaries. The media track stacks '
        + 'automatically when the card container becomes narrow.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const avatar = new Avatar(null, { name: 'Ada Lovelace', size: 'xl', status: 'online' });
        const cards = [
          new Card(null, {
            title: 'Acme Industries',
            orientation: 'horizontal',
            media: media('accounts', 'list'),
            link: { href: '#components/card', onclick: () => log('open account') },
            content: h('div', { class: 'demo-stack' },
              h('span', {}, 'Customer · Berlin'),
              h('strong', { style: { color: 'var(--zx-color-text)' } }, '€24,800 open revenue')),
            footer: 'Last contact: 18 August',
            actions: [{ label: 'Call', size: 'sm', onclick: () => log('call account') }]
          }),
          new Card(null, {
            title: 'Ada Lovelace',
            orientation: 'horizontal',
            media: avatar,
            link: '#components/card',
            content: 'Product lead · ada@example.test',
            footer: '3 open tasks'
          })
        ];
        cleanup(() => {
          cards.forEach((card) => card.destroy());
          avatar.destroy();
        });
        return h('div', { class: 'demo-stack' }, cards);
      }
    },
    {
      title: 'Live content updates',
      blurb: 'Title, link, media, body, actions, and footer can be replaced without rebuilding '
        + 'the surrounding collection.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const card = new Card(null, {
          title: 'Draft invoice',
          content: '4 line items',
          footer: 'Not yet sent'
        });
        cleanup(() => card.destroy());
        return [
          card.toElement(),
          h('div', { class: 'demo-row' },
            h('button', {
              type: 'button',
              onclick: () => card.setTitle('Invoice 2026-1042')
                .setContent('4 line items · €1,240.00')
                .setFooter('Paid today')
                .setLink('#components/card')
            }, 'Apply paid state'),
            h('button', {
              type: 'button',
              onclick: () => card.setActions([{
                label: 'Download', size: 'sm', onclick: () => log('download invoice')
              }])
            }, 'Add action'),
            h('button', { type: 'button', onclick: () => card.setLink(null) }, 'Remove link'))
        ];
      }
    }
  ]
};
