# PromptStarters — starting points for an empty conversation

Starting points for an empty conversation.

Full reference: https://zx.zeyos.com/docs/llms.md · Live demo: https://zx.zeyos.com/docs.html#components/prompt-starters · All components: https://zx.zeyos.com/docs/components/index.md

A labelled group of buttons, each with a title and, muted beneath it, its description or else its
text. PromptStarters only reports the pick and never sends anything: the application decides
whether a starter fills the composer or sends at once.

- **Constructor** — `new PromptStarters(null, options)` creates its own root; `new
  PromptStarters(element, options)` takes over an element and restores it on `destroy()`.
- **Options** — `items: [{id, title, text, description?, icon?}]`, `label` (the group's accessible
  name, English `Suggestions`), `columns: 'auto'|1|2`, `headingLevel: null`, `msg`. An item without
  `id`, `title` or `text` is left out, as is a repeated id; other fields on an item are handed back
  in `pick`. `text` keeps its spaces and line breaks, so a prompt can end where the person goes on
  writing.
- **Columns** — `'auto'` is two columns and one in a container narrower than 32rem, read through a
  container query, so it behaves the same in a split pane, a dialog or a phone. The root fills the
  width it is given.
- **Heading** — `headingLevel: null` keeps `label` for assistive technology only. A level draws it
  above the starters as a heading of that level, which then names the group.
- **Methods** — `setItems(items)` (the focus on a starter stays on the starter with the same id;
  emits nothing), `destroy()`.
- **Events** — `pick {item}`, with a copy of the starter as given.
- **Keyboard** — each starter is a button in the Tab order, pressed with Enter or Space. There are
  no custom keys.
- **Accessibility** — the root is `role="group"`. Each button is named by its title and described
  by the line beneath it. The line is clamped to two lines on screen; its whole text stays the
  description. Without items the group is hidden.

```js
const starters = new PromptStarters(null, {
  items: [
    { id: 'reply', title: 'Draft a reply', text: 'Draft a short, friendly reply to this customer:\n\n' },
    { id: 'review', title: 'Prepare the review', text: 'Summarise this week’s escalations.', icon: 'list' }
  ],
  onpick: ({ detail }) => composer.setValue(detail.item.text).focus()
});
```
