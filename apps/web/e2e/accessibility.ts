import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const accessibilityTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

export async function expectNoAutomatedAccessibilityViolations(
  page: Page,
  surface: string,
  options: { exclude?: string[] } = {},
) {
  let builder = new AxeBuilder({ page }).withTags(accessibilityTags);
  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector);
  }
  const result = await builder.analyze();
  const summary = result.violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "unknown"}): ${violation.nodes.length} node(s)`,
    )
    .join("; ");

  expect(
    result.violations,
    `${surface} has automated WCAG/best-practice violations: ${summary || "none"}`,
  ).toEqual([]);
}
