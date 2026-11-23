import assert from "node:assert/strict";
import fs from "node:fs";
import type { openBrowser } from "@remotion/renderer";
import { rawProject, type Project } from "../src/domain.ts";
import { withTimingBaseline } from "../src/timing/timing.ts";
type Page = Awaited<
  ReturnType<Awaited<ReturnType<typeof openBrowser>>["newPage"]>
>;
type Helpers = {
  click: (text: string) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  read: () => Promise<Project>;
  upload: (name: string, source: string) => Promise<void>;
};
export async function lyricsGrouping(
  page: Page,
  { click, fill, read, upload }: Helpers,
) {
  const output = "output/playwright/lyrics-grouping";
  fs.mkdirSync(output, { recursive: true });
  await page.setViewport({ width: 1640, height: 1200, deviceScaleFactor: 1 });
  const wait = async (
    description: string,
    predicate: () => Promise<boolean>,
  ) => {
    const end = Date.now() + 15000;
    while (Date.now() < end) {
      if (await predicate()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error(`Timed out: ${description}`);
  };
  const p = rawProject(
    "你\n我\n他\n她\n它\n你们\n我们\n他们",
    "Grouping",
    "Test",
  );
  p.occurrences = p.occurrences.map((cue, i) => ({
    ...cue,
    startMs: i === 7 ? null : i * 1500,
    endMs: i === 7 ? null : i * 1500 + 800,
  }));
  const fixture = withTimingBaseline(p);
  await upload("grouping.json", JSON.stringify(fixture));
  await click("Timing");
  const select = async (selector: string, value: string) => {
    await page.evaluate(
      (selector, value) => {
        const field = document.querySelector<HTMLSelectElement>(selector)!;
        field.value = value;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      },
      selector,
      value,
    );
    await new Promise((r) => setTimeout(r, 100));
  };
  await select('[aria-label="Timeline zoom"]', "1");
  await select('[aria-label="Timing snap"]', "off");
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLButtonElement>("[data-occurrence]")[1]
      .click(),
  );
  await click("+ Group");
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector(".range-selected")
        ?.getAttribute("data-occurrence"),
    ),
    p.occurrences[1].id,
  );
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector(".range-selected .range-boundary")
        ?.textContent?.includes("First lyric"),
    ),
  );

  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLButtonElement>("[data-occurrence]")[1]
      .click(),
  );
  await wait(
    "first range endpoint",
    async () =>
      await page.evaluate(
        () => document.querySelectorAll(".range-selected").length === 1,
      ),
  );
  const rowHeights = await page.evaluate(() =>
    [...document.querySelectorAll("[data-occurrence]")].map(
      (el) => el.getBoundingClientRect().height,
    ),
  );
  await page.evaluate(() =>
    document
      .querySelectorAll("[data-occurrence]")[4]
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll("[data-occurrence]")].map(
        (el) => el.getBoundingClientRect().height,
      ),
    ),
    rowHeights,
    "Boundary preview does not resize rows",
  );
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLButtonElement>("[data-occurrence]")[4]
      .click(),
  );
  await wait(
    "range preview",
    async () =>
      await page.evaluate(
        () => document.querySelectorAll(".range-selected").length === 4,
      ),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".range-selected").length,
    ),
    4,
  );
  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll(".group-range-actions button")].map((el) => ({
      text: el.textContent!.trim(),
      height: el.getBoundingClientRect().height,
      top: el.getBoundingClientRect().top,
    })),
  );
  assert.deepEqual(
    buttons.map((button) => button.text),
    ["Cancel", "Adjust range", "Create"],
  );
  assert.equal(new Set(buttons.map((button) => button.height)).size, 1);
  assert.equal(new Set(buttons.map((button) => button.top)).size, 1);
  const rangeShot = await page
    ._client()
    .send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(
    `${output}/group-range-form.png`,
    Buffer.from(rangeShot.value.data, "base64"),
  );
  const formHeight = await page.evaluate(
    () =>
      document.querySelector(".group-range-form")!.getBoundingClientRect()
        .height,
  );
  await page.evaluate(() =>
    document
      .querySelectorAll("[data-occurrence]")[6]
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".range-selected").length,
    ),
    4,
    "Endpoint click freezes hover preview",
  );
  await click("Adjust range");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector(".group-range-form")!.getBoundingClientRect()
          .height,
    ),
    formHeight,
    "Status transitions preserve form height",
  );
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLButtonElement>("[data-occurrence]")[4]
      .click(),
  );
  await fill(".group-range-form input", "Verse");
  await click("Create");
  const grouped = await read();
  assert.equal(grouped.lyricGroups!.length, 1);
  const group = grouped.lyricGroups![0],
    ids = group.occurrenceIds;
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".spec-lyric-group").length,
    ),
    1,
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll(
          ".timing-occurrence-list > button[data-occurrence]",
        ).length,
    ),
    4,
  );
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".group-header-toggle")!.click(),
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll(".spec-lyric-group [data-occurrence]").length,
    ),
    0,
  );
  await page.evaluate(() =>
    document.querySelector<HTMLButtonElement>(".group-header-toggle")!.click(),
  );
  const client = page._client() as unknown as {
    send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
  };
  const screenshot = async (name: string) => {
    const shot = await page
      ._client()
      .send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      `${output}/${name}.png`,
      Buffer.from(shot.value.data, "base64"),
    );
  };
  assert.ok(
    await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          ".timing-occurrence-list [data-occurrence], .spec-group-header button",
        ),
      ].every(
        (element) =>
          !element.draggable && getComputedStyle(element).cursor !== "grab",
      ),
    ),
  );
  const menu = async () => {
    await page.evaluate(() =>
      document.querySelector<HTMLButtonElement>(".group-menu-trigger")!.click(),
    );
  };
  assert.equal(
    await page.evaluate(() =>
      document
        .querySelector(".group-summary")!
        .matches('button,[role="button"]'),
    ),
    false,
  );
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.querySelector(".group-summary")!).cursor,
    ),
    "pointer",
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[data-occurrence="line-0"]')!
      .click(),
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelectorAll(".spec-lyric-group.group-selected").length,
    ),
    0,
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[data-occurrence="line-2"]')!
      .click(),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".group-member-selected").length,
    ),
    4,
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        '[data-cue="line-0"] .timing-block-label',
      )!
      .click(),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".group-member-selected").length,
    ),
    0,
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        '[data-cue="line-1"] .timing-block-label',
      )!
      .click(),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".group-member-selected").length,
    ),
    4,
  );
  await menu();
  const beforeHover = await page.evaluate(
    () =>
      getComputedStyle(document.querySelectorAll('[role="menuitem"]')[1])
        .backgroundColor,
  );
  const hover = await page.evaluate(() => {
    const rect = document
      .querySelectorAll('[role="menuitem"]')[1]
      .getBoundingClientRect();
    return { x: rect.left + 10, y: rect.top + 10 };
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    ...hover,
  });
  await wait(
    "menu hover",
    async () =>
      await page.evaluate(
        (previous) =>
          getComputedStyle(document.querySelectorAll('[role="menuitem"]')[1])
            .backgroundColor !== previous,
        beforeHover,
      ),
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector(".group-menu-trigger")!.textContent,
    ),
    "…",
  );
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll('[role="menuitem"]')].map(
        (item) => item.textContent,
      ),
    ),
    ["Duplicate…", "Rename…", "Ungroup", "Delete group"],
  );
  await screenshot("group-menu-hover");
  await click("Rename…");
  const alignment = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        ".group-action-dialog h2,.group-action-dialog label,.group-action-dialog .remove-dialog-actions",
      ),
    ].map((element) => element.getBoundingClientRect().left),
  );
  assert.ok(Math.max(...alignment) - Math.min(...alignment) < 1);
  await screenshot("rename-dialog");
  await fill("dialog input", "Chorus A");
  await click("Save name");
  assert.equal((await read()).lyricGroups![0].id, group.id);
  assert.equal((await read()).lyricGroups![0].name, "Chorus A");
  assert.deepEqual((await read()).occurrences, grouped.occurrences);
  await screenshot("mixed-sidebar");
  const drag = async (selector: string, delta: number) => {
    await page.evaluate(
      (selector) =>
        document.querySelector<HTMLElement>(selector)!.scrollIntoView({
          block: "center",
          inline: "center",
          behavior: "instant",
        }),
      selector,
    );
    const geometry = await page.evaluate(
      (selector, delta) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        const width = document
          .querySelector(".timing-track")!
          .getBoundingClientRect().width;
        const time = Number(
          document
            .querySelector('[aria-label="Timeline seek"]')!
            .getAttribute("aria-valuemax"),
        );
        return {
          x: rect.left + Math.min(12, rect.width / 2),
          y: rect.top + rect.height / 2,
          dx: (delta / time) * width,
        };
      },
      selector,
      delta,
    );
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: geometry.x,
      y: geometry.y,
    });
    await client.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: geometry.x,
      y: geometry.y,
      button: "left",
      clickCount: 1,
    });
    const beforeTops = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".timing-block[data-cue]")]
        .map((element) => [element.dataset.cue, element.style.top])
        .sort(),
    );
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: geometry.x + geometry.dx,
      y: geometry.y,
      button: "left",
      buttons: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(
      await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>(".timing-block[data-cue]")]
          .map((element) => [element.dataset.cue, element.style.top])
          .sort(),
      ),
      beforeTops,
      "Dragging must freeze every row",
    );
    if (selector.includes("data-rail") && !selector.includes("ghost"))
      await screenshot("group-dragging");
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: geometry.x + geometry.dx,
      y: geometry.y,
      button: "left",
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 150));
  };
  const handle = `[data-rail="${group.id}"] button`;
  const beforeMove = await read();
  await drag(handle, 10000);
  await wait(
    "group committed",
    async () =>
      (await read()).occurrences.find((cue) => cue.id === ids[0])!.startMs ===
      11500,
  );
  for (const id of ids) {
    const old = beforeMove.occurrences.find((cue) => cue.id === id)!,
      next = (await read()).occurrences.find((cue) => cue.id === id)!;
    assert.equal(next.startMs, old.startMs! + 10000);
    assert.equal(next.endMs, old.endMs! + 10000);
  }
  await click("Undo");
  assert.deepEqual(await read(), beforeMove);
  const originalTops = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".timing-block[data-cue]")]
      .map((element) => [element.dataset.cue, element.style.top])
      .sort(),
  );
  await drag(`[data-cue="${ids[1]}"] .timing-block-label`, -1500);
  assert.notDeepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".timing-block[data-cue]")]
        .map((element) => [element.dataset.cue, element.style.top])
        .sort(),
    ),
    originalTops,
  );
  await click("Undo");
  assert.deepEqual(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".timing-block[data-cue]")]
        .map((element) => [element.dataset.cue, element.style.top])
        .sort(),
    ),
    originalTops,
  );
  // A member edit is independent and recomputes group geometry/interleaving.
  await drag(`[data-cue="${ids[1]}"] .timing-block-label`, 7000);
  const memberEdit = await read();
  for (const id of ids.filter((id) => id !== ids[1]))
    assert.deepEqual(
      memberEdit.occurrences.find((cue) => cue.id === id),
      beforeMove.occurrences.find((cue) => cue.id === id),
    );
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector(".group-warning-indicator")!
        .getAttribute("aria-label")!
        .includes("interleaving"),
    ),
  );
  await click("Undo");
  // Whole group movement onto existing content is a valid draft.
  await drag(handle, -1500);
  assert.equal(
    (await read()).occurrences.find((cue) => cue.id === ids[0])!.startMs,
    0,
  );
  assert.ok(
    await page.evaluate(() =>
      document
        .querySelector(".group-warning-indicator")!
        .getAttribute("aria-label")!
        .includes("Warning: overlap"),
    ),
  );
  await click("Undo");
  assert.ok(
    await page.evaluate(
      () =>
        document.querySelector(".group-header-toggle .group-summary")
          ?.tagName === "SPAN",
    ),
  );
  const stable = await read();
  await menu();
  await click("Duplicate…");
  await wait(
    "ghost",
    async () =>
      await page.evaluate(
        () => !!document.querySelector('[data-rail="ghost"] button'),
      ),
  );
  assert.deepEqual(await read(), stable);
  const ghostLeft = await page.evaluate(() =>
    document.querySelector('[data-rail="ghost"]')!.getAttribute("style"),
  );
  // Moving the mouse does not move the stationary ghost.
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: 1000,
    y: 400,
  });
  assert.equal(
    await page.evaluate(() =>
      document.querySelector('[data-rail="ghost"]')!.getAttribute("style"),
    ),
    ghostLeft,
  );
  assert.ok(
    await page.evaluate(() =>
      [
        "main > header",
        ".timing-transport",
        ".timing-board-toolbar",
        ".group-sidebar-wrapper",
        ".timing-inspector",
      ].every(
        (selector) => document.querySelector<HTMLElement>(selector)!.inert,
      ),
    ),
  );
  assert.ok(
    await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          ".timing-block:not(.group-ghost)",
        ),
      ].every((element) => element.inert),
    ),
  );
  await drag('[data-rail="ghost"] button', -2000);
  assert.deepEqual(await read(), stable);
  await fill(".duplicate-group-panel input", "Temporary name");
  await screenshot("duplicate-preview");
  await click("Cancel");
  assert.deepEqual(await read(), stable);
  assert.equal(
    await page.evaluate(
      () => document.querySelector<HTMLElement>("main > header")!.inert,
    ),
    false,
  );
  await menu();
  await click("Duplicate…");
  await drag('[data-rail="ghost"] button', -5800);
  await fill(".duplicate-group-panel input", "Chorus B");
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector<HTMLButtonElement>(
          ".duplicate-group-panel .actions button",
        )!.disabled,
    ),
    false,
  );
  await click("Create copy");
  const copied = await read();
  assert.equal(copied.lyricGroups!.length, 2);
  assert.equal(copied.occurrences.length, 12);
  const copy = copied.lyricGroups!.find((g) => g.id !== group.id)!;
  assert.equal(copy.name, "Chorus B");
  assert.ok(
    copy.occurrenceIds.every(
      (id) => !stable.occurrences.some((cue) => cue.id === id),
    ),
  );
  const deltas = copy.occurrenceIds.map(
    (id, i) =>
      copied.occurrences.find((cue) => cue.id === id)!.startMs! -
      stable.occurrences.find((cue) => cue.id === ids[i])!.startMs!,
  );
  assert.ok(deltas.every((delta) => delta === deltas[0]));
  assert.ok(
    await page.evaluate(
      (id) =>
        document
          .querySelector(`[data-group="${id}"]`)!
          .classList.contains("group-selected"),
      copy.id,
    ),
  );
  await click("Undo");
  assert.deepEqual(await read(), stable);
  await menu();
  await click("Duplicate…");
  await fill(".duplicate-group-panel input", "Escape name");
  await page.evaluate(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  assert.deepEqual(await read(), stable);
  assert.equal(
    await page.evaluate(
      () => !!document.querySelector(".duplicate-group-panel"),
    ),
    false,
  );
  await menu();
  await click("Ungroup");
  assert.equal((await read()).lyricGroups!.length, 0);
  assert.deepEqual((await read()).occurrences, stable.occurrences);
  await click("Undo");
  await menu();
  await click("Delete group");
  await click("Cancel");
  assert.deepEqual(await read(), stable);
  await menu();
  await click("Delete group");
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('dialog button:not([type="button"])')!
      .click(),
  );
  assert.equal((await read()).occurrences.length, 4);
  await click("Lyric editor");
  assert.equal(
    await page.evaluate(() =>
      [...document.querySelectorAll("button")].some(
        (button) => button.textContent === "Mark phrase reviewed",
      ),
    ),
    true,
    "deleting the selected group keeps a surviving phrase open",
  );
  await click("Timing");
  await click("Undo");
  assert.deepEqual(await read(), stable);
  // Untimed group uses the same confirmation UI without a ghost handle.
  const untimed = {
    ...fixture,
    occurrences: fixture.occurrences.map((cue) => ({
      ...cue,
      startMs: null,
      endMs: null,
    })),
    lyricGroups: [{ ...group, name: "Untimed" }],
  };
  await upload("untimed.json", JSON.stringify(untimed));
  await click("Timing");
  await menu();
  await click("Duplicate…");
  assert.equal(
    await page.evaluate(() => !!document.querySelector('[data-rail="ghost"]')),
    false,
  );
  await click("Create copy");
  assert.equal((await read()).occurrences.length, 12);
  assert.ok(
    (await read()).occurrences.every(
      (cue) => cue.startMs === null && cue.endMs === null,
    ),
  );
  await upload("saved-groups.json", JSON.stringify(stable));
  assert.deepEqual(await read(), stable);
  await click("Timing");
  assert.equal(
    await page.evaluate(
      () => document.querySelectorAll(".spec-lyric-group").length,
    ),
    1,
  );
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>('[data-occurrence="line-0"]')!
      .click(),
  );
  await click("Repeat");
  await click("Add repeat");
  const withRepeat = await read(),
    repeated = withRepeat.occurrences[1];
  assert.notEqual(repeated.id, stable.occurrences[0].id);
  assert.equal(repeated.startMs, stable.occurrences[0].startMs);
  assert.equal(repeated.endMs, stable.occurrences[0].endMs);
  assert.ok(
    await page.evaluate(
      (id) => !!document.querySelector(`[data-cue="${id}"]`),
      repeated.id,
    ),
  );
  assert.ok(
    await page.evaluate(
      (id) =>
        document
          .querySelector(`[data-occurrence="${id}"]`)!
          .textContent!.includes("Warning: overlap"),
      repeated.id,
    ),
  );
  await click("Undo");
  assert.deepEqual(await read(), stable);
  // Overlapping group ranges exercise both axes of selection reveal.
  const crowded = rawProject(
    Array.from({ length: 24 }, (_, i) => `你${i}`).join("\n"),
    "Crowded",
    "Test",
  );
  crowded.occurrences = crowded.occurrences.map((cue, i) => ({
    ...cue,
    startMs: 1000 + (i % 3) * 200,
    endMs: 1800 + (i % 3) * 200,
  }));
  crowded.lyricGroups = Array.from({ length: 8 }, (_, i) => ({
    id: `group-${i}`,
    name: `Chorus ${i + 1}`,
    occurrenceIds: crowded.occurrences
      .slice(i * 3, i * 3 + 3)
      .map((cue) => cue.id),
  }));
  await upload("crowded.json", JSON.stringify(crowded));
  await click("Timing");
  const lastId = crowded.occurrences.at(-1)!.id;
  await page.evaluate(
    (id) =>
      document
        .querySelector<HTMLButtonElement>(`[data-occurrence="${id}"]`)!
        .click(),
    lastId,
  );
  await wait("selected block revealed vertically", () =>
    page.evaluate((id) => {
      const panel = document.querySelector<HTMLElement>(".timing-scroll")!;
      const rect = document
        .querySelector(`[data-cue="${id}"]`)!
        .getBoundingClientRect();
      const viewport = panel.getBoundingClientRect();
      return (
        panel.scrollTop > 0 &&
        rect.top >= viewport.top &&
        rect.bottom <= viewport.bottom
      );
    }, lastId),
  );
  await page.evaluate(() =>
    document.querySelector<HTMLElement>(".group-warning-indicator")!.focus(),
  );
  await wait("custom warning tooltip", () =>
    page.evaluate(() => !!document.querySelector(".group-warning-bubble")),
  );
  const warning = await page.evaluate(() => ({
    text: document.querySelector(".group-warning-bubble")!.textContent!,
    native: document
      .querySelector(".group-warning-indicator")!
      .hasAttribute("title"),
  }));
  assert.equal(warning.native, false);
  assert.equal(warning.text.match(/Warning:/g)?.length, 1);
  assert.ok(warning.text.includes("overlap"));
  await screenshot("crowded-selection-and-tooltip");
  const beforeCrowdedCopy = await read();
  await page.evaluate(() =>
    document
      .querySelectorAll<HTMLButtonElement>(".group-menu-trigger")[7]
      .click(),
  );
  await click("Duplicate…");
  await wait("ghost handle revealed in tall timeline", () =>
    page.evaluate(() => {
      const panel = document
        .querySelector(".timing-scroll")!
        .getBoundingClientRect();
      const lastGhost = document.querySelectorAll(".group-ghost");
      const bottom =
        lastGhost[lastGhost.length - 1].getBoundingClientRect().bottom;
      const handle = document
        .querySelector('[data-rail="ghost"] button')!
        .getBoundingClientRect();
      return (
        handle.top >= Math.max(panel.top, 78) &&
        handle.bottom <= Math.min(panel.bottom, innerHeight) &&
        handle.left >= panel.left &&
        handle.right <= panel.right &&
        bottom <= Math.min(panel.bottom, innerHeight)
      );
    }),
  );
  await screenshot("crowded-duplicate-revealed");
  await click("Cancel");
  assert.deepEqual(await read(), beforeCrowdedCopy);
  fs.writeFileSync(
    `${output}/result.json`,
    JSON.stringify(
      {
        passed: true,
        checks: [
          "mixed units",
          "range creation",
          "collapse",
          "rename",
          "menu",
          "exact group drag",
          "independent member edit",
          "overlap",
          "stationary ghost",
          "editing lock",
          "ghost drag",
          "cancel",
          "confirm",
          "IDs",
          "offsets",
          "selection",
          "Escape",
          "ungroup",
          "delete",
          "Undo",
          "untimed copy",
        ],
      },
      null,
      2,
    ),
  );
}
