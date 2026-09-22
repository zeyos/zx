import { FileItem, button, h } from '../../src/index.js';

// The host supplies state and URLs. FileItem never starts a transfer or invents authorization.
function fileStates() {
  return [
    { id: 'ready', name: 'signed-contract.pdf', size: 842137, mime: 'application/pdf', status: 'ready', link: { href: '#signed-contract', download: 'signed-contract.pdf' } },
    { id: 'temporary', name: 'scan.tmp', size: 196204, mime: 'image/png', status: 'temporary' },
    { id: 'waiting', name: 'archive.zip', size: 5242880, mime: 'application/zip', status: 'waiting', indeterminate: true },
    { id: 'processing', name: 'invoice-import.csv', size: 72192, mime: 'text/csv', status: 'processing', progress: 68 },
    { id: 'success', name: 'export.xlsx', size: 381952, status: 'success', progress: 100 },
    { id: 'error', name: 'damaged-upload.bin', status: 'error', statusLabel: 'Checksum failed', progress: 43 }
  ];
}

export default {
  title: 'File item',
  group: 'Data',
  api: ['FileItem'],
  blurb: 'A durable or transient file row with MIME/size metadata, native downloads, actions, and accessible progress.',
  examples: [
    {
      title: 'File lifecycle states',
      blurb: 'Ready, temporary, queued, processing, successful, and failed files share one stable '
        + 'anatomy. Transport and retry behavior remain application code.',
      layout: 'stack',
      width: '680px',
      render: ({ cleanup, log }) => {
        const files = fileStates().map((descriptor) => new FileItem(null, {
          ...descriptor,
          actions: [{ id: 'more', title: `Actions for ${descriptor.name}`, icon: 'dots' }],
          onaction: ({ detail }) => log(`${detail.id}: ${detail.file.name}`),
          onactivate: (event) => {
            event.preventDefault();
            log(`download ${event.detail.file.name}`);
          }
        }));
        cleanup(() => files.forEach((file) => file.destroy()));
        return files.map((file) => h('div', {}, file.toElement()));
      }
    },
    {
      title: 'Host-driven progress',
      blurb: 'setProgress and setStatus update presentation only. An uploader can call them from '
        + 'its own progress callbacks without coupling FileItem to a transport.',
      layout: 'stack',
      width: '620px',
      render: ({ cleanup, log }) => {
        let value = 20;
        const file = new FileItem(null, {
          name: 'customer-import.csv', size: 1048576, mime: 'text/csv',
          status: 'uploading', progress: value
        });
        cleanup(() => file.destroy());
        return [
          file.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Advance', onclick: () => {
              value = Math.min(100, value + 20);
              file.setProgress(value).setStatus(value === 100 ? 'success' : 'uploading');
              log(`${value}%`);
            } }),
            button({ label: 'Unknown progress', onclick: () => file.setProgress(null, { indeterminate: true }) }),
            button({ label: 'Fail', kind: 'danger', onclick: () => file.setStatus('error', 'Upload failed') }))
        ];
      }
    }
  ]
};
