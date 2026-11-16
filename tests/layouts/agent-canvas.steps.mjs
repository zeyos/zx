/**
 * Drives the agent canvas layout through all eight of its scripted requests, for
 * `tools/shoot-layout.js` and `tools/audit-layout.js`:
 *
 *   node tools/shoot-layout.js agent-canvas --steps tests/layouts/agent-canvas.steps.mjs --out <dir>
 *
 * Each request is sent the way a reader would — a starter, a suggestion, or the composer — and
 * answered in its surface: the October figures opened in the panel with the chart's data shown,
 * rows picked and a send confirmed, a form corrected after its validation error, changes accepted
 * in part, a questionnaire walked through its refusals to its review, a choice that makes a second
 * version, a deletion typed to confirm after one cancel, and a surface the agent corrects after the
 * application's report. Esc stops a surface while it arrives. It fails on any surface that reports
 * a problem it was not written to have. Works at any width: below 1180px the artifact panel is a
 * drawer, opened and closed again.
 */

/** The layout's root, and the parts the steps reach for. */
const ROOT = '.canvas';
const SURFACES = `${ROOT} .zx-agent-thread__item[data-type="surface"]`;

/**
 * @param {import('playwright-core').Page} page
 * @param {{shot?: (name: string) => Promise<void>}} [tools]
 * @returns {Promise<void>}
 */
