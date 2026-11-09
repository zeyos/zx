import { CountryPicker, flag, h, stack } from '../../src/index.js';

/** The markets this example ships to, pinned above every other country. */
const MARKETS = ['DE', 'AT', 'CH'];

/** A restricted list: the countries a shipping form accepts, with a note per country. */
const SHIPPING = [
  { code: 'DE', description: 'Standard, 1–2 days' },
  { code: 'AT', description: 'Standard, 2–3 days' },
  { code: 'CH', description: 'Customs declaration required' },
  { code: 'FR', description: 'Standard, 3–4 days' },
  { code: 'IT', description: 'Standard, 3–5 days' },
  { code: 'NL', description: 'Standard, 2–3 days' }
];

/** Offices for the flag() example: a flag beside a name, outside any picker. */
const OFFICES = [
  { city: 'Vienna', country: 'AT' },
  { city: 'Munich', country: 'DE' },
  { city: 'Zurich', country: 'CH' },
  { city: 'Lisbon', country: 'PT' }
];

export default {
  title: 'Country picker',
  group: 'Inputs',
  api: ['CountryPicker'],
  blurb: 'A filterable Select over the ISO 3166-1 countries, named in the interface language by '
    + 'Intl.DisplayNames and drawn with their flags. The value is the two-letter code.',

  examples: [
    {
      title: 'Every country, main markets first',
      blurb: 'Without countries the picker lists all of them, sorted by name. preferred pins a few '
        + 'above the rest; typing filters by name, code, or English name.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const picker = new CountryPicker(null, {
          preferred: MARKETS,
          clearable: true,
          value: 'at'
        });
        log(`value=${picker.value}`);
        picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      title: 'A restricted list in German',
      blurb: 'countries limits the choice and may carry a description per country. displayLocale '
        + 'names them in another language — search still finds "Germany" — and showCode or a '
        + 'description adds the secondary line.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const picker = new CountryPicker(null, {
          countries: SHIPPING,
          displayLocale: 'de',
          label: 'Lieferland',
          value: 'DE'
        });
        picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      title: 'Flags outside a picker',
      blurb: 'flag() draws the same flag anywhere — a table cell, a profile. It is decorative, so put '
        + 'the name beside it. kind: "code" draws the chip, and src draws from a flag set the '
        + 'application serves (\'/flags/{code}.svg\').',
      width: '320px',
      render: () => stack({ gap: 2 }, ...OFFICES.map((office) => stack({ direction: 'row', gap: 2, align: 'center' },
        flag(office.country),
        flag(office.country, { kind: 'code' }),
        h('span', {}, office.city))))
    }
  ]
};
