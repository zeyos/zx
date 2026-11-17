import { Panel, button, emptyState, h } from '../../src/index.js';

// Agents are keyed by their stable id, so a renamed agent keeps its face.
const FINANCE_AGENT = { seed: 'agt-finance', name: 'Finance agent', tone: 'violet', material: 'soft' };
const SCOUT_AGENT = { seed: 'agt-scout', name: 'Scout', material: 'soft' };

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
      title: 'An agent with nothing to do yet',
      blurb: 'agent draws an agent’s generated face in place of the icon: its AgentAvatar traits '
        + 'and name, or true to derive the face from the title. It is decorative and at rest, so the '
        + 'text says whose it is — the opening of a conversation, an agent waiting for its first task.',
      layout: 'stack',
      render: ({ log }) => [
        emptyState({
          agent: FINANCE_AGENT,
          title: 'Ask the Finance agent',
          description: 'It reconciles payments, drafts reminders, and answers questions about your '
            + 'ledger. Nothing it does leaves the workspace without your approval.',
          actions: [{ label: 'Start a conversation', kind: 'primary', onclick: () => log('start conversation') }]
        }),
        emptyState({
          agent: SCOUT_AGENT,
          size: 'sm',
          align: 'start',
          title: 'No tasks for Scout',
          description: 'Tasks you assign to Scout appear here while it works on them.'
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
