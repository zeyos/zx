import { Permission } from '../../src/index.js';

export default {
  title: 'Permission',
  group: 'Forms',
  blurb: 'The ZeyOS record-access control: public, private, or shared with exactly one group.',

  examples: [
    {
      title: 'Record access',
      blurb: 'The value is a tri-state: true for public, false for private, or a group ID. That '
        + 'is the shape the ZeyOS API expects, so the control can be bound straight to a record '
        + 'field without translation.',
      width: '420px',
      render: ({ cleanup, log }) => {
        const permission = new Permission(null, {
          value: true,
          groups: [
            { ID: 101, name: 'Executive team' },
            { ID: 102, name: 'Finance' },
            { ID: 103, name: 'Project Phoenix' },
            { ID: 104, name: 'Vienna office' }
          ],
          onchange: ({ detail }) => log(`change value=${JSON.stringify(detail.value)}`)
        });
        cleanup(() => permission.destroy());
        return permission.toElement();
      }
    }
  ]
};
