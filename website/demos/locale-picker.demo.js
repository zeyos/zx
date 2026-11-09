import { LocalePicker, stack } from '../../src/index.js';

/** The languages an application ships, as BCP 47 tags. A tag with a region draws that region's flag. */
const APP_LOCALES = ['en-GB', 'en-US', 'de', 'de-AT', 'de-CH', 'fr', 'it'];

/** A longer list: the picker filters once it holds more than seven locales. */
const ALL_LOCALES = [
  'ar', 'cs', 'da', 'de', 'el', 'en', 'es', 'es-419', 'fi', 'fr', 'he', 'hi', 'hu', 'id', 'it',
  'ja', 'ko', 'nb', 'nl', 'pl', 'pt-BR', 'pt-PT', 'ro', 'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'vi',
  'zh-Hans', 'zh-Hant'
];

/** Locales described as items: a name or a flag region of the application's own choosing. */
const CUSTOM_LOCALES = [
  { code: 'en', name: 'English', region: null },
  { code: 'de', name: 'Deutsch', region: null },
  { code: 'tlh', name: 'Klingon (fan translation)', description: 'Community-maintained', region: null }
];

export default {
  title: 'Locale picker',
  group: 'Inputs',
  api: ['LocalePicker'],
  blurb: 'A Select over a list of locales, each named in its own language with the interface\'s '
    + 'name beneath it, and the flag of its region or a language chip before it. Names come from '
    + 'Intl.DisplayNames, so nothing needs translating.',

  examples: [
    {
      title: 'The application\'s languages',
      blurb: 'locales lists the tags to offer, in the order given. A tag with a region draws that '
        + 'region\'s flag; the value is the canonical tag, and set() accepts any spelling of it. '
        + 'Where the platform has no flag emoji, a language chip stands in.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const picker = new LocalePicker(null, {
          locales: APP_LOCALES,
          value: 'de_at'
        });
        log(`value=${picker.value}`);
        picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      title: 'Language chips instead of flags',
      blurb: 'A language is not a country. flags: "code" draws the language code instead, and '
        + 'display: "localized" names every locale in the interface language — set here with '
        + 'displayLocale. preferred pins the main languages above the filterable rest.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const picker = new LocalePicker(null, {
          locales: ALL_LOCALES,
          preferred: ['en', 'de'],
          flags: 'code',
          display: 'localized',
          displayLocale: 'de',
          sort: true,
          clearable: true
        });
        picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
        cleanup(() => picker.destroy());
        return picker.toElement();
      }
    },
    {
      title: 'Flag regions and custom items',
      blurb: 'flagRegions decides the flag of a language whose likely region is not the one meant: '
        + 'English shows the United Kingdom here, Portuguese Brazil. An item can carry its own name, '
        + 'description, and region — null draws the chip.',
      width: '320px',
      render: ({ cleanup, log }) => {
        const regional = new LocalePicker(null, {
          locales: ['en', 'pt', 'es', 'zh'],
          flagRegions: { en: 'GB', pt: 'BR' },
          flags: 'emoji',
          value: 'en'
        });
        const custom = new LocalePicker(null, {
          locales: CUSTOM_LOCALES,
          label: 'Translation',
          value: 'tlh'
        });
        for (const picker of [regional, custom]) {
          picker.on('change', ({ detail }) => log(`change value=${detail.value}`));
          cleanup(() => picker.destroy());
        }
        return stack({ gap: 3 }, regional.toElement(), custom.toElement());
      }
    }
  ]
};
