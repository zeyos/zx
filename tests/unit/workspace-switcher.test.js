import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatWorkspaceLabel,
  normalizeWorkspace,
  normalizeWorkspaces,
  resolveActive,
  workspaceInitials
} from '../../src/components/workspace-switcher/workspace-switcher.js';
import { avatarTone } from '../../src/components/avatar/avatar.js';

/* ----------------------------------------------------------------- normalisation -- */

test('a workspace without a usable id is skipped', () => {
  assert.equal(normalizeWorkspace(null), null);
  assert.equal(normalizeWorkspace('north'), null);
  assert.equal(normalizeWorkspace({ label: 'No id' }), null);
  assert.equal(normalizeWorkspace({ id: '', label: 'Empty id' }), null);
  assert.equal(normalizeWorkspace({ id: Number.NaN, label: 'NaN id' }), null);
  assert.equal(normalizeWorkspace({ id: 0, label: 'Zero' })?.id, 0);
});

test('a workspace is normalised without losing what the application put on it', () => {
  const source = { id: 7, label: '  Northwind  ', secondary: 42, tone: 'blue', badge: 3, plan: 'business' };
  const workspace = normalizeWorkspace(source);
  assert.equal(workspace.id, 7);
  assert.equal(workspace.label, 'Northwind');
  assert.equal(workspace.secondary, '42');
  assert.equal(workspace.tone, 'blue');
  assert.equal(workspace.badge, 3);
  assert.equal(workspace.disabled, false);
  assert.equal(workspace.src, null);
  assert.equal(workspace.plan, 'business');
  assert.notEqual(workspace, source, 'the passed object is not mutated in place');
  assert.equal(source.label, '  Northwind  ');
});

test('the label falls back to the id', () => {
  assert.equal(normalizeWorkspace({ id: 'acme' }).label, 'acme');
  assert.equal(normalizeWorkspace({ id: 12, label: '   ' }).label, '12');
});

test('an unknown tone is derived from the label, and a colour suppresses the derived tone', () => {
  assert.equal(normalizeWorkspace({ id: 1, label: 'Acme', tone: 'mauve' }).tone, avatarTone('Acme'));
  assert.equal(normalizeWorkspace({ id: 1, label: 'Acme' }).tone, avatarTone('Acme'));
  const coloured = normalizeWorkspace({ id: 1, label: 'Acme', color: ' #336699 ' });
  assert.equal(coloured.tone, null);
  assert.equal(coloured.color, '#336699');
  // An explicit tone is kept beside a colour; the tile lets the colour win.
  assert.equal(normalizeWorkspace({ id: 1, label: 'Acme', tone: 'teal', color: '#336699' }).tone, 'teal');
});

test('empty image sources and badges are dropped', () => {
  const workspace = normalizeWorkspace({ id: 1, label: 'Acme', src: '  ', badge: '' });
  assert.equal(workspace.src, null);
  assert.equal(workspace.badge, undefined);
  assert.equal(normalizeWorkspace({ id: 1, label: 'Acme', src: ' /logo.png ' }).src, '/logo.png');
});

test('a list keeps the first entry for a repeated id, comparing ids as strings', () => {
  const list = normalizeWorkspaces([
    { id: 1, label: 'First' },
    null,
    { label: 'No id' },
    { id: '1', label: 'Repeat' },
    { id: 2, label: 'Second' }
  ]);
  assert.deepEqual(list.map((workspace) => workspace.label), ['First', 'Second']);
  assert.deepEqual(normalizeWorkspaces(undefined), []);
  assert.deepEqual(normalizeWorkspaces({ id: 1 }), []);
});

/* -------------------------------------------------------------- active resolution -- */

test('the active workspace defaults to the first enabled one', () => {
  const list = normalizeWorkspaces([
    { id: 'old', label: 'Archive', disabled: true },
    { id: 'north', label: 'Northwind' },
    { id: 'acme', label: 'Acme' }
  ]);
  assert.equal(resolveActive(list, null), 'north');
  assert.equal(resolveActive(list, undefined), 'north');
  assert.equal(resolveActive(list, 'missing'), 'north');
});

test('a requested workspace is active when listed and enabled', () => {
  const list = normalizeWorkspaces([
    { id: 1, label: 'One' },
    { id: 2, label: 'Two' },
    { id: 3, label: 'Three', disabled: true }
  ]);
  assert.equal(resolveActive(list, 2), 2);
  assert.equal(resolveActive(list, '2'), 2, 'ids compare as strings and resolve to the listed id');
  assert.equal(resolveActive(list, 3), 1, 'a disabled workspace cannot be active');
});

test('there is no active workspace without an enabled one', () => {
  assert.equal(resolveActive([], 'north'), null);
  assert.equal(resolveActive(normalizeWorkspaces([{ id: 1, label: 'Off', disabled: true }]), 1), null);
});

/* ---------------------------------------------------------------------- initials -- */

test('initials are the first letter of the label, uppercased', () => {
  assert.equal(workspaceInitials('northwind trading'), 'N');
  assert.equal(workspaceInitials('  élan studio '), 'É');
  assert.equal(workspaceInitials('山田商事'), '山');
  assert.equal(workspaceInitials(''), '?');
});

test('explicit initials win, trimmed to two characters', () => {
  assert.equal(workspaceInitials('Northwind Trading', 'NT'), 'NT');
  assert.equal(workspaceInitials('Northwind Trading', '  nwt '), 'nw');
  assert.equal(workspaceInitials('Northwind', '   '), 'N');
  assert.equal(workspaceInitials('Northwind', 5), 'N');
});

test('normalised workspaces carry their initials', () => {
  assert.equal(normalizeWorkspace({ id: 1, label: 'Acme Labs' }).initials, 'A');
  assert.equal(normalizeWorkspace({ id: 1, label: 'Acme Labs', initials: 'AL' }).initials, 'AL');
});

/* ------------------------------------------------------------------ custom label -- */

test('a custom label fills %1 with the active workspace name, every time it is formatted', () => {
  assert.equal(formatWorkspaceLabel('Workspace: %1', 'Northwind'), 'Workspace: Northwind');
  // After a switch the trigger formats the same template with the new name.
  assert.equal(formatWorkspaceLabel('Workspace: %1', 'Acme Labs'), 'Workspace: Acme Labs');
  assert.equal(formatWorkspaceLabel('%1 — switch', 'Acme'), 'Acme — switch');
});

test('a custom label without %1 is used as written, and no workspace leaves %1 empty', () => {
  assert.equal(formatWorkspaceLabel('Change organisation', 'Acme'), 'Change organisation');
  assert.equal(formatWorkspaceLabel('Workspace: %1', null), 'Workspace: ');
  assert.equal(formatWorkspaceLabel('Workspace: %1', ''), 'Workspace: ');
});