export default async function steps(page, { shot = async () => {} } = {}) {
  const root = page.locator(ROOT);
  const composer = page.locator(`${ROOT} .zx-composer textarea`);
  const panel = page.locator(`${ROOT} .canvas__panel`);
  const versionLabel = panel.locator('.canvas__version');
  const latest = () => page.locator(SURFACES).last();

  /** Waits until the agent has finished writing. */
  const idle = () => page.waitForSelector(`${ROOT} .zx-composer [data-mode="send"]`, { timeout: 20_000 });

  /** Waits for a surface with this title to have arrived whole, and the agent to be done. */
  const arrived = async (title) => {
    await page.waitForFunction(([selector, text]) => [...document.querySelectorAll(selector)].some((item) => {
      const surface = item.querySelector('.zx-surface');
      return surface && !surface.hasAttribute('aria-busy') && item.textContent.includes(text);
    }), [SURFACES, title], { timeout: 20_000 });
    await idle();
  };

  /** Sends a message through the composer. */
  const type = async (text) => {
    await composer.fill(text);
    await composer.press('Enter');
  };

  /** Presses a suggestion under the thread, or types the request where it isn't offered. */
  const suggestion = async (text) => {
    const chip = page.locator(`${ROOT} .canvas__follow-ups button`, { hasText: text });
    if (await chip.count()) await chip.click();
    else await type(text);
  };

  /** Opens a surface in the panel — a drawer where it is one. */
  const openInPanel = (item) => item.getByRole('button', { name: 'Open in panel' }).click();
  const closeDrawer = async () => {
    if (await root.evaluate((element) => element.dataset.asideOpen === 'true')) await page.keyboard.press('Escape');
  };

  /** Fails when a surface in the thread reported a problem: none was written to have one. */
  const clean = async (label) => {
    const reports = await page.evaluate(async (selector) => {
      const { Component } = await import('/src/index.js');
      return [...document.querySelectorAll(`${selector} .zx-surface`)].map((element) => {
        const surface = /** @type {any} */ (Component.from(element));
        return { title: surface?.toDocument()?.title ?? '', codes: (surface?.getErrors() ?? []).map((error) => error.code) };
      }).filter((entry) => entry.codes.length);
    }, SURFACES);
    if (reports.length) throw new Error(`${label}: surfaces reported ${JSON.stringify(reports)}`);
  };

  /* 1 · October is answered on arrival: open it in the panel and show the chart's data. */
  await page.waitForSelector(`${SURFACES} .zx-surface:not([aria-busy])`, { timeout: 10_000 });
  await openInPanel(latest());
  await panel.getByRole('button', { name: 'Data table' }).click();
  await shot('october-panel');
  await panel.getByRole('tab', { name: 'JSON' }).click();
  await panel.getByRole('tab', { name: 'Reply' }).click();
  await panel.getByRole('tab', { name: 'Preview' }).click();
  await closeDrawer();
  await clean('october');

  // A new conversation offers every request as a starter. October again, stopped with Esc while
  // it arrives: the surface replies, and its receipt says so.
  await page.getByRole('button', { name: 'Conversation actions' }).click();
  await page.getByRole('menuitem', { name: 'New conversation' }).click();
  const starters = page.locator(`${ROOT} .zx-prompt-starters`);
  await starters.waitFor();
  await shot('new-conversation');
  await starters.getByRole('button', { name: 'How did October go?' }).click();
  await page.waitForSelector(`${SURFACES} .zx-surface canvas, ${SURFACES} .zx-surface .zx-chart`, { timeout: 10_000 });
  await shot('october-streaming');
  await page.keyboard.press('Escape');
  await idle();
  await latest().locator('.zx-surface[data-state="answered"]').waitFor();
  await clean('stop');

  // A request the example has no script for gets one plain reply.
  await type('What will the weather be like tomorrow?');
  await page.waitForSelector(`${ROOT} .zx-agent-thread__item[data-type="answer"]`, { timeout: 10_000 });
  await idle();

  /* 2 · Reminders: pick two rows, send, and confirm what the policy asks. */
  await suggestion('Chase the overdue invoices');
  await arrived('Send first reminders?');
  await latest().getByRole('checkbox', { name: 'Select RE-2026-0121' }).check();
  await latest().getByRole('checkbox', { name: 'Select RE-2026-0129' }).check();
  await latest().getByRole('button', { name: 'Send reminders' }).click();
  const confirm = page.getByRole('dialog', { name: 'Send first reminders?' });
  await confirm.waitFor();
  await page.waitForTimeout(350);
  await shot('reminders-confirm');
  await confirm.getByRole('button', { name: 'Send reminders' }).click();
  await arrived('Reminders scheduled');
  await clean('reminders');

  /* 3 · Credit note: "Something else" shows a field; submitting without it is refused. */
  await type('Draft a credit note');
  await arrived('Credit note for Bruckner Logistik');
  await latest().getByRole('radio', { name: 'Something else' }).check();
  await latest().getByRole('textbox', { name: 'What happened' }).waitFor();
  await latest().getByRole('button', { name: 'Submit' }).click();
  await page.waitForTimeout(200);
  await shot('credit-error');
  await latest().getByRole('textbox', { name: 'What happened' }).fill('Pallets 3 and 7 arrived with broken slats.');
  const issueOn = latest().getByRole('textbox', { name: 'Issue on' });
  await issueOn.fill('12.10.2026');
  await issueOn.press('Tab');
  await latest().getByRole('button', { name: 'Submit' }).click();
  await arrived('Credit note GS-2026-0019 drafted');
  await clean('credit');

  /* 4 · Helios: accept two of the four changes; the rest are rejected. */
  await suggestion('Tidy up Helios’ record');
  await arrived('Tidy up Helios Energie');
  const changes = latest().locator('.zx-table__row-checkbox');
  await changes.nth(0).check();
  await changes.nth(2).check();
  await latest().getByRole('button', { name: 'Approve selected' }).click();
  await arrived('Helios Energie updated');
  await clean('helios');

  /* 5 · Dunning run: a branch, two refused answers, then the review and Submit. */
  await type('Set up the dunning run');
  await arrived('Set up the dunning run');
  const walk = latest();
  await walk.getByText('Only larger amounts').click();
  await walk.getByRole('button', { name: 'Continue' }).click();
  await walk.getByRole('textbox', { name: 'Amount in euros' }).fill('50');
  await walk.getByRole('button', { name: 'Continue' }).click();
  await walk.locator('.zx-questionnaire__error:not(:empty)').waitFor();
  await walk.getByRole('textbox', { name: 'Amount in euros' }).fill('500');
  await walk.getByRole('button', { name: 'Continue' }).click();
  await walk.getByText('Second reminder', { exact: true }).click();
  await walk.getByRole('button', { name: 'Continue' }).click();
  await walk.getByRole('textbox', { name: 'Email' }).fill('ruth at acme');
  await walk.getByRole('button', { name: 'Review answers' }).click();
  await walk.locator('.zx-questionnaire__error:not(:empty)').waitFor();
  await walk.getByRole('textbox', { name: 'Email' }).fill('ruth@acme.example');
  await walk.getByRole('button', { name: 'Review answers' }).click();
  await shot('dunning-review');
  await walk.getByRole('button', { name: 'Submit' }).click();
  await arrived('Dunning run scheduled');
  await clean('dunning');

  /* 6 · Trend: a choice, then October again as a line chart — its version 2. */
  await suggestion('Show that as a trend');
  await arrived('Which trend should I draw?');
  await shot('trend-choice');
  await latest().getByText('Running total').click();
  await latest().getByRole('button', { name: 'Submit' }).click();
  await arrived('October as a running total');
  if (!(await versionLabel.textContent())?.startsWith('v2 of 2')) throw new Error(`trend: the panel shows ${await versionLabel.textContent()}`);
  await root.locator('.canvas__thread').focus();
  await page.keyboard.press('[');
  if (!(await versionLabel.textContent())?.startsWith('v1 of 2')) throw new Error('trend: [ did not step back to v1');
  await shot('trend-versions');
  await page.keyboard.press(']');
  await clean('trend');

  /* 7 · Old drafts: cancel the typed confirmation once, then type it. */
  await suggestion('Delete the old drafts');
  await arrived('Delete 4 old reminder drafts?');
  await latest().getByRole('button', { name: 'Delete 4 drafts' }).click();
  let typed = page.getByRole('dialog', { name: 'Delete 4 old reminder drafts?' });
  await typed.getByRole('button', { name: 'Cancel' }).click();
  await typed.waitFor({ state: 'hidden' });
  await latest().getByRole('button', { name: 'Delete 4 drafts' }).click();
  typed = page.getByRole('dialog', { name: 'Delete 4 old reminder drafts?' });
  await typed.getByRole('textbox').fill('delete 4 drafts');
  await page.waitForTimeout(350);
  await shot('drafts-typed');
  await typed.getByRole('button', { name: 'Delete 4 drafts' }).click();
  await arrived('4 drafts deleted');
  await clean('drafts');

  /* 8 · Webhook: part of the first surface is refused, the report goes back to the agent, and the
     corrected surface takes the first one's place. */
  await suggestion('Give me the webhook snippet');
  await page.waitForSelector(`${ROOT} .zx-agent-thread__item[data-type="trace"]`, { timeout: 10_000 });
  await shot('webhook-report');
  await arrived('Webhook for paid invoices');
  const report = page.locator(`${ROOT} .zx-agent-thread__item[data-type="trace"]`).last();
  await report.getByText('no problems').waitFor();
  if (!(await versionLabel.textContent())?.startsWith('v2 of 2')) throw new Error('webhook: the corrected surface is not version 2');
  await clean('webhook');
  // The report as the agent received it, then the first attempt in the panel: its JSON without the
  // refused node, and the problems listed.
  await report.getByRole('button', { name: /Showed the webhook snippet/ }).click();
  await openInPanel(latest());
  await page.keyboard.press('[');
  if (!(await versionLabel.textContent())?.startsWith('v1 of 2')) throw new Error('webhook: [ did not step back to the first attempt');
  await panel.getByRole('tab', { name: 'JSON' }).click();
  const problems = await panel.locator('.canvas__problems li').allTextContents();
  if (!problems.length || !problems.every((text) => /unknown-type|missing-node/.test(text))) {
    throw new Error(`webhook: the first attempt reported ${JSON.stringify(problems)}`);
  }
  // The tab's underline settles before the last screenshot.
  await page.waitForTimeout(400);
}
