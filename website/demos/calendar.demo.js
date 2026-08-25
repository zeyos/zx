import { Calendar, h } from '../../src/index.js';
import { calendarEventToZeyosPatch, zeyosCalendar } from '../../src/zeyos/calendar.js';

function weekEvents() {
  return [
    { id: 'kickoff', title: 'Project kickoff', start: new Date(2026, 7, 24, 9), end: new Date(2026, 7, 24, 10, 30), location: 'Meeting room 2', color: '#13795b' },
    { id: 'inspection', title: 'Warehouse inspection', start: new Date(2026, 7, 25, 8, 30), end: new Date(2026, 7, 25, 11), location: 'Linz', color: '#2563a9' },
    { id: 'lunch', title: 'Lunch with Nordwind', start: new Date(2026, 7, 26, 12), end: new Date(2026, 7, 26, 13, 30), location: 'Café Museum', color: '#b85c16' },
    { id: 'planning', title: 'Quarterly planning', start: new Date(2026, 7, 27), end: new Date(2026, 7, 29), allDay: true, color: '#7057a8' },
    { id: 'demo', title: 'Product demo', start: new Date(2026, 7, 27, 14), end: new Date(2026, 7, 27, 15), location: 'Video call', color: '#13795b' },
    { id: 'focus', title: 'Focus time', start: new Date(2026, 7, 28, 9, 30), end: new Date(2026, 7, 28, 12), color: '#597087' }
  ];
}

function zeyosAppointments() {
  const seconds = (year, month, day, hour = 0, minute = 0) =>
    Math.floor(new Date(year, month, day, hour, minute).getTime() / 1000);
  return [
    { ID: 741, name: 'Service review', entity: 'customers', assoc_name: 'Nordwind GmbH', location: 'Vienna', color: '13795b', datefrom: seconds(2026, 7, 25, 10), dateto: seconds(2026, 7, 25, 11) },
    { ID: 812, name: 'Dispatch window', entity: 'projects', assoc_name: 'Warehouse rollout', location: 'Linz', color: '2563a9', datefrom: seconds(2026, 7, 26, 13), dateto: seconds(2026, 7, 26, 15, 30) }
  ];
}

export default {
  title: 'Calendar',
  group: 'Data',
  api: ['Calendar'],
  blurb: 'A dependency-free scheduling surface with agenda, day, week, month, and year views; local-time event layout; range selection; and pointer or keyboard editing.',
  examples: [
    {
      title: 'Editable business week',
      blurb: 'Drag an event to another slot, use its lower resize grip, or focus it and press Space followed by the arrow keys. Optimistic edits update immediately; eventchange supplies an idempotent revert callback for failed persistence.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const calendar = new Calendar(null, {
          date: new Date(2026, 7, 26),
          now: new Date(2026, 7, 26, 10, 42),
          view: 'week',
          events: weekEvents(),
          editable: true,
          selectable: true,
          slotMinTime: 420,
          slotMaxTime: 1200,
          scrollTime: 450,
          oneventchange: ({ detail }) => log(`${detail.action} ${detail.event.title}: ${detail.event.start.toLocaleString()} (call detail.revert() if the write fails)`),
          onselect: ({ detail }) => log(`select ${detail.start.toLocaleString()} – ${detail.end.toLocaleString()}`),
          onnew: ({ detail }) => log(`new event at ${detail.date.toLocaleString()} in ${detail.view}`),
          ondateschange: ({ detail }) => log(`range ${detail.start.toLocaleDateString()} – ${detail.end.toLocaleDateString()}`)
        });
        cleanup(() => calendar.destroy());
        return calendar.toElement();
      }
    },
    {
      title: 'Application-controlled updates',
      blurb: 'Set optimistic: false when server acceptance must precede the visible move. The proposal is emitted without changing local events; this example applies it after a short simulated response.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const status = h('p', { class: 'demo-caption' }, 'Move “Project kickoff”; its old slot stays put until the simulated save completes.');
        let saveTimer = 0;
        const calendar = new Calendar(null, {
          date: new Date(2026, 7, 24),
          now: new Date(2026, 7, 24, 11, 15),
          view: 'day',
          views: ['day', 'week'],
          events: weekEvents(),
          editable: true,
          optimistic: false,
          slotMinTime: 420,
          slotMaxTime: 1080,
          oneventchange: ({ detail }) => {
            window.clearTimeout(saveTimer);
            status.textContent = `Saving ${detail.event.title}…`;
            log(`controlled proposal ${detail.event.start.toLocaleString()}`);
            saveTimer = window.setTimeout(() => {
              calendar.updateEvent(detail.event.id, detail.event, { silent: true });
              status.textContent = `${detail.event.title} saved.`;
            }, 450);
          }
        });
        cleanup(() => {
          window.clearTimeout(saveTimer);
          calendar.destroy();
        });
        return [status, calendar.toElement()];
      }
    },
    {
      title: 'Current ZeyOS appointment records',
      blurb: 'The optional binding maps ID, name, association, location, color, datefrom, and dateto. Recurrences stay server-expanded; the occurrence event retains its base row under event.data for persistence.',
      layout: 'stack',
      render: ({ cleanup, log }) => {
        const calendar = zeyosCalendar(null, {
          appointments: zeyosAppointments(),
          date: new Date(2026, 7, 25),
          now: new Date(2026, 7, 25, 9),
          view: 'agenda',
          views: ['agenda', 'week', 'month'],
          agendaDays: 5,
          editable: true,
          oneventchange: ({ detail }) => log(`ZeyOS patch ${JSON.stringify(calendarEventToZeyosPatch(detail.event))}`)
        });
        cleanup(() => calendar.destroy());
        return calendar.toElement();
      }
    }
  ]
};
