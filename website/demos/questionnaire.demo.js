import { Questionnaire, h } from '../../src/index.js';

/** A feedback survey: single choice with a freeform escape hatch, multi-choice, and a skip. */
function feedback() {
  return [
    {
      name: 'role',
      prompt: 'What do you use ZeyOS for?',
      description: 'Pick the closest match, or write your own.',
      required: true,
      choices: [
        { value: 'sales', label: 'Sales', description: 'Quotations, orders, pipeline' },
        { value: 'service', label: 'Service', description: 'Tickets and field work' },
        { value: 'finance', label: 'Finance', description: 'Invoicing and reporting' }
      ],
      input: { label: 'Something else', placeholder: 'Tell us in your own words…' }
    },
    {
      name: 'modules',
      prompt: 'Which modules do you open every day?',
      description: 'Pick as many as apply.',
      multiple: true,
      choices: [
        { value: 'transactions', label: 'Transactions' },
        { value: 'accounts', label: 'Accounts' },
        { value: 'tickets', label: 'Tickets' },
        { value: 'none', label: 'None of these', exclusive: true }
      ]
    },
    {
      name: 'note',
      prompt: 'Anything we should know?',
      description: 'Optional — skip it if nothing comes to mind.',
      skippable: true,
      input: { label: 'Your note', placeholder: 'Optional', multiline: true }
    }
  ];
}

/** A customer intake where the answer to the first question opens or closes a whole branch. */
function intake() {
  return [
    {
      name: 'type',
      section: 'Customer',
      prompt: 'Who are we invoicing?',
      required: true,
      choices: [
        { value: 'company', label: 'A company', description: 'Registered business, VAT applies' },
        { value: 'private', label: 'A private buyer', description: 'Consumer, gross prices' }
      ]
    },
    {
      name: 'vat',
      section: 'Company',
      prompt: 'What is the VAT id?',
      required: true,
      when: (answers) => answers.type === 'company',
      input: { label: 'VAT id', placeholder: 'DE123456789' }
    },
    {
      name: 'reverse',
      section: 'Company',
      prompt: 'Is this a reverse-charge customer?',
      // Depends on the VAT answer, so it disappears with it when the branch closes.
      when: (answers) => Boolean(answers.vat),
      choices: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]
    },
    {
      name: 'delivery',
      section: 'Delivery',
      prompt: 'How should we ship?',
      required: true,
      choices: [
        { value: 'standard', label: 'Standard' },
        { value: 'express', label: 'Express' },
        { value: 'pickup', label: 'Pickup' }
      ]
    }
  ];
}

/** An intake asking for real data types: a Field per question instead of a list of choices. */
function onboarding() {
  return [
    {
      name: 'start',
      prompt: 'When do you want to go live?',
      required: true,
      field: { type: 'date' }
    },
    {
      name: 'seats',
      prompt: 'How many seats do you need?',
      required: true,
      field: { type: 'number', props: { min: 1, max: 500, value: 10 } }
    },
    {
      name: 'vat',
      prompt: 'What is your VAT id?',
      description: 'Checked against the registry before you continue. "DE000000000" is rejected.',
      required: true,
      field: { type: 'text', placeholder: 'DE123456789' },
      // Any promise works here, which is how a question gets gated on a server round trip.
      validate: async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 700));
        return String(value) === 'DE000000000' ? 'That VAT id is not registered.' : null;
      }
    },
    {
      name: 'satisfaction',
      prompt: 'How happy are you with the onboarding so far?',
      field: { type: 'rating' }
    }
  ];
}

