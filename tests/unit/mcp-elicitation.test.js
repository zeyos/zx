import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { afterEach } from 'node:test';

import { setLanguage, setTranslator } from '../../src/core/i18n.js';
import { defaultMessages } from '../../src/core/messages.js';
import { elicitDocument } from '../../src/components/surface/elicit.js';
import { MCP_ELICITATION_VERSION, elicitationHandler, elicitationUrl, urlConsentDocument } from '../../src/components/surface/mcp.js';
import { unsupported } from '../../src/components/surface/schema.js';
import { plainInline } from '../../src/components/surface/text.js';
import { validateDocument } from '../../src/components/surface/validate.js';
import { parseInline } from '../../src/internal/agent-model.js';

/** A recorded request file from `tests/unit/fixtures/`. */
function fixture(revision) {
  const data = JSON.parse(readFileSync(new URL(`./fixtures/mcp-elicitation-${revision}.json`, import.meta.url), 'utf8'));
  assert.equal(data.protocol, `mcp/${revision}`);
  return data;
}

const legacy = fixture('2025-11-25');
const current = fixture('2026-07-28');

/** The `params` of every recorded elicitation request, in both request shapes. */
function recordedParams() {
  return [
    ...legacy.requests.map((request) => request.params),
    ...Object.values(current.result.inputRequests).filter((entry) => entry.method === 'elicitation/create').map((entry) => entry.params)
  ];
}

afterEach(() => {
  setTranslator(null);
  setLanguage('en');
});

/** @param {Promise<unknown>} promise @param {RegExp} [pattern] */
async function rejectsType(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof TypeError, `${error} is not a TypeError`);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
}

test('the handler pins the current MCP revision', () => {
  assert.equal(MCP_ELICITATION_VERSION, '2026-07-28');
  assert.equal(current.result.resultType, 'input_required');
});

test('a handler needs the name of the server that asks', () => {
  assert.throws(() => elicitationHandler(), TypeError);
  assert.throws(() => elicitationHandler({ serverName: '  ' }), TypeError);
  assert.equal(typeof elicitationHandler({ serverName: 'Billing' }), 'function');
});

test('every recorded form request lies inside the supported schema subset, in both shapes', () => {
  const forms = recordedParams().filter((params) => params.mode === undefined || params.mode === 'form');
  assert.equal(forms.length, 2);
  // 2026-07-28 drops `mode` and `elicitationId`; a missing mode means form.
  assert.ok(forms.some((params) => !('mode' in params)));
  for (const params of forms) assert.deepEqual(unsupported(params.requestedSchema), [], params.message);
});

test('an unsupported schema rejects with a TypeError naming what is unsupported', async () => {
  const handler = elicitationHandler({ serverName: 'Orders' });
  const [legacyEnum, nested] = current.unsupported;
  await rejectsType(handler(legacyEnum), /enumNames/);
  await rejectsType(handler(nested), /address/);
  await rejectsType(handler({ message: 'No schema' }), /schema/);
  // The deprecated titled enum is reported, not guessed at.
  assert.ok(unsupported(legacyEnum.requestedSchema).some((problem) => problem.path === '/properties/plan/enumNames'));
});

test('a malformed request rejects before anything is drawn', async () => {
  const handler = elicitationHandler({ serverName: 'Orders' });
  await rejectsType(handler(null), /object/);
  await rejectsType(handler([]), /object/);
  await rejectsType(handler({ mode: 'sampling', message: 'x' }), /mode/);
  await rejectsType(handler({ mode: null, message: 'x' }), /mode/);
  await rejectsType(handler({ mode: 'url', url: 'https://example.com/' }), /message/);
});

test('URL mode refuses an address that is not a valid https URL', async () => {
  const handler = elicitationHandler({ serverName: 'Billing', open: () => assert.fail('nothing may open') });
  for (const url of [
    undefined, 42, '', 'http://example.com/', 'HTTPS://example.com/', 'https://user:secret@example.com/',
    'javascript:alert(1)', 'https:///path', 'https://exa mple.com/', 'https://example.com/​x',
    'https://example.com\\@evil.com/', `https://example.com/${'a'.repeat(2000)}`, '//example.com/'
  ]) {
    await rejectsType(handler({ mode: 'url', message: 'Sign in', url }), /URL/);
  }
});

test('elicitationUrl() normalises the address the way surface links are', () => {
  assert.deepEqual(elicitationUrl('https://Billing.Example.com/connect?session=7f3a'), {
    href: 'https://billing.example.com/connect?session=7f3a', host: 'billing.example.com', international: false
  });
  assert.equal(elicitationUrl('https://example.com').href, 'https://example.com/');
  assert.equal(elicitationUrl('https://example.com:8443/a').host, 'example.com:8443');
  // A host in another script is shown as the browser reaches it, and flagged.
  const idn = elicitationUrl('https://аpple.com/login');
  assert.equal(idn.host, 'xn--pple-43d.com');
  assert.equal(idn.international, true);
});

