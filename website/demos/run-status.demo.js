import { RunStatus, button, h } from '../../src/index.js';

// Run times are local date-times; these demos place them a few minutes before now.
function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000);
}

// A run in progress, as the application keeps it: what it is doing in one sentence, the steps,
// the clock, the tokens and what they cost against the run's budget.
function runningRun() {
  return {
    state: 'running',
    summary: 'Reading the dunning policy…',
    steps: { done: 2, total: 6 },
    started: minutesAgo(1),
    workMs: 41_000,
    tokens: [12_840, 402],
    cost: { amount: 0.08, budget: 2, currency: 'EUR' },
    model: 'Large, hosted in the EU'
  };
}

// The same run, holding until a person answers its approval request.
function waitingRun() {
  return {
    state: 'waiting',
    summary: 'Step 4 of 6 needs your approval: three reminder emails are ready to send.',
    steps: { done: 3, total: 6 },
    started: minutesAgo(6),
    workMs: 74_000,
    waitingSince: minutesAgo(4),
    tokens: [18_420, 1_236],
    cost: { amount: 0.14, budget: 2, currency: 'EUR' }
  };
}

// A run that stopped on an error. The summary says why, in words a person can act on.
function failedRun() {
  return {
    state: 'failed',
    summary: 'The bank connection expired, so the payments since Friday could not be read.',
    steps: { done: 1, total: 4 },
    started: minutesAgo(22),
    finished: minutesAgo(21),
    workMs: 9_000,
    tokens: [3_210, 88],
    cost: { amount: 0.02, budget: 2, currency: 'EUR' }
  };
}

// A finished run that spent most of its budget: the cost meter turns to the warning tone at 80%.
function doneRun() {
  return {
    state: 'done',
    summary: 'All 6 steps finished. The forecast is in the Finance folder.',
    steps: { done: 6, total: 6 },
    started: minutesAgo(48),
    finished: minutesAgo(31),
    workMs: 1_002_000,
    tokens: [214_800, 18_620],
    cost: { amount: 1.74, budget: 2, currency: 'EUR' },
    model: 'Large, hosted in the EU'
  };
}

// A run that counts its tokens against a budget instead of money: tokens may be one total, and
// tokenBudget turns them into a meter read in compact figures.
function budgetedRun() {
  return {
    state: 'running',
    summary: 'Drafting the quarterly summary…',
    steps: { done: 3, total: 5 },
    started: minutesAgo(3),
    workMs: 128_000,
    tokens: 22_840,
    tokenBudget: 60_000,
    model: 'Large, hosted in the EU'
  };
}

// A run that cannot go on until something outside it changes: here, a permission it lacks.
// A blocked run is not over, so it says since when it has been blocked, not when it finished.
function blockedRun() {
  return {
    state: 'blocked',
    summary: 'The ledger is locked for the month-end close, so the payments cannot be booked.',
    steps: { done: 2, total: 5 },
    started: minutesAgo(18),
    workMs: 52_000,
    waitingSince: minutesAgo(15),
    tokens: [9_120, 344]
  };
}

// The states a header pill shows, one per run in a list of conversations.
const PILL_STATES = ['running', 'waiting', 'blocked', 'done', 'failed', 'stopped'];

