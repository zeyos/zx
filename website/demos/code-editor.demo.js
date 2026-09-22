import { CodeEditor, h } from '../../src/index.js';

export default {
  title: 'Code editor',
  group: 'Forms',
  blurb: 'A dependency-free, text-safe source editor with native undo, IME behavior, indentation '
    + 'and line/column feedback.',

  examples: [{
    title: 'Structured text',
    blurb: 'Tab inserts two spaces and Shift+Tab outdents the current line or selected lines. '
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
  }]
};