test('URL mode asks first: a confirm surface naming the host, emphasised, and the full address', () => {
  const params = legacy.requests[1].params;
  const url = elicitationUrl(params.url);
  const document = urlConsentDocument(params.message, url);
  const { document: valid, errors } = validateDocument(document);
  assert.deepEqual(errors, []);
  assert.equal(valid.intent, 'confirm');
  assert.equal(valid.title, 'Open a page on another site?');
  const byId = Object.fromEntries(valid.nodes.map((node) => [node.id, node]));
  assert.deepEqual(valid.root, ['message', 'host', 'address', 'note']);
  assert.ok(parseInline(byId.host.text).some((segment) => segment.kind === 'strong' && segment.text === 'billing.example.com'));
  const address = parseInline(byId.address.text).map((segment) => segment.text).join('');
  assert.ok(address.endsWith(url.href), address);
  // Nothing in it is a link, so nothing can be followed or fetched before the person agrees.
  assert.ok(valid.nodes.every((node) => node.type !== 'link'));
  assert.deepEqual(valid.actions.map((action) => [action.id, action.kind ?? null]), [['confirm', 'primary'], ['reject', null]]);
});

test('the server’s words cannot imitate the emphasised host', () => {
  const document = urlConsentDocument('Continue on **accounts.example.org** `now` [1] \\', elicitationUrl('https://evil.example.com/'));
  const message = document.nodes.find((node) => node.id === 'message');
  const segments = parseInline(message.text);
  assert.deepEqual(segments, [{ kind: 'text', text: 'Continue on **accounts.example.org** `now` [1] \\' }]);
});

test('an internationalised host is warned about', () => {
  const document = urlConsentDocument('', elicitationUrl('https://xn--pple-43d.com/'));
  const { document: valid, errors } = validateDocument(document);
  assert.deepEqual(errors, []);
  assert.deepEqual(valid.root, ['host', 'address', 'international', 'note']);
  assert.equal(valid.nodes.find((node) => node.id === 'international').tone, 'warning');
});

test('the consent texts are in the catalogue, and the host translator localizes them', () => {
  for (const key of ['mcp.askedBy', 'mcp.decline', 'mcp.urlAddress', 'mcp.urlHost', 'mcp.urlInternational', 'mcp.urlNote', 'mcp.urlOpen', 'mcp.urlTitle']) {
    assert.equal(typeof defaultMessages[key], 'string', key);
  }
  assert.equal(defaultMessages['mcp.askedBy'], 'Asked by %1');
  const url = elicitationUrl('https://example.com/');
  setTranslator((key) => (key === 'mcp.urlTitle' ? 'Seite öffnen?' : null));
  assert.equal(urlConsentDocument('', url).title, 'Seite öffnen?');
});

test('elicit() draws the server’s message as plain text, never as markup', () => {
  const message = `Confirm the **transfer** to \`IBAN\` [1] \\ now. ${'Long enough to stay in the body. '.repeat(8)}`;
  const { document: valid, errors } = validateDocument(elicitDocument({ message, requestedSchema: current.result.inputRequests.delivery.params.requestedSchema }));
  assert.deepEqual(errors, []);
  const node = valid.nodes.find((entry) => entry.id === 'message');
  assert.deepEqual(parseInline(node.text), [{ kind: 'text', text: message }]);
  // A short message is the title, which is drawn as text.
  assert.equal(elicitDocument({ message: 'Pay **now**', requestedSchema: { type: 'object', properties: {} } }).title, 'Pay **now**');
});

test('elicit() labels resolve through msg by language, the host translator, then English', () => {
  const request = { message: '', requestedSchema: { type: 'object', properties: {} } };
  const labels = (options) => {
    const document = elicitDocument(request, options);
    return [document.title, ...document.actions.map((action) => action.label)];
  };
  assert.deepEqual(labels(), ['Information requested', 'Submit', 'Decline']);
  setTranslator((key) => ({ 'surface.submit': 'Senden', 'surface.decline': 'Ablehnen', 'surface.requested': 'Angaben erbeten' })[key] ?? null);
  assert.deepEqual(labels(), ['Angaben erbeten', 'Senden', 'Ablehnen']);
  // The msg option comes before the translator, its language table before its flat entries.
  setLanguage('fr');
  assert.deepEqual(labels({ msg: { 'surface.submit': 'Flat', fr: { 'surface.submit': 'Envoyer', 'surface.decline': 'Refuser' } } }),
    ['Angaben erbeten', 'Envoyer', 'Refuser']);
  assert.deepEqual(labels({ lang: 'de', msg: { 'surface.submit': 'Flat', fr: { 'surface.submit': 'Envoyer' } } }), ['Angaben erbeten', 'Flat', 'Ablehnen']);
});

test('a long message is escaped first and then cut, never inside an escape', () => {
  const schema = { type: 'object', properties: { a: { type: 'string', title: 'A' } } };
  const url = elicitationUrl('https://example.com/');
  for (const message of [`Note: ${'*'.repeat(19990)}`, `${'x'.repeat(19999)}*tail`, '\\'.repeat(20001)]) {
    for (const document of [urlConsentDocument(message, url), elicitDocument({ message, requestedSchema: schema })]) {
      const { document: valid, errors } = validateDocument(document);
      assert.deepEqual(errors, []);
      const text = valid.nodes.find((node) => node.id === 'message').text;
      assert.ok(text.length <= 20000, `${text.length}`);
      const shown = parseInline(text);
      assert.equal(shown.length, 1);
      assert.equal(shown[0].kind, 'text');
      assert.ok(message.startsWith(shown[0].text), 'the cut text is a prefix of the message');
    }
  }
  assert.equal(plainInline('a*b', 2), 'a');
  assert.equal(plainInline('a*b', 3), 'a\\*');
  assert.equal(plainInline('a*b', 4), 'a\\*b');
  assert.equal(plainInline('ab😀', 3), 'ab');
});
