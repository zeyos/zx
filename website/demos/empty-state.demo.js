import { Panel, button, emptyState, h } from '../../src/index.js';

export default {
  title: 'EmptyState',
  group: 'Layout',
  blurb: 'The placeholder that stands where content would have been — in a table body, a panel, '
    + 'or a whole page.',

  examples: [
    {
      title: 'Sizes',
      blurb: 'emptyState() returns a plain element you drop wherever the content would have been. '
        + 'Its headline is a paragraph rather than a heading, so nesting one never disturbs the '
        + 'page outline.',
      layout: 'stack',
      render: () => [
        emptyState({
          title: 'No invoices yet',
          description: 'Invoices you create or import appear here. Nothing has been recorded for '
            + 'this account in the selected period.'
        }),
        emptyState({
          size: 'sm',
          icon: 'search',
          title: 'No matches',
          description: 'No record matches the current filter.'
        })
      ]
    },
    {
      title: 'Alignment',
      blurb: 'align: "start" suits a narrow column or a panel body, where centred text reads as a '
        + 'mistake. Everything else stays the same.',
      layout: 'stack',
      width: '420px',
      render: () => [
        emptyState({
          align: 'start',
          icon: 'folder-open',
          title: 'Empty folder',
          description: 'Move a document here to get started.'
        }),
        emptyState({
          align: 'start',
          size: 'sm',
          icon: 'tag',
          title: 'No labels',
          description: 'Labels group records across modules.'
        })
      ]
    },
    {
      title: 'Actions',
      blurb: 'actions takes button descriptors, ready-made elements, or both. Leave it out for a '
        + 'purely informational placeholder, and pass icon: null where the surrounding layout '
        + 'already carries one.',
      layout: 'stack',
      render: ({ log }) => [
        emptyState({
          icon: 'plus',
          title: 'Start your first project',
          description: 'A project collects tasks, documents, and time entries in one place.',
          actions: [
            { label: 'New project', icon: 'plus', kind: 'primary', onclick: () => log('new project') },
            { label: 'Import', icon: 'upload', onclick: () => log('import') },
            button({ label: 'Read the guide', kind: 'ghost', onclick: () => log('guide — an element action') })
          ]
        }),
        emptyState({
          icon: null,
          size: 'sm',
          align: 'start',
          title: 'Nothing to approve',
          description: 'Approvals assigned to you will show up here.'
        })
      ]
    },
    {
      title: 'Inside a panel',
      blurb: 'Sized down and left-aligned, an empty state fills a panel body without competing '
        + 'with the panel title.',
      width: '420px',
      render: ({ cleanup, log }) => {
        const panel = new Panel(null, {
          title: 'Attachments',
          content: emptyState({
            icon: 'upload',
            size: 'sm',
            title: 'No attachments',
            description: 'Drop a file here or upload one from your computer.',
            actions: [
              { label: 'Upload file', icon: 'upload', kind: 'primary', size: 'sm', onclick: () => log('upload') }
            ]
          })
        });
        cleanup(() => panel.destroy());
        return panel.toElement();
      }
    }
  ]
};
