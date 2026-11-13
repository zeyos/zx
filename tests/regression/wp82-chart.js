import assert from 'node:assert/strict';

/** A colour string every CSS Color 3 parser reads. */
const LEGACY = /^(?:#[\da-f]{6}|rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0?\.\d+)\))$/;

/**
 * Installs the helpers every case uses: a recording adapter, a sized container, and a wait that
 * lets the ResizeObserver and the MutationObserver deliver.
 */
const prepare = (page) => page.evaluate(() => {
  window.frames2 = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
  });
  window.calls = [];
  window.recorder = () => ({
    create(canvas, spec) {
      window.calls.push({
        at: 'create', connected: canvas.isConnected, width: canvas.clientWidth, height: canvas.clientHeight,
        color: spec.options.color, borderColor: spec.options.borderColor, theme: spec.theme
      });
      return {
        instance: { id: window.calls.length },
        update(next) { window.calls.push({ at: 'update', color: next.options.color, borderColor: next.options.borderColor, theme: next.theme }); },
        resize() { window.calls.push({ at: 'resize' }); },
        destroy() { window.calls.push({ at: 'destroy' }); }
      };
    }
  });
  window.box = (width = 600, height = 300) => {
    const box = document.createElement('div');
    box.style.cssText = `inline-size:${width}px;block-size:${height}px`;
    document.body.append(box);
    return box;
  };
  window.sample = () => ({ labels: ['Jan', 'Feb'], datasets: [{ label: 'Revenue', data: [42, 55] }] });
});

const calls = (page, at) => page.evaluate((kind) => window.calls.filter((call) => !kind || call.at === kind), at);

