# WP-30 — Dependency-free code editor

## Problem

ZeyOS uses editable structured text for Markdown, JSON, SQL, templates and developer resources.
Using a plain field everywhere loses Tab indentation and position feedback, while importing a full
editor would add a large security and maintenance surface to both Zx and ZeyOS.

## Contract

- `CodeEditor` is a text-safe native-textarea component with browser undo and IME behavior.
- Tab inserts indentation; Shift+Tab outdents the current line or every selected line.
- Language is presentation metadata only. The component does not execute or parse source.
- The editor exposes value, language, focus, read-only and disabled methods and emits `input` and
  committed `change` events.
- A `code` Field adapter lets Zx forms use the same component.
- The component has no runtime dependency and does not use an HTML sink.

Rich HTML authoring is deliberately outside this work package. That surface needs a separate
sanitization and iframe policy rather than being treated as source editing.