export default {
  title: 'Questionnaire',
  group: 'Forms',
  blurb: 'One question at a time, with branching, a path-aware progress bar, and any Zx field type '
    + 'as the answer. The root is a real form and the choices are real radios, so FormData reads '
    + 'the answers and the keyboard contract is the browser’s.',

  examples: [
    {
      title: 'Guided survey',
      blurb: 'The baseline: a required single choice with a freeform alternative, a multiple-choice '
        + 'question whose “None of these” clears the rest, and a skippable note. Every '
        + 'answer carries a shortcut key — press 1, 2 or 3 instead of aiming — and Enter '
        + 'is Continue. Try continuing without answering the first question.',
      layout: 'stack',
      width: 520,
      render: ({ cleanup, log }) => {
        const survey = new Questionnaire(null, {
          items: feedback(),
          review: false,
          onchange: ({ detail }) => log(`${detail.name} = ${JSON.stringify(detail.value)}`),
          onskip: ({ detail }) => log(`skipped ${detail.name}`),
          oninvalid: ({ detail }) => log(`invalid: ${detail.message}`),
          onsubmit: ({ detail }) => log(`submit ${JSON.stringify(detail.answers)}`)
        });
        cleanup(() => survey.destroy());
        return survey.toElement();
      }
    },
    {
      title: 'Branching and honest progress',
      blurb: 'Each item carries a when predicate, and conditions cascade: answering “company” '
        + 'opens the VAT question, which in turn opens the reverse-charge question. Go back and '
        + 'switch to a private buyer and both disappear — along with their answers, so an '
        + 'abandoned branch never submits stale data. The counter and the bar count the questions '
        + 'actually reachable, not the array length, and Back retraces the route you walked.',
      layout: 'stack',
      width: 520,
      render: ({ cleanup, log }) => {
        const state = h('pre', { class: 'demo-card' });
        const wizard = new Questionnaire(null, {
          items: intake(),
          onnavigate: ({ detail }) => log(`${detail.reason}: ${detail.from} → ${detail.to}`),
          onsubmit: ({ detail }) => log(`submit ${JSON.stringify(detail.answers)}`)
        });

        const paint = () => {
          const { path, progress, answers } = wizard.getState();
          state.textContent = [
            `path      ${path.join(' → ') || '—'}`,
            `progress  ${progress.index + 1} of ${progress.total} (${progress.percent}%)`,
            `answers   ${JSON.stringify(answers)}`
          ].join('\n');
        };
        wizard.on('change', paint).on('navigate', () => queueMicrotask(paint));
        paint();

        cleanup(() => wizard.destroy());
        return [wizard.toElement(), state];
      }
    },
    {
      title: 'Field answers and async validation',
      blurb: 'An item can hand the answer to any registered Zx field type instead of a list of '
        + 'choices — here a date, a number, a text field and a rating, each with the field’s '
        + 'own control and its own highlight. The VAT question’s validate returns a promise, so '
        + 'Continue waits on the check and reports what came back. Enter DE000000000 to see it fail.',
      layout: 'stack',
      width: 520,
      render: ({ cleanup, log }) => {
        const form = new Questionnaire(null, {
          items: onboarding(),
          oninvalid: ({ detail }) => log(`invalid ${detail.name}: ${detail.message}`),
          onsubmit: ({ detail }) => log(`submit ${JSON.stringify(detail.answers)}`)
        });
        cleanup(() => form.destroy());
        return form.toElement();
      }
    },
    {
      title: 'Review before submitting',
      blurb: 'review: true adds a summary of every answer on the path taken. Edit reopens that '
        + 'question and Continue comes straight back here rather than replaying the tail. Submitting '
        + 'reads the answers as FormData — one entry per value for a multiple-choice question.',
      layout: 'stack',
      width: 520,
      render: ({ cleanup, log }) => {
        const survey = new Questionnaire(null, {
          items: feedback(),
          review: true,
          onsubmit: (event) => {
            const entries = [...survey.toFormData().entries()];
            log(`FormData: ${entries.map(([key, value]) => `${key}=${value}`).join(' | ')}`);
            event.preventDefault();
            log('submit prevented — the page owns transport');
          }
        });
        cleanup(() => survey.destroy());
        return survey.toElement();
      }
    }
  ]
};
