import { FileList, button, h } from '../../src/index.js';

// Ordered file descriptors can mix persistent records with in-flight client-side placeholders.
function projectFiles() {
  return [
    { id: 1, name: 'statement-of-work.pdf', size: 482301, mime: 'application/pdf', link: '#statement' },
    { id: 2, name: 'site-survey.jpg', size: 2411724, mime: 'image/jpeg', status: 'success' },
    { id: 'temp-3', name: 'budget-revision.xlsx', size: 193200, status: 'uploading', progress: 35 }
  ];
}

export default {
  title: 'File list',
  group: 'Data',
  api: ['FileList', 'FileItem'],
  blurb: 'An accessible ordered file collection with empty/loading states and incremental host-controlled mutation.',
  examples: [
    {
      title: 'Project files',
      blurb: 'The list forwards file activation and action boundaries while leaving download URLs, '
        + 'permissions, persistence, and server updates with the host.',
      layout: 'stack',
      width: '720px',
      render: ({ cleanup, log }) => {
        const list = new FileList(null, {
          items: projectFiles().map((file) => ({
            ...file,
            actions: [{ id: 'remove', label: 'Remove', icon: 'trash', kind: 'danger' }]
          })),
          onaction: (event) => {
            event.preventDefault();
            log(`${event.detail.id}: ${event.detail.file.name}`);
          },
          onactivate: (event) => {
            event.preventDefault();
            log(`open ${event.detail.file.name}`);
          },
          ondatachange: ({ detail }) => log(`${detail.items.length} file(s)`)
        });
        cleanup(() => list.destroy());
        return [
          list.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Advance upload', onclick: () => {
              const progress = Math.min(100, (list.getItem('temp-3')?.progress ?? 0) + 25);
              list.updateItem('temp-3', { progress, status: progress === 100 ? 'success' : 'uploading' });
            } }),
            button({ label: 'Add file', onclick: () => list.addItem({
              id: `note-${list.getItems().length}`,
              name: 'meeting-notes.txt', size: 4096, mime: 'text/plain', status: 'temporary'
            }) }),
            button({ label: 'Show loading', onclick: () => list.setLoading(true) }),
            button({ label: 'Clear', kind: 'danger', onclick: () => list.setItems([]).setLoading(false) }))
        ];
      }
    }
  ]
};