export const cases = [
  {
    name: 'F5 a detached chart creates its engine once it is connected and sized, with the theme',
    async run({ page }) {
      await prepare(page);
      const before = await page.evaluate(() => {
        window.ready = 0;
        window.chart = new zx.Chart(null, { adapter: window.recorder(), data: window.sample(), onready: () => { window.ready += 1; } });
        return { created: window.calls.length, instance: window.chart.getInstance() };
      });
      assert.deepEqual(before, { created: 0, instance: null }, 'no engine while the canvas is detached');

      await page.evaluate(async () => {
        window.box().append(window.chart.toElement());
        await window.frames2();
      });
      const created = await calls(page, 'create');
      assert.equal(created.length, 1, 'exactly one engine after mounting');
      const [create] = created;
      assert.equal(create.connected, true);
      assert.ok(create.width === 600 && create.height > 0, `the canvas has a size at create(): ${create.width}×${create.height}`);
      assert.match(create.color, LEGACY, 'text colour without refreshTheme()');
      assert.match(create.borderColor, LEGACY, 'border colour without refreshTheme()');
      assert.equal(create.theme.color, create.color);
      assert.equal(create.theme.borderColor, create.borderColor);
      assert.equal(create.theme.palette.length, 8, 'the eight categorical colours');
      for (const colour of create.theme.palette) assert.match(colour, LEGACY);
      assert.equal(new Set(create.theme.palette).size, 8, 'eight distinct colours');
      assert.equal(await page.evaluate(() => window.ready), 1, 'ready fires once');
      await page.evaluate(() => window.chart.destroy());
    }
  },
  {
    name: 'F5 a connected target mounts synchronously, and getInstance() after append does not wait',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(() => {
        const target = document.createElement('div');
        window.box().append(target);
        const enhanced = new zx.Chart(target, { adapter: window.recorder(), data: window.sample() });
        const sync = { created: window.calls.length, instance: Boolean(enhanced.getInstance()), color: window.calls[0]?.color };
        enhanced.destroy();
        window.calls.length = 0;
        const detached = new zx.Chart(null, { adapter: window.recorder(), data: window.sample() });
        window.box().append(detached.toElement());
        const flushed = { instance: Boolean(detached.getInstance()), created: window.calls.length };
        window.chart = detached;
        return { sync, flushed, restored: target.childNodes.length === 0 && target.attributes.length === 0 };
      });
      assert.equal(result.sync.created, 1, 'constructed on a laid-out target');
      assert.equal(result.sync.instance, true);
      assert.match(result.sync.color, LEGACY);
      assert.equal(result.restored, true, 'destroy leaves the enhanced target as found');
      assert.deepEqual(result.flushed, { instance: true, created: 1 }, 'getInstance() right after append');
      await page.evaluate(() => window.frames2());
      assert.equal((await calls(page, 'create')).length, 1, 'the observer does not create a second engine');
      await page.evaluate(() => window.chart.destroy());
    }
  },
  {
    name: 'F5 calls before mount, destroy before mount, hidden containers and re-parenting',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(async () => {
        const out = {};
        // Everything a caller may do before the chart is in the document.
        const early = new zx.Chart(null, { adapter: window.recorder(), loading: true });
        early.setData({ labels: ['a'], datasets: [{ data: [1] }] }).update({ plugins: {} }).setType('line');
        early.setLoading(true).setLoading(false).resize().refreshTheme();
        out.early = window.calls.length;
        window.box().append(early.toElement());
        await window.frames2();
        out.mounted = window.calls.filter((call) => call.at === 'create').length;
        out.state = early.el.dataset.state;
        early.destroy();

        // Destroyed before it was ever connected: nothing is created, then or later.
        window.calls.length = 0;
        const never = new zx.Chart(null, { adapter: window.recorder(), data: window.sample() });
        const element = never.toElement();
        never.destroy();
        window.box().append(element);
        never.setData(window.sample());
        await window.frames2();
        out.never = window.calls.length;
        element.remove();

        // A hidden container: the engine waits for it to be shown.
        const hidden = window.box();
        hidden.style.display = 'none';
        const tab = new zx.Chart(null, { adapter: window.recorder(), data: window.sample() });
        hidden.append(tab.toElement());
        await window.frames2();
        out.hidden = window.calls.length;
        hidden.style.display = '';
        await window.frames2();
        out.shown = window.calls.filter((call) => call.at === 'create').length;

        // Moving the mounted chart keeps the one engine.
        window.box(400, 200).append(tab.toElement());
        await window.frames2();
        out.moved = window.calls.filter((call) => call.at === 'create').length;
        out.destroyed = window.calls.filter((call) => call.at === 'destroy').length;
        tab.destroy();
        out.leftovers = document.querySelectorAll('.zx-chart').length;
        return out;
      });
      assert.equal(result.early, 0, 'no engine from calls made while detached');
      assert.equal(result.mounted, 1);
      assert.equal(result.state, 'ready');
      assert.equal(result.never, 0, 'a destroyed chart never creates an engine');
      assert.equal(result.hidden, 0, 'no engine inside display:none');
      assert.equal(result.shown, 1, 'created when the container is shown');
      assert.equal(result.moved, 1, 're-parenting does not recreate');
      assert.equal(result.destroyed, 0);
      assert.equal(result.leftovers, 0);
    }
  },
  {
    name: 'F5 <zx-chart> creates its engine after connection and its ready event reaches the host',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(async () => {
        zx.defineElements('zx-wp82');
        const out = {};
        const make = () => {
          const element = document.createElement('zx-wp82-chart');
          element.adapter = window.recorder();
          element.data = window.sample();
          element.heard = 0;
          element.addEventListener('ready', () => { element.heard += 1; });
          return element;
        };
        const waiting = make();
        window.box().append(waiting);
        out.sync = window.calls.length;
        await window.frames2();
        out.framed = { creates: window.calls.length, heard: waiting.heard, color: window.calls[0]?.color };
        waiting.remove();

        window.calls.length = 0;
        const asked = make();
        window.box().append(asked);
        asked.resize();
        out.flushed = { creates: window.calls.filter((call) => call.at === 'create').length, heard: asked.heard };
        await window.frames2();
        out.afterFrame = window.calls.filter((call) => call.at === 'create').length;
        asked.remove();
        out.destroyed = window.calls.filter((call) => call.at === 'destroy').length;
        return out;
      });
      assert.equal(result.sync, 0, 'the engine is not created inside connectedCallback');
      assert.equal(result.framed.creates, 1, 'created within the frame');
      assert.equal(result.framed.heard, 1, 'ready reached the host element');
      assert.match(result.framed.color, LEGACY);
      assert.deepEqual(result.flushed, { creates: 1, heard: 1 }, 'resize() right after connecting creates it at once');
      assert.equal(result.afterFrame, 1);
      assert.equal(result.destroyed, 1);
    }
  },
  {
    name: 'F5 theme and preset switches reach the engine; computed colours arrive in legacy syntax',
    async run({ page, theme }) {
      await prepare(page);
      const result = await page.evaluate(async (theme) => {
        const out = {};
        const region = window.box();
        const chart = new zx.Chart(null, { adapter: window.recorder(), data: window.sample() });
        region.append(chart.toElement());
        await window.frames2();
        const updates = () => window.calls.filter((call) => call.at === 'update');
        out.first = window.calls.find((call) => call.at === 'create').color;

        document.documentElement.dataset.zxTheme = theme === 'dark' ? 'light' : 'dark';
        await window.frames2();
        out.afterTheme = updates().length;
        out.second = updates().at(-1)?.color;

        // A nested region flips it back, by attribute on an ancestor.
        region.dataset.zxTheme = theme;
        await window.frames2();
        out.afterRegion = updates().length;
        out.third = updates().at(-1)?.color;

        // A preset that does not change the colours a chart reads causes no update.
        document.documentElement.dataset.zxPreset = 'ocean';
        await window.frames2();
        out.afterPreset = updates().length;

        // Colours the browser computes in CSS Color 4 syntax.
        region.style.setProperty('--zx-color-border', 'color(srgb 1 1 1 / 0.09)');
        region.style.setProperty('--zx-color-text', 'oklch(0.627955 0.257683 29.2339)');
        region.style.setProperty('--zx-color-chart-1', 'color-mix(in oklab, #ffffff 50%, #000000)');
        region.style.setProperty('--zx-color-chart-2', 'color(rec2020 0.2 0.5 0.3)');
        region.style.setProperty('--zx-color-chart-3', 'light-dark(#102030, #a0b0c0)');
        const probe = document.createElement('span');
        probe.style.color = 'var(--zx-color-border)';
        region.append(probe);
        out.computedBorder = getComputedStyle(probe).color;
        probe.remove();
        chart.refreshTheme();
        out.manual = updates().at(-1);
        chart.destroy();
        return out;
      }, theme);
      assert.match(result.first, LEGACY);
      assert.equal(result.afterTheme, 1, 'one update for the theme switch');
      assert.notEqual(result.second, result.first, 'the other theme has another text colour');
      assert.equal(result.afterRegion, 2, 'a theme attribute on an ancestor');
      assert.equal(result.third, result.first);
      assert.equal(result.afterPreset, 2, 'no update when the chart colours did not change');
      assert.doesNotMatch(result.computedBorder, /^(?:#|rgb)/, 'the browser really computes a CSS Color 4 string here');
      assert.equal(result.manual.borderColor, 'rgba(255, 255, 255, 0.09)');
      assert.equal(result.manual.color, '#ff0000');
      assert.equal(result.manual.theme.palette.length, 8);
      for (const colour of result.manual.theme.palette) assert.match(colour, LEGACY);
      assert.equal(result.manual.theme.palette[0], '#636363', 'an oklab mix of white and black');
      assert.equal(result.manual.theme.palette[2], theme === 'dark' ? '#a0b0c0' : '#102030', 'light-dark() takes the region scheme');
    }
  },
  {
    name: 'F5 ChartJsAdapter mounts Chart.js on a sized canvas and colours series from the palette',
    async run({ page, base }) {
      await prepare(page);
      await page.addScriptTag({ url: `${base}/node_modules/chart.js/dist/chart.umd.js` });
      const result = await page.evaluate(async () => {
        const out = {};
        const chart = new zx.Chart(null, {
          adapter: new zx.ChartJsAdapter(window.Chart),
          data: {
            labels: ['Jan', 'Feb'],
            datasets: [
              { label: 'Revenue', data: [42, 55] },
              { label: 'Costs', data: [28, 31], backgroundColor: '#123456' },
              { label: 'Margin', data: [14, 24] }
            ]
          }
        });
        out.early = chart.getInstance();
        window.box().append(chart.toElement());
        await window.frames2();
        const instance = chart.getInstance();
        out.size = [instance.width, instance.height];
        out.color = instance.options.color;
        out.datasets = instance.data.datasets.map((dataset) => [dataset.backgroundColor, dataset.borderColor]);
        out.palette = [1, 2, 3].map((index) => {
          const probe = document.createElement('span');
          probe.style.color = `var(--zx-color-chart-${index})`;
          chart.el.append(probe);
          const value = getComputedStyle(probe).color;
          probe.remove();
          return value;
        });
        const pixels = chart.refs.canvas.getContext('2d').getImageData(0, 0, chart.refs.canvas.width, chart.refs.canvas.height).data;
        out.painted = pixels.some((value) => value !== 0);

        chart.setType('doughnut');
        out.arc = chart.getInstance().data.datasets[0].backgroundColor;
        document.documentElement.dataset.zxTheme = document.documentElement.dataset.zxTheme === 'dark' ? 'light' : 'dark';
        await window.frames2();
        out.switched = chart.getInstance().options.color;
        chart.destroy();
        out.canvases = document.querySelectorAll('canvas').length;
        return out;
      });
      assert.equal(result.early, null);
      assert.equal(result.size[0], 600, 'Chart.js measured the canvas');
      assert.ok(result.size[1] > 0);
      assert.match(result.color, LEGACY);
      const [first, own, third] = result.datasets;
      assert.match(first[0], LEGACY);
      assert.equal(first[0], first[1], 'a bar is filled and stroked with its series colour');
      assert.deepEqual(own, ['#123456', undefined], 'a dataset with a colour of its own is left alone');
      assert.match(third[0], LEGACY);
      assert.notEqual(third[0], first[0], 'the third series takes the third colour');
      const rgb = (hex) => `rgb(${[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;
      assert.equal(rgb(first[0]), result.palette[0], '--zx-color-chart-1');
      assert.equal(rgb(third[0]), result.palette[2], '--zx-color-chart-3');
      assert.equal(result.painted, true, 'the canvas was drawn on');
      assert.equal(result.arc.length, 2, 'an arc chart is coloured per value');
      assert.equal(result.arc[0], first[0]);
      assert.equal(rgb(result.arc[1]), result.palette[1], '--zx-color-chart-2');
      assert.notEqual(result.switched, result.color, 'the theme switch reached Chart.js');
      assert.equal(result.canvases, 0);
    }
  },
  {
    name: 'F6 fill mode takes the container height; the minimum height is a custom property',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(async () => {
        const out = {};
        const height = (chart) => Math.round(chart.refs.viewport.getBoundingClientRect().height);
        const plain = new zx.Chart(null, { adapter: window.recorder(), data: window.sample() });
        const plainBox = window.box(600, 300);
        plainBox.append(plain.toElement());
        out.ratio = height(plain);
        plain.setAspectRatio('2 / 1');
        out.setRatio = height(plain);
        plain.setAspectRatio(null);
        out.resetRatio = height(plain);
        plainBox.style.inlineSize = '200px';
        out.floor = height(plain);
        plainBox.style.setProperty('--zx-chart-min-block-size', '120px');
        out.customFloor = height(plain);

        const fillBox = window.box(600, 300);
        const fill = new zx.Chart(null, { adapter: window.recorder(), data: window.sample(), fill: true });
        fillBox.append(fill.toElement());
        out.fill = height(fill);
        out.root = Math.round(fill.el.getBoundingClientRect().height);
        out.attribute = fill.el.hasAttribute('data-fill');
        fillBox.style.blockSize = '150px';
        out.short = height(fill);
        fill.setDescription('Monthly values');
        out.described = height(fill) + Math.round(fill.refs.description.getBoundingClientRect().height);
        out.gap = Number.parseFloat(getComputedStyle(fill.el).rowGap);
        fill.setDescription('');
        fill.setLoading(true);
        out.status = Math.round(fill.refs.status.getBoundingClientRect().height);
        fill.setLoading(false);
        fillBox.style.setProperty('--zx-chart-min-block-size', '200px');
        out.fillFloor = height(fill);
        fillBox.style.removeProperty('--zx-chart-min-block-size');
        fill.setFill(false);
        out.unfilled = height(fill);
        fill.setFill();
        await window.frames2();
        out.refilled = height(fill);
        out.canvas = Math.round(fill.refs.canvas.getBoundingClientRect().height);
        out.resizes = window.calls.filter((call) => call.at === 'resize').length;
        plain.destroy();
        fill.destroy();
        return out;
      });
      assert.equal(result.ratio, 338, '600 wide at 16 / 9, as before');
      assert.equal(result.setRatio, 300, 'setAspectRatio("2 / 1")');
      assert.equal(result.resetRatio, 338, 'setAspectRatio(null) restores the default');
      assert.equal(result.floor, 220, 'the default floor is unchanged');
      assert.equal(result.customFloor, 120, '--zx-chart-min-block-size');
      assert.equal(result.fill, 300, 'fill: the viewport is as tall as the container');
      assert.equal(result.root, 300);
      assert.equal(result.attribute, true);
      assert.equal(result.short, 150, 'fill has no floor of its own');
      assert.equal(result.described + result.gap, 150, 'the description is taken out of the viewport');
      assert.equal(result.status, 150, 'the status fills the container too');
      assert.equal(result.fillFloor, 200, 'a floor the application set still holds in fill mode');
      assert.equal(result.unfilled, 338);
      assert.equal(result.refilled, 150);
      assert.equal(result.canvas, 150);
      assert.ok(result.resizes > 0, 'the engine was told about the new size');
    }
  },
  {
    name: 'F6 setLabel, setDescription and setSummary keep the accessible wiring',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(() => {
        const chart = new zx.Chart(null, { adapter: window.recorder(), data: window.sample(), label: 'Before', description: 'Old' });
        window.box().append(chart.toElement());
        const read = () => ({
          name: chart.refs.canvas.getAttribute('aria-label'),
          caption: chart.el.querySelector('caption').textContent,
          described: document.getElementById(chart.refs.canvas.getAttribute('aria-describedby'))?.textContent,
          descriptionShown: getComputedStyle(chart.refs.description).display !== 'none',
          summary: chart.refs.summary.dataset.summary,
          summaryBox: Math.round(chart.refs.summary.getBoundingClientRect().width)
        });
        const out = { before: read() };
        const instance = chart.getInstance();
        chart.setLabel('After').setDescription('New').setSummary('visible');
        out.after = read();
        chart.setLabel('  ').setDescription(null).setSummary('nonsense');
        out.cleared = read();
        out.sameEngine = chart.getInstance() === instance;
        out.creates = window.calls.filter((call) => call.at === 'create').length;
        chart.destroy();
        return out;
      });
      assert.deepEqual(result.before, { name: 'Before', caption: 'Before', described: 'Old', descriptionShown: true, summary: 'hidden', summaryBox: 1 });
      assert.deepEqual({ ...result.after, summaryBox: 0 }, { name: 'After', caption: 'After', described: 'New', descriptionShown: true, summary: 'visible', summaryBox: 0 });
      assert.equal(result.after.summaryBox, 600, 'the visible table takes the width');
      assert.deepEqual(result.cleared, { name: 'Chart', caption: 'Chart', described: '', descriptionShown: false, summary: 'hidden', summaryBox: 1 });
      assert.equal(result.sameEngine, true, 'none of the setters rebuilds the engine');
      assert.equal(result.creates, 1);
    }
  },
  {
    name: 'F9 summary values are written for the language; summaryFormat overrides',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(() => {
        const data = {
          labels: ['Jan', 'Feb', 'Mar'],
          datasets: [
            { label: 'Revenue', data: [0.1 + 0.2, 1234567.5, null] },
            { label: 'Points', data: [{ x: 1, y: 1500.25 }, 'n/a', 0.000123456] }
          ]
        };
        const cells = (chart) => Array.from(chart.el.querySelectorAll('td'), (cell) => cell.textContent);
        const out = {};
        const plain = new zx.Chart(null, { data });
        out.english = cells(plain);
        const german = new zx.Chart(null, { data, lang: 'de' });
        out.german = cells(german);
        const seen = [];
        const custom = new zx.Chart(null, {
          data,
          summaryFormat: (value, context) => {
            seen.push([value, context.dataset.label, context.datasetIndex, context.index, context.label, context.formatted]);
            if (context.datasetIndex === 1) return null;
            return typeof value === 'number' ? `${zx.formatCurrency(value, 'EUR', { locale: 'en' })}` : '—';
          }
        });
        out.custom = cells(custom);
        out.seen = seen;
        custom.setData({ labels: ['Q1'], datasets: [{ label: 'Revenue', data: [2000] }] });
        out.afterSetData = cells(custom);
        for (const chart of [plain, german, custom]) chart.destroy();
        return out;
      });
      assert.deepEqual(result.english, ['0.3', '1,500.25', '1,234,567.5', 'n/a', '', '0.000123456']);
      assert.deepEqual(result.german, ['0,3', '1.500,25', '1.234.567,5', 'n/a', '', '0,000123456']);
      assert.deepEqual(result.custom, ['€0.30', '1,500.25', '€1,234,567.50', 'n/a', '—', '0.000123456']);
      assert.deepEqual(result.seen[0], [0.1 + 0.2, 'Revenue', 0, 0, 'Jan', '0.3']);
      assert.deepEqual(result.seen[1], [1500.25, 'Points', 1, 0, 'Jan', '1,500.25']);
      assert.deepEqual(result.afterSetData, ['€2,000.00']);
    }
  },
  {
    name: 'F15 setData() clears loading and error; setLoading(true) destroys the engine',
    async run({ page }) {
      await prepare(page);
      const result = await page.evaluate(() => {
        const out = {};
        const chart = new zx.Chart(null, { adapter: window.recorder(), data: window.sample() });
        window.box().append(chart.toElement());
        const first = chart.getInstance();
        chart.setLoading(true);
        out.loading = { state: chart.el.dataset.state, instance: chart.getInstance(), destroys: window.calls.filter((call) => call.at === 'destroy').length };
        chart.setData(window.sample());
        out.afterData = { state: chart.el.dataset.state, fresh: chart.getInstance() !== null && chart.getInstance() !== first };
        chart.setError(new Error('Backend down'));
        out.error = { state: chart.el.dataset.state, instance: chart.getInstance(), text: chart.refs.status.textContent };
        chart.setData(window.sample());
        out.afterError = { state: chart.el.dataset.state, mounted: chart.getInstance() !== null, status: chart.refs.status.hidden };
        chart.setLoading(true);
        chart.setLoading(false);
        out.resumed = { state: chart.el.dataset.state, creates: window.calls.filter((call) => call.at === 'create').length };
        chart.destroy();
        return out;
      });
      assert.deepEqual(result.loading, { state: 'loading', instance: null, destroys: 1 });
      assert.deepEqual(result.afterData, { state: 'ready', fresh: true });
      assert.deepEqual(result.error, { state: 'error', instance: null, text: 'Backend down' });
      assert.deepEqual(result.afterError, { state: 'ready', mounted: true, status: true });
      assert.deepEqual(result.resumed, { state: 'ready', creates: 4 });
    }
  }
];
