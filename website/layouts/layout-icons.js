/*
 * The icon set the application layouts draw from.
 *
 * Zx bundles a deliberately small inline set; an application that needs more either opts into Font
 * Awesome with `loadFontAwesome()` or registers its own glyphs. The layouts take the second route so
 * the gallery stays offline and network-free. They were written against Font Awesome names, so the
 * glyphs below keep those names (`magnifying-glass`, `pen-to-square`, `star-regular`, …) and draw
 * the closest outline from Lucide 1.53.0 (https://lucide.dev) — the same family, stroke, and
 * 24-unit grid as the bundled set. A `-regular` name and its solid sibling share one outline; a
 * state that wants the solid form fills it with CSS (`fill: currentColor`). Each entry is a
 * `[viewBox, path, 'stroke']` outline glyph, the Lucide icon rewritten as a single path.
 *
 * Lucide — ISC License
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Lucide icons derived from the Feather project (Lucide's LICENSE lists them) are also covered by:
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-present Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { registerIcons } from '../../src/index.js';

/** @type {Record<string, import('../../src/core/icons.js').IconGlyph>} */
const LAYOUT_ICONS = {
  'align-left': ['0 0 24 24', 'M21 5H3M15 12H3M17 19H3', 'stroke'], // text-align-start
  'angle-down': ['0 0 24 24', 'M6 9l6 6 6-6', 'stroke'], // chevron-down
  'angle-left': ['0 0 24 24', 'M15 18l-6-6 6-6', 'stroke'], // chevron-left
  'angle-right': ['0 0 24 24', 'M9 18l6-6-6-6', 'stroke'], // chevron-right
  'angle-up': ['0 0 24 24', 'M18 15l-6-6-6 6', 'stroke'], // chevron-up
  'angles-left': ['0 0 24 24', 'M11 17l-5-5 5-5M18 17l-5-5 5-5', 'stroke'], // chevrons-left
  'angles-right': ['0 0 24 24', 'M6 17l5-5-5-5M13 17l5-5-5-5', 'stroke'], // chevrons-right
  'arrow-down': ['0 0 24 24', 'M12 5v14M19 12l-7 7-7-7', 'stroke'],
  'arrow-down-a-z': ['0 0 24 24', 'M3 16l4 4 4-4M7 20V4M20 8h-5M15 10V6.5a2.5 2.5 0 0 1 5 0V10M15 14h5l-5 6h5', 'stroke'],
  'arrow-left': ['0 0 24 24', 'M12 19l-7-7 7-7M19 12H5', 'stroke'],
  'arrow-right': ['0 0 24 24', 'M5 12h14M12 5l7 7-7 7', 'stroke'],
  'arrow-right-arrow-left': ['0 0 24 24', 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16', 'stroke'], // arrow-right-left
  'arrow-trend-down': ['0 0 24 24', 'M16 17h6v-6M22 17l-8.5-8.5-5 5L2 7', 'stroke'], // trending-down
  'arrow-trend-up': ['0 0 24 24', 'M16 7h6v6M22 7l-8.5 8.5-5-5L2 17', 'stroke'], // trending-up
  'arrow-up': ['0 0 24 24', 'M5 12l7-7 7 7M12 19V5', 'stroke'],
  'arrow-up-right-from-square': ['0 0 24 24', 'M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'stroke'], // external-link
  'arrows-rotate': ['0 0 24 24', 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5', 'stroke'], // refresh-cw
  'at': ['0 0 24 24', 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0zM16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8', 'stroke'], // at-sign
  'barcode': ['0 0 24 24', 'M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14', 'stroke'],
  'bars': ['0 0 24 24', 'M4 5h16M4 12h16M4 19h16', 'stroke'], // menu
  'bars-progress': ['0 0 24 24', 'M3 3v16a2 2 0 0 0 2 2h16M7 11h8M7 16h3M7 6h12', 'stroke'], // chart-bar-decreasing
  'bell': ['0 0 24 24', 'M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326', 'stroke'],
  'bell-regular': ['0 0 24 24', 'M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326', 'stroke'], // bell
  'bold': ['0 0 24 24', 'M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8', 'stroke'],
  'bolt': ['0 0 24 24', 'M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z', 'stroke'], // zap
  'book-open': ['0 0 24 24', 'M12 5v16M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z', 'stroke'],
  'bookmark': ['0 0 24 24', 'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z', 'stroke'],
  'bookmark-regular': ['0 0 24 24', 'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z', 'stroke'], // bookmark
  'box': ['0 0 24 24', 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73zM12 22V12M3.29 7 12 12 20.71 7M7.5 4.27l9 5.15', 'stroke'], // package
  'box-archive': ['0 0 24 24', 'M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-18a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1zM4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4', 'stroke'], // archive
  'box-open': ['0 0 24 24', 'M12 22v-9M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36zM20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13M21 12.43a1.93 1.93 0 0 0 0-3.36L8.83 2.2a1.64 1.64 0 0 0-1.63 0L3 4.57a1.93 1.93 0 0 0 0 3.36l12.18 6.86a1.636 1.636 0 0 0 1.63 0z', 'stroke'], // package-open
  'boxes-stacked': ['0 0 24 24', 'M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42ZM7 16.5l-4.74-2.85M7 16.5l5-3M7 16.5v5.17M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3ZM17 16.5l-5-3M17 16.5l4.74-2.85M17 16.5v5.17M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8ZM12 8 7.26 5.15M12 8l4.74-2.85M12 13.5V8', 'stroke'], // boxes
  'brain': ['0 0 24 24', 'M12 18V5M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5M17.997 5.125a4 4 0 0 1 2.526 5.77M18 18a4 4 0 0 0 2-7.464M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517M6 18a4 4 0 0 1-2-7.464M6.003 5.125a4 4 0 0 0-2.526 5.77', 'stroke'],
  'briefcase': ['0 0 24 24', 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2z', 'stroke'],
  'bug': ['0 0 24 24', 'M12 20v-9M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4zM14.12 3.88 16 2M21 21a4 4 0 0 0-3.81-4M21 5a4 4 0 0 1-3.55 3.97M22 13h-4M3 21a4 4 0 0 1 3.81-4M3 5a4 4 0 0 0 3.55 3.97M6 13H2M8 2l1.88 1.88M9 7.13V6a3 3 0 1 1 6 0v1.13', 'stroke'],
  'building': ['0 0 24 24', 'M12 10h.01M12 14h.01M12 6h.01M16 10h.01M16 14h.01M16 6h.01M8 10h.01M8 14h.01M8 6h.01M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-16a2 2 0 0 1 2-2z', 'stroke'],
  'bullseye': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM6 12a6 6 0 1 0 12 0a6 6 0 1 0-12 0zM10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', 'stroke'], // target
  'calculator': ['0 0 24 24', 'M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-16a2 2 0 0 1 2-2zM8 6H16M16 14V18M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01', 'stroke'],
  'calendar-check': ['0 0 24 24', 'M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM3 9h18M9 15l2 2 4-4', 'stroke'],
  'calendar-days': ['0 0 24 24', 'M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01', 'stroke'],
  'calendar-regular': ['0 0 24 24', 'M8 2v3M16 2v3M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM3 9h18', 'stroke'], // calendar
  'caret-down': ['0 0 24 24', 'M6 9l6 6 6-6', 'stroke'], // chevron-down
  'caret-right': ['0 0 24 24', 'M9 18l6-6-6-6', 'stroke'], // chevron-right
  'cart-flatbed': ['0 0 24 24', 'M12 12H5a2 2 0 0 0-2 2v5M15 19h7M16 19V2M6 12V7a2 2 0 0 1 2-2h2.172a2 2 0 0 1 1.414.586l3.828 3.828A2 2 0 0 1 16 10.828M7 19h4M11 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM3 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', 'stroke'], // forklift
  'cart-shopping': ['0 0 24 24', 'M2.05 2.05l1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25M16 20a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM6 20a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', 'stroke'], // shopping-cart
  'chart-column': ['0 0 24 24', 'M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3', 'stroke'],
  'chart-line': ['0 0 24 24', 'M3 3v16a2 2 0 0 0 2 2h16M19 9l-5 5-4-4-3 3', 'stroke'],
  'chart-pie': ['0 0 24 24', 'M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1zM21.21 15.89A10 10 0 1 1 8 2.83', 'stroke'],
  'chart-simple': ['0 0 24 24', 'M5 21v-6M12 21V3M19 21V9', 'stroke'], // chart-no-axes-column
  'circle': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z', 'stroke'],
  'circle-check': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM16 9l-5.5 5.5L8 12', 'stroke'],
  'circle-check-regular': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM16 9l-5.5 5.5L8 12', 'stroke'], // circle-check
  'circle-dot': ['0 0 24 24', 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z', 'stroke'],
  'circle-exclamation': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM12 8V12M12 16H12.01', 'stroke'], // circle-alert
  'circle-half-stroke': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM12 18a6 6 0 0 0 0-12v12z', 'stroke'], // contrast
  'circle-info': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM12 16v-4M12 8h.01', 'stroke'], // info
  'circle-pause': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM10 15V9M14 15V9', 'stroke'],
  'circle-play': ['0 0 24 24', 'M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996zM2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z', 'stroke'],
  'circle-regular': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z', 'stroke'], // circle
  'circle-stop': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM10 9h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z', 'stroke'],
  'circle-user': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM9 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662', 'stroke'],
  'circle-xmark': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM15 9l-6 6M9 9l6 6', 'stroke'], // circle-x
  'city': ['0 0 24 24', 'M10 12h4M10 8h4M14 21v-3a2 2 0 0 0-4 0v3M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'stroke'], // building-complex
  'clipboard': ['0 0 24 24', 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'stroke'],
  'clipboard-check': ['0 0 24 24', 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 14l2 2 4-4', 'stroke'],
  'clipboard-list': ['0 0 24 24', 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01', 'stroke'],
  'clock-regular': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM12 6v6l4 2', 'stroke'], // clock
  'cloud': ['0 0 24 24', 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z', 'stroke'],
  'cloud-arrow-up': ['0 0 24 24', 'M12 13v8M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242M8 17l4-4 4 4', 'stroke'], // cloud-upload
  'code-branch': ['0 0 24 24', 'M15 6a9 9 0 0 0-9 9V3M15 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0z', 'stroke'], // git-branch
  'code-compare': ['0 0 24 24', 'M15 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM3 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM13 6h3a2 2 0 0 1 2 2v7M11 18H8a2 2 0 0 1-2-2V9', 'stroke'], // git-compare
  'code-merge': ['0 0 24 24', 'M15 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM3 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM6 21V9a9 9 0 0 0 9 9', 'stroke'], // git-merge
  'coins': ['0 0 24 24', 'M13.744 17.736a6 6 0 1 1-7.48-7.48M15 6h1v4M6.134 14.768l.866-.5 2 3.464M10 8a6 6 0 1 0 12 0a6 6 0 1 0-12 0z', 'stroke'],
  'comment': ['0 0 24 24', 'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719', 'stroke'], // message-circle
  'comment-regular': ['0 0 24 24', 'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719', 'stroke'], // message-circle
  'comments': ['0 0 24 24', 'M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2zM20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1', 'stroke'], // messages-square
  'compress': ['0 0 24 24', 'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3', 'stroke'], // minimize
  'copy-regular': ['0 0 24 24', 'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2zM4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2', 'stroke'], // copy
  'credit-card': ['0 0 24 24', 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2zM2 10H22M6 14h2', 'stroke'],
  'cube': ['0 0 24 24', 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7l8.7 5 8.7-5M12 22V12', 'stroke'], // box
  'cubes': ['0 0 24 24', 'M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42ZM7 16.5l-4.74-2.85M7 16.5l5-3M7 16.5v5.17M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3ZM17 16.5l-5-3M17 16.5l4.74-2.85M17 16.5v5.17M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8ZM12 8 7.26 5.15M12 8l4.74-2.85M12 13.5V8', 'stroke'], // boxes
  'database': ['0 0 24 24', 'M3 5a9 3 0 1 0 18 0a9 3 0 1 0-18 0zM3 5V19A9 3 0 0 0 21 19V5M3 12A9 3 0 0 0 21 12', 'stroke'],
  'desktop': ['0 0 24 24', 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2zM8 21H16M12 17V21', 'stroke'], // monitor
  'diagram-project': ['0 0 24 24', 'M5 3h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM7 11v4a2 2 0 0 0 2 2h4M15 13h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z', 'stroke'], // workflow
  'dolly': ['0 0 24 24', 'M12 12H5a2 2 0 0 0-2 2v5M15 19h7M16 19V2M6 12V7a2 2 0 0 1 2-2h2.172a2 2 0 0 1 1.414.586l3.828 3.828A2 2 0 0 1 16 10.828M7 19h4M11 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM3 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', 'stroke'], // forklift
  'download': ['0 0 24 24', 'M12 15V3M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5', 'stroke'],
  'ellipsis': ['0 0 24 24', 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM18 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0z', 'stroke'],
  'ellipsis-vertical': ['0 0 24 24', 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM11 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM11 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0z', 'stroke'],
  'envelope': ['0 0 24 24', 'M22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2z', 'stroke'], // mail
  'envelope-open': ['0 0 24 24', 'M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6ZM22 10l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10', 'stroke'], // mail-open
  'envelope-regular': ['0 0 24 24', 'M22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2z', 'stroke'], // mail
  'eraser': ['0 0 24 24', 'M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21M5.082 11.09l8.828 8.828', 'stroke'],
  'ethernet': ['0 0 24 24', 'M10 8v1M14 8v1M18 8v1M19 17a2 2 0 00-1.765 1.059l-.47.882A2 2 0 0115 20H9a2 2 0 01-1.765-1.059l-.47-.882A2 2 0 005 17H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v9a2 2 0 01-2 2zM6 8v1', 'stroke'], // ethernet-port
  'euro-sign': ['0 0 24 24', 'M4 10h12M4 14h9M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2', 'stroke'], // euro
  'expand': ['0 0 24 24', 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3', 'stroke'], // maximize
  'eye-regular': ['0 0 24 24', 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0z', 'stroke'], // eye
  'eye-slash': ['0 0 24 24', 'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49M14.084 14.158a3 3 0 0 1-4.242-4.242M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143M2 2l20 20', 'stroke'], // eye-off
  'face-smile': ['0 0 24 24', 'M15 10V9M16.472 15a6 6 0 01-8.943 0M9 10V9M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z', 'stroke'], // face-slightly-smiling
  'face-smile-regular': ['0 0 24 24', 'M15 10V9M16.472 15a6 6 0 01-8.943 0M9 10V9M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z', 'stroke'], // face-slightly-smiling
  'file-export': ['0 0 24 24', 'M4.226 20.925A2 2 0 0 0 6 22h12a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v3.127M14 2v5a1 1 0 0 0 1 1h5M5 11l-3 3M5 17l-3-3h10', 'stroke'], // file-output
  'file-invoice': ['0 0 24 24', 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5M8 13h2M14 13h2M8 17h2M14 17h2', 'stroke'], // file-spreadsheet
  'file-lines': ['0 0 24 24', 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5M10 9H8M16 13H8M16 17H8', 'stroke'], // file-text
  'file-pdf': ['0 0 24 24', 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5M11 18h2M12 12v6M9 13v-.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.5', 'stroke'], // file-type
  'file-question': ['0 0 24 24', 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM12 17h.01M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3', 'stroke'],
  'file-regular': ['0 0 24 24', 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5', 'stroke'], // file
  'filter-circle-xmark': ['0 0 24 24', 'M12.531 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14v6a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341l.427-.473M16.5 3.5l5 5M21.5 3.5l-5 5', 'stroke'], // funnel-x
  'fire': ['0 0 24 24', 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4', 'stroke'], // flame
  'flag': ['0 0 24 24', 'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528', 'stroke'],
  'flag-checkered': ['0 0 24 24', 'M12 13V2l8 4-8 4M20.561 10.222a9 9 0 1 1-12.55-5.29M8.002 9.997a5 5 0 1 0 8.9 2.02', 'stroke'], // goal
  'flag-regular': ['0 0 24 24', 'M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528', 'stroke'], // flag
  'folder-plus': ['0 0 24 24', 'M12 10v6M9 13h6M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z', 'stroke'],
  'folder-regular': ['0 0 24 24', 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z', 'stroke'], // folder
  'font': ['0 0 24 24', 'M12 4v16M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2M9 20h6', 'stroke'], // type
  'forward': ['0 0 24 24', 'M12 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 12 18zM2 6a2 2 0 0 1 3.414-1.414l6 6a2 2 0 0 1 0 2.828l-6 6A2 2 0 0 1 2 18z', 'stroke'], // fast-forward
  'gauge': ['0 0 24 24', 'M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0', 'stroke'],
  'gauge-high': ['0 0 24 24', 'M12 14l4-4M3.34 19a10 10 0 1 1 17.32 0', 'stroke'], // gauge
  'globe': ['0 0 24 24', 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0zM12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20', 'stroke'],
  'grip': ['0 0 24 24', 'M11 9a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM18 9a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM4 9a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM11 15a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM18 15a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM4 15a1 1 0 1 0 2 0a1 1 0 1 0-2 0z', 'stroke'], // grip-horizontal
  'grip-vertical': ['0 0 24 24', 'M8 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM8 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM8 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM14 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM14 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM14 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0z', 'stroke'],
  'handshake': ['0 0 24 24', 'M11 17l2 2a1 1 0 1 0 3-3M14 14l2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4M21 3l1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8', 'stroke'],
  'hard-drive': ['0 0 24 24', 'M10 16h.01M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM21.946 12.013H2.054M6 16h.01', 'stroke'],
  'hashtag': ['0 0 24 24', 'M4 9H20M4 15H20M10 3L8 21M16 3L14 21', 'stroke'], // hash
  'heading': ['0 0 24 24', 'M6 12h12M6 20V4M18 20V4', 'stroke'],
  'heart-pulse': ['0 0 24 24', 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27', 'stroke'],
  'heart-regular': ['0 0 24 24', 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5', 'stroke'], // heart
  'highlighter': ['0 0 24 24', 'M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4', 'stroke'],
  'hourglass-half': ['0 0 24 24', 'M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2', 'stroke'], // hourglass
  'house': ['0 0 24 24', 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'stroke'],
  'image': ['0 0 24 24', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM7 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21', 'stroke'],
  'inbox': ['0 0 24 24', 'M22 12 16 12 14 15 10 15 8 12 2 12M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z', 'stroke'],
  'industry': ['0 0 24 24', 'M12 16h.01M16 16h.01M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2zM8 16h.01', 'stroke'], // factory
  'italic': ['0 0 24 24', 'M19 4H10M14 20H5M15 4L9 20', 'stroke'],
  'key': ['0 0 24 24', 'M2 21l9.6-9.6M7.5 15.5l2.3 2.3a1 1 0 0 1 0 1.4l-2.1 2.1a1 1 0 0 1-1.4 0L4 19M10 7.5a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0-11 0z', 'stroke'],
  'keyboard': ['0 0 24 24', 'M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2z', 'stroke'],
  'laptop': ['0 0 24 24', 'M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2zM20.054 15.987H3.946', 'stroke'],
  'layer-group': ['0 0 24 24', 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83zM2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17', 'stroke'], // layers
  'lightbulb': ['0 0 24 24', 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4', 'stroke'],
  'lightbulb-regular': ['0 0 24 24', 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4', 'stroke'], // lightbulb
  'link': ['0 0 24 24', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71', 'stroke'],
  'list-check': ['0 0 24 24', 'M13 5h8M13 12h8M13 19h8M3 17l2 2 4-4M3 7l2 2 4-4', 'stroke'], // list-checks
  'list-ol': ['0 0 24 24', 'M11 5h10M11 12h10M11 19h10M4 4h1v5M4 9h2M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02', 'stroke'], // list-ordered
  'list-ul': ['0 0 24 24', 'M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13', 'stroke'], // list
  'location-dot': ['0 0 24 24', 'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0M9 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0z', 'stroke'], // map-pin
  'magnifying-glass': ['0 0 24 24', 'M21 21l-4.34-4.34M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0z', 'stroke'], // search
  'maximize': ['0 0 24 24', 'M15 15l6 6M15 9l6-6M21 16v5h-5M21 8V3h-5M3 16v5h5M3 21l6-6M3 8V3h5M9 9 3 3', 'stroke'], // expand
  'memory': ['0 0 24 24', 'M12 12v-2M12 18v-2M16 12v-2M16 18v-2M2 11h1.5M20 18v-2M20.5 11H22M4 18v-2M8 12v-2M8 18v-2M4 6h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'stroke'], // memory-stick
  'message': ['0 0 24 24', 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z', 'stroke'], // message-square
  'microchip': ['0 0 24 24', 'M12 20v2M12 2v2M17 20v2M17 2v2M2 12h2M2 17h2M2 7h2M20 12h2M20 17h2M20 7h2M7 20v2M7 2v2M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2zM9 8h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z', 'stroke'], // cpu
  'microphone': ['0 0 24 24', 'M12 19v3M19 10v2a7 7 0 0 1-14 0v-2M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3z', 'stroke'], // mic
  'minimize': ['0 0 24 24', 'M15 15l6 6m-6-6v4.8m0-4.8h4.8M9 19.8V15m0 0H4.2M9 15l-6 6M15 4.2V9m0 0h4.8M15 9l6-6M9 4.2V9m0 0H4.2M9 9 3 3', 'stroke'], // shrink
  'mobile-screen': ['0 0 24 24', 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-16a2 2 0 0 1 2-2zM12 18h.01', 'stroke'], // smartphone
  'money-bill': ['0 0 24 24', 'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM6 12h.01M18 12h.01', 'stroke'], // banknote
  'moon': ['0 0 24 24', 'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401', 'stroke'],
  'network-wired': ['0 0 24 24', 'M17 16h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM3 16h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM10 2h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8', 'stroke'], // network
  'pallet': ['0 0 24 24', 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73zM12 22V12M3.29 7 12 12 20.71 7M7.5 4.27l9 5.15', 'stroke'], // package
  'panel-bottom': ['0 0 24 24', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM3 15h18', 'stroke'],
  'panel-right': ['0 0 24 24', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM15 3v18', 'stroke'],
  'paper-plane': ['0 0 24 24', 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11zM21.854 2.147l-10.94 10.939', 'stroke'], // send
  'paper-plane-regular': ['0 0 24 24', 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11zM21.854 2.147l-10.94 10.939', 'stroke'], // send
  'paperclip': ['0 0 24 24', 'M16 6l-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551', 'stroke'],
  'pause': ['0 0 24 24', 'M15 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1zM6 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z', 'stroke'],
  'pen': ['0 0 24 24', 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z', 'stroke'],
  'pen-to-square': ['0 0 24 24', 'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z', 'stroke'], // square-pen
  'percent': ['0 0 24 24', 'M19 5L5 19M4 6.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0zM15 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0z', 'stroke'],
  'phone': ['0 0 24 24', 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384', 'stroke'],
  'play': ['0 0 24 24', 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z', 'stroke'],
  'plug': ['0 0 24 24', 'M12 22v-5M15 8V2M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1zM9 8V2', 'stroke'],
  'power-off': ['0 0 24 24', 'M12 2v10M18.4 6.6a9 9 0 1 1-12.77.04', 'stroke'], // power
  'print': ['0 0 24 24', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6M7 14h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z', 'stroke'], // printer
  'quote-left': ['0 0 24 24', 'M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2zM5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z', 'stroke'], // quote
  'quote-right': ['0 0 24 24', 'M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2zM5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z', 'stroke'], // quote
  'receipt': ['0 0 24 24', 'M13 16H8M14 8H8M16 12H8M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z', 'stroke'], // receipt-text
  'repeat': ['0 0 24 24', 'M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3', 'stroke'],
  'reply': ['0 0 24 24', 'M20 18v-2a4 4 0 0 0-4-4H4M9 17l-5-5 5-5', 'stroke'],
  'reply-all': ['0 0 24 24', 'M12 17l-5-5 5-5M22 18v-2a4 4 0 0 0-4-4H7M7 17l-5-5 5-5', 'stroke'],
  'robot': ['0 0 24 24', 'M12 8V4H8M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM2 14h2M20 14h2M15 13v2M9 13v2', 'stroke'], // bot
  'rocket': ['0 0 24 24', 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05', 'stroke'],
  'rotate-left': ['0 0 24 24', 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5', 'stroke'], // rotate-ccw
  'rotate-right': ['0 0 24 24', 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5', 'stroke'], // rotate-cw
  'route': ['0 0 24 24', 'M3 19a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15M15 5a3 3 0 1 0 6 0a3 3 0 1 0-6 0z', 'stroke'],
  'rss': ['0 0 24 24', 'M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M4 19a1 1 0 1 0 2 0a1 1 0 1 0-2 0z', 'stroke'],
  'satellite-dish': ['0 0 24 24', 'M18 12a6 6 0 00-6-6M2.824 10.459a8 8 0 0010.717 10.717c.558-.276.623-1.012.183-1.452l-9.448-9.448c-.44-.44-1.176-.375-1.452.183M22 12A10 10 0 0012 2M9 15l4-4', 'stroke'],
  'scale-balanced': ['0 0 24 24', 'M12 3v18M19 8l3 8a5 5 0 0 1-6 0zV7M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1M5 8l3 8a5 5 0 0 1-6 0zV7M7 21h10', 'stroke'], // scale
  'screwdriver-wrench': ['0 0 24 24', 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z', 'stroke'], // wrench
  'server': ['0 0 24 24', 'M4 2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM6 6H6.01M6 18H6.01', 'stroke'],
  'share': ['0 0 24 24', 'M15 17l5-5-5-5M4 18v-2a4 4 0 0 1 4-4h12', 'stroke'], // forward
  'share-nodes': ['0 0 24 24', 'M15 5a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM3 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM15 19a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM8.59 13.51L15.42 17.49M15.41 6.51L8.59 10.49', 'stroke'], // share-2
  'shield-halved': ['0 0 24 24', 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zM12 22V2', 'stroke'], // shield-half
  'shuffle': ['0 0 24 24', 'M18 14l4 4-4 4M18 2l4 4-4 4M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22M2 6h1.972a4 4 0 0 1 3.6 2.2M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45', 'stroke'],
  'signal': ['0 0 24 24', 'M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16', 'stroke'],
  'sitemap': ['0 0 24 24', 'M17 16h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM3 16h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM10 2h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zM5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8', 'stroke'], // network
  'sliders': ['0 0 24 24', 'M10 5H3M12 19H3M14 3v4M16 17v4M21 12h-9M21 19h-5M21 5h-7M8 10v4M8 12H3', 'stroke'], // sliders-horizontal
  'sort': ['0 0 24 24', 'M7 15l5 5 5-5M7 9l5-5 5 5', 'stroke'], // chevrons-up-down
  'spinner': ['0 0 24 24', 'M12 2v4M16.2 7.8l2.9-2.9M18 12h4M16.2 16.2l2.9 2.9M12 18v4M4.9 19.1l2.9-2.9M2 12h4M4.9 4.9l2.9 2.9', 'stroke'], // loader
  'square-check': ['0 0 24 24', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM16 9l-5.5 5.5L8 12', 'stroke'],
  'square-check-regular': ['0 0 24 24', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM16 9l-5.5 5.5L8 12', 'stroke'], // square-check
  'square-regular': ['0 0 24 24', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2z', 'stroke'], // square
  'star-regular': ['0 0 24 24', 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z', 'stroke'], // star
  'stop': ['0 0 24 24', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2z', 'stroke'], // square
  'stopwatch': ['0 0 24 24', 'M10 2H14M12 14L15 11M4 14a8 8 0 1 0 16 0a8 8 0 1 0-16 0z', 'stroke'], // timer
  'strikethrough': ['0 0 24 24', 'M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12H20', 'stroke'],
  'subscript': ['0 0 24 24', 'M4 5l8 8M12 5l-8 8M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.11 2.11 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07', 'stroke'],
  'sun': ['0 0 24 24', 'M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41', 'stroke'],
  'superscript': ['0 0 24 24', 'M4 19l8-8M12 19l-8-8M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7.002c0-.472-.17-.93-.484-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.899 1.06', 'stroke'],
  'table': ['0 0 24 24', 'M12 3v18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM3 9h18M3 15h18', 'stroke'],
  'table-cells': ['0 0 24 24', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM3 9h18M3 15h18M9 3v18M15 3v18', 'stroke'], // grid-3x3
  'table-columns': ['0 0 24 24', 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM9 3v18M15 3v18', 'stroke'], // columns-3
  'table-list': ['0 0 24 24', 'M15 3v18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-14a2 2 0 0 1 2-2zM21 9H3M21 15H3', 'stroke'], // table-properties
  'tags': ['0 0 24 24', 'M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1zM2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193M10 6.5a.5 .5 0 1 0 1 0a.5 .5 0 1 0-1 0z', 'stroke'],
  'temperature-half': ['0 0 24 24', 'M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z', 'stroke'], // thermometer
  'terminal': ['0 0 24 24', 'M12 19h8M4 17l6-6-6-6', 'stroke'],
  'text-height': ['0 0 24 24', 'M15 16l2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16M15.697 14h5.606M2 16l4.039-9.69a.5.5 0 0 1 .923 0L11 16M3.304 13h6.392', 'stroke'], // a-large-small
  'thumbs-down': ['0 0 24 24', 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88ZM17 14V2', 'stroke'],
  'thumbs-down-regular': ['0 0 24 24', 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88ZM17 14V2', 'stroke'], // thumbs-down
  'thumbs-up': ['0 0 24 24', 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88ZM7 10v12', 'stroke'],
  'thumbs-up-regular': ['0 0 24 24', 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88ZM7 10v12', 'stroke'], // thumbs-up
  'thumbtack': ['0 0 24 24', 'M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z', 'stroke'], // pin
  'timeline': ['0 0 24 24', 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM3 12H9M15 12H21', 'stroke'], // git-commit-horizontal
  'toolbox': ['0 0 24 24', 'M16 12v4M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M17 6a2 2 0 011.414.586l3 3A2 2 0 0122 11v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 01.586-1.414l3-3A2 2 0 017 6zM2 14h20M8 12v4', 'stroke'],
  'tower-broadcast': ['0 0 24 24', 'M4.9 16.1C1 12.2 1 5.8 4.9 1.9M7.8 4.7a6.14 6.14 0 0 0-.8 7.5M10 9a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM16.2 4.8c2 2 2.26 5.11.8 7.47M19.1 1.9a9.96 9.96 0 0 1 0 14.1M9.5 18h5M8 22l4-11 4 11', 'stroke'], // radio-tower
  'trash-can': ['0 0 24 24', 'M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'stroke'], // trash
  'triangle-exclamation': ['0 0 24 24', 'M21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01', 'stroke'], // triangle-alert
  'truck': ['0 0 24 24', 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14M15 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM5 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', 'stroke'],
  'underline': ['0 0 24 24', 'M6 4v6a6 6 0 0 0 12 0V4M4 20H20', 'stroke'],
  'user': ['0 0 24 24', 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0z', 'stroke'],
  'user-check': ['0 0 24 24', 'M16 11l2 2 4-4M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0z', 'stroke'],
  'user-clock': ['0 0 24 24', 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0z', 'stroke'], // user
  'user-group': ['0 0 24 24', 'M17 21v-1a2 2 0 00-2-2H9a2 2 0 00-2 2v1M19 10h1a2 2 0 012 2v1M5 10H4a2 2 0 00-2 2v1M9 11a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM16 4a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM4 4a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', 'stroke'],
  'user-plus': ['0 0 24 24', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0zM19 8V14M22 11H16', 'stroke'],
  'user-regular': ['0 0 24 24', 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0z', 'stroke'], // user
  'users': ['0 0 24 24', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0z', 'stroke'],
  'video': ['0 0 24 24', 'M16 13l5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z', 'stroke'],
  'wand-magic-sparkles': ['0 0 24 24', 'M21.64 3.64l-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72M14 7l3 3M5 6v4M19 14v4M10 2v2M7 8H3M21 16h-4M11 3H9', 'stroke'], // wand-sparkles
  'warehouse': ['0 0 24 24', 'M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8zM6 13h12M6 17h12', 'stroke'],
  'wifi': ['0 0 24 24', 'M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0M8.5 16.429a5 5 0 0 1 7 0', 'stroke'],
  'wifi-off': ['0 0 24 24', 'M12 20h.01M8.5 16.429a5 5 0 0 1 7 0M5 12.859a10 10 0 0 1 5.17-2.69M19 12.859a10 10 0 0 0-2.007-1.523M2 8.82a15 15 0 0 1 4.177-2.643M22 8.82a15 15 0 0 0-11.288-3.764M2 2l20 20', 'stroke'],
  'window-maximize': ['0 0 24 24', 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-16a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2zM10 4v4M2 8h20M6 4v4', 'stroke'], // app-window
  'wrench': ['0 0 24 24', 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z', 'stroke'],
  'xmark': ['0 0 24 24', 'M18 6 6 18M6 6l12 12', 'stroke'] // x
};

registerIcons(LAYOUT_ICONS);

export { LAYOUT_ICONS };