export default {
  title: 'Run status',
  group: 'Agents',
  api: ['RunStatus'],
  blurb: 'Where an agent\'s run stands: its state in a glyph and a word, what it is doing, its '
    + 'steps, its clock, and what it has cost against its budget.',
  examples: [
    {
      title: 'A running run',
      blurb: 'While the state is running, the working time counts on once a second from workMs. '
        + 'update() merges new values: the clock carries on unless the update brings a new workMs.',
      layout: 'stack',
      width: '360px',
      render: ({ cleanup, log }) => {
        const run = new RunStatus(null, runningRun());
        cleanup(() => run.destroy());
        const next = () => {
          const { steps } = run.getState();
          const done = Math.min(steps.total, steps.done + 1);
          run.update(done === steps.total
            ? { state: 'done', steps: { ...steps, done }, summary: 'All 6 steps finished.', finished: new Date() }
            : { steps: { ...steps, done }, summary: `Working on step ${done + 1} of ${steps.total}…` });
          log(`${run.getState().state}: ${done} of ${steps.total} steps`);
        };
        return [
          run.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Finish a step', onclick: next }),
            button({ label: 'Restart', onclick: () => {
              run.update({ ...runningRun(), finished: null });
              log('restarted');
            } }))
        ];
      }
    },
    {
      title: 'Waiting for approval',
      blurb: 'actions are buttons under the summary. Each emits action with its index and '
        + 'descriptor, after its own onclick.',
      layout: 'stack',
      width: '360px',
      render: ({ cleanup, log }) => {
        const run = new RunStatus(null, {
          ...waitingRun(),
          actions: [{ label: 'Review the request', kind: 'primary' }],
          onaction: ({ detail }) => log(`action ${detail.index}: ${detail.action.label}`)
        });
        cleanup(() => run.destroy());
        return run.toElement();
      }
    },
    {
      title: 'Failed',
      blurb: 'The state and the summary say what went wrong; the steps bar takes the danger tone '
        + 'and the finished row reads "Failed at".',
      layout: 'stack',
      width: '360px',
      render: ({ cleanup, log }) => {
        const run = new RunStatus(null, {
          ...failedRun(),
          actions: [{ label: 'Renew the bank connection' }, { label: 'Retry', kind: 'ghost' }],
          onaction: ({ detail }) => log(`action ${detail.index}: ${detail.action.label}`)
        });
        cleanup(() => run.destroy());
        return run.toElement();
      }
    },
    {
      title: 'A token budget',
      blurb: 'tokens is [in, out] or one total. With tokenBudget the tokens are a meter read as '
        + '"22.8K of 60K tokens", toned like the cost from 80% and at 100%. update() keeps focus on '
        + 'the action it was on, so the Pause button can be pressed again from the keyboard.',
      layout: 'stack',
      width: '360px',
      render: ({ cleanup, log }) => {
        const pause = [{ label: 'Pause' }];
        const resume = [{ label: 'Resume', kind: 'primary' }];
        const run = new RunStatus(null, {
          ...budgetedRun(),
          actions: pause,
          onaction: () => {
            const paused = run.getState().state === 'paused';
            run.update({ state: paused ? 'running' : 'paused', actions: paused ? pause : resume });
            log(paused ? 'resumed' : 'paused');
          }
        });
        cleanup(() => run.destroy());
        const spend = () => {
          const { tokens } = run.getState();
          const total = Math.min(66_000, Number(tokens) + 9_000);
          run.update({ tokens: total });
          log(`${total} tokens`);
        };
        return [
          run.toElement(),
          h('div', { class: 'demo-row' },
            button({ label: 'Use 9,000 tokens', onclick: spend }),
            button({ label: 'Reset', onclick: () => {
              run.update({ ...budgetedRun(), actions: pause });
              log('reset');
            } }))
        ];
      }
    },
    {
      title: 'Blocked',
      blurb: 'A blocked run is held by something outside it. It is not over: the panel says since '
        + 'when it has been blocked (from waitingSince) and shows no finished time.',
      layout: 'stack',
      width: '360px',
      render: ({ cleanup, log }) => {
        const run = new RunStatus(null, {
          ...blockedRun(),
          actions: [{ label: 'Ask for access', kind: 'primary' }],
          onaction: ({ detail }) => log(`action ${detail.index}: ${detail.action.label}`)
        });
        cleanup(() => run.destroy());
        return run.toElement();
      }
    },
    {
      title: 'Done, near its budget',
      blurb: 'With a budget the cost is a meter read as "€1.74 of €2.00". It turns to the warning '
        + 'tone from 80% and to the danger tone at 100%.',
      layout: 'stack',
      width: '360px',
      render: ({ cleanup }) => {
        const run = new RunStatus(null, doneRun());
        cleanup(() => run.destroy());
        return run.toElement();
      }
    },
    {
      title: 'Compact, for a header',
      blurb: 'compact draws the state alone, glyph and word, where the full panel has no room. '
        + 'compact: \'icon\' draws the glyph alone, for a list row: the word stays the accessible '
        + 'text and shows as a tooltip.',
      layout: 'stack',
      render: ({ cleanup }) => {
        const pills = PILL_STATES.map((state) => new RunStatus(null, { state, compact: true }));
        const icons = PILL_STATES.map((state) => new RunStatus(null, { state, compact: 'icon' }));
        cleanup(() => [...pills, ...icons].forEach((pill) => pill.destroy()));
        return [
          h('div', { class: 'demo-row' }, pills.map((pill) => pill.toElement())),
          h('div', { class: 'demo-row' }, icons.map((icon) => icon.toElement()))
        ];
      }
    }
  ]
};
