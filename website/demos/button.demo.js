import { button, buttonGroup } from '../../src/index.js';

export default {
  title: 'Button',
  group: 'Inputs',
  blurb: 'Factories that return a real <button>, in four weights and two sizes.',

  examples: [
    {
      title: 'Kinds',
      blurb: 'Four weights for four jobs: the neutral default, one primary action per screen, '
        + 'danger for destructive work, and ghost for toolbars and dense rows.',
      render: ({ log }) => [
        button({ label: 'Default', onclick: () => log('default clicked') }),
        button({ label: 'Primary', kind: 'primary', icon: 'plus', onclick: () => log('primary clicked') }),
        button({ label: 'Danger', kind: 'danger', onclick: () => log('danger clicked') }),
        button({ label: 'Ghost', kind: 'ghost', onclick: () => log('ghost clicked') })
      ]
    },
    {
      title: 'Sizes and icons',
      blurb: 'An icon-only button needs a title: it becomes both the tooltip and the accessible '
        + 'name, since there is no label to read.',
      render: () => [
        button({ label: 'Medium', size: 'md', icon: 'settings' }),
        button({ label: 'Small', size: 'sm', icon: 'filter' }),
        button({ icon: 'reload', title: 'Reload' }),
        button({ label: 'Disabled', disabled: true })
      ]
    },
    {
      title: 'Joined group',
      blurb: 'buttonGroup welds buttons into one control for mutually exclusive choices, so they '
        + 'read as a single segmented switch rather than three separate actions.',
      render: () => buttonGroup([
        button({ label: 'List', size: 'sm' }),
        button({ label: 'Grid', size: 'sm', kind: 'primary' }),
        button({ label: 'Map', size: 'sm' })
      ])
    }
  ]
};
