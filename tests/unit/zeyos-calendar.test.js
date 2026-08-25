import assert from 'node:assert/strict';
import test from 'node:test';

process.env.TZ = 'Europe/Vienna';

import {
  buildZeyosCalendarOptions, calendarEventToZeyosPatch, zeyosAppointmentToEvent,
  zeyosAppointmentsToEvents
} from '../../src/zeyos/calendar.js';

test('ZeyOS adapter maps current appointment fields and preserves base identity', () => {
  const record = {
    ID: 71,
    name: 'Project kickoff',
    entity: 'projects',
    assoc_name: 'Nordwind rollout',
    location: 'Meeting room 2',
    color: '17a673',
    datefrom: 1787641200,
    dateto: 1787646600
  };
  const mapped = zeyosAppointmentToEvent(record);
  assert.equal(mapped.id, '71@1787641200');
  assert.equal(mapped.title, 'Nordwind rollout: Project kickoff');
  assert.equal(mapped.location, 'Meeting room 2');
  assert.equal(mapped.color, '#17a673');
  assert.equal(mapped.start.getTime(), record.datefrom * 1000);
  assert.equal(mapped.end.getTime(), record.dateto * 1000);
  assert.equal(mapped.data, record);
});

test('expanded recurrence occurrences receive stable distinct occurrence ids', () => {
  const rows = [
    { ID: 9, name: 'Stand-up', datefrom: 1787554800, dateto: 1787556600 },
    { ID: 9, name: 'Stand-up', datefrom: 1787641200, dateto: 1787643000 }
  ];
  assert.deepEqual(zeyosAppointmentsToEvents(rows).map(({ id }) => id), [
    '9@1787554800', '9@1787641200'
  ]);
  assert.throws(() => zeyosAppointmentsToEvents(null), /array/);
});

test('midnight-to-midnight ZeyOS rows infer all-day semantics by local dates', () => {
  const start = new Date(2026, 2, 29);
  const end = new Date(2026, 2, 30);
  const mapped = zeyosAppointmentToEvent({
    ID: 4, name: 'Inventory', datefrom: start.getTime() / 1000, dateto: end.getTime() / 1000
  });
  assert.equal(mapped.allDay, true);
});

test('ZeyOS option builder defaults to optimistic updates but supports controlled mode', () => {
  const controlled = buildZeyosCalendarOptions({
    appointments: [{ ID: 1, name: 'Demo', datefrom: 1787641200, dateto: 1787646600 }],
    optimistic: false,
    workweek: true
  });
  assert.equal(controlled.optimistic, false);
  assert.equal(controlled.workweek, true);
  assert.equal(controlled.events[0].title, 'Demo');

  const generic = [{ id: 'local', title: 'Local', start: new Date(2026, 7, 25) }];
  const defaults = buildZeyosCalendarOptions({ events: generic });
  assert.equal(defaults.optimistic, true);
  assert.equal(defaults.weekStart, 1);
  assert.equal(defaults.events, generic);
});

test('Calendar proposals convert back to Unix-second ZeyOS patches', () => {
  const start = new Date('2026-08-25T09:00:00.750Z');
  const end = new Date('2026-08-25T10:30:00.999Z');
  assert.deepEqual(calendarEventToZeyosPatch({ start, end, data: { ID: 91 } }), {
    ID: 91,
    datefrom: Math.floor(start.getTime() / 1000),
    dateto: Math.floor(end.getTime() / 1000)
  });
  assert.throws(() => calendarEventToZeyosPatch({ start: 'bad', end }), /Dates/);
});
