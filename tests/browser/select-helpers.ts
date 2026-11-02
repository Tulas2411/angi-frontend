import { expect, type Locator } from "@playwright/test";

/**
 * Chooses an option of a shadcn Select (`SelectField`) by its value: opens the list from its
 * trigger and clicks the option, which carries the real value in `data-value`.
 */
export async function chooseOption(trigger: Locator, value: string) {
  await trigger.click();
  const option = trigger
    .page()
    .locator(`[role="option"][data-value="${value}"]`);
  await option.click();
  await expect(option).toHaveCount(0);
}

/** The value a `SelectField` holds, read from its trigger. */
export async function expectOption(trigger: Locator, value: string) {
  await expect(trigger).toHaveAttribute("data-value", value);
}
