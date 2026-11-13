import { CodeEditor, h } from '../../src/index.js';

export default {
  title: 'Code editor',
  group: 'Forms',
  blurb: 'A dependency-free, text-safe source editor with native undo, IME behavior, indentation '
    + 'and line/column feedback.',

  examples: [{
    title: 'Structured text',
    blurb: 'Tab inserts two spaces and Shift+Tab outdents the current line or selected lines. '
      + 'Escape then Tab leaves the editor, so the indentation key is never a keyboard trap. '
      + 'indent: \'\' switches the capture off, and Tab then moves focus as in any other field. '
      + 'Language is metadata only: Zx never executes or injects the source.',
    layout: 'stack',
    width: '680px',
    render: ({ cleanup, log }) => {
      const editor = new CodeEditor(null, {
        label: 'JSON settings',
        language: 'json',
        indent: '  ',
        rows: 10,
        value: '{\n  "theme": "auto",\n  "navigation": "left"\n}',
        onchange: ({ detail }) => log(`committed ${detail.value.length} characters`)
      });
      cleanup(() => editor.destroy());
      return [editor.toElement(), h('div', { class: 'demo-row' },
        h('button', { type: 'button', onclick: () => editor.setLanguage('sql').focus() }, 'SQL'),
        h('button', { type: 'button', onclick: () => editor.setReadOnly(true) }, 'Read only'),
        h('button', { type: 'button', onclick: () => editor.setReadOnly(false).focus() }, 'Edit'))];
    }
  }, {
    title: 'Validation message',
    blurb: 'setHighlight(message) puts a standalone editor in its error state the way a Field '
      + 'reports one: the frame takes the danger colour, the textarea is marked aria-invalid and '
      + 'described by the message, and invalid fires. clearHighlight() takes it away; a second '
      + 'argument of \'warning\' or \'success\' shows a status instead. Inside a Field of type '
      + '\'code\', set the Field\'s message — the editor follows it.',
    layout: 'stack',
    width: '680px',
    render: ({ cleanup, log }) => {
      const editor = new CodeEditor(null, {
        label: 'Webhook payload',
        language: 'json',
        indent: '  ',
        rows: 6,
        value: '{\n  "event": "invoice.paid",\n  "retries": 3,\n}',
        oninvalid: ({ detail }) => log(`invalid: ${detail.message}`)
      });
      const validate = () => {
        try {
          JSON.parse(editor.getValue());
          editor.setHighlight('Valid JSON.', 'success');
        } catch {
          editor.setHighlight('Not valid JSON.');
        }
      };
      editor.on('input', validate);
      validate();
      cleanup(() => editor.destroy());
      return [editor.toElement(), h('div', { class: 'demo-row' },
        h('button', { type: 'button', onclick: validate }, 'Validate'),
        h('button', { type: 'button', onclick: () => editor.clearHighlight() }, 'clearHighlight()'))];
    }
  }]
};
