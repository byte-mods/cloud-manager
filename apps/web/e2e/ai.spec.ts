import { test, expect } from "@playwright/test"

test.describe("AI Module", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("admin@cloudmanager.dev")
    await page.getByLabel("Password").fill("admin123")
    await page.getByRole("button", { name: "Sign In" }).click()
    await page.waitForURL("**/dashboard**", { timeout: 10000 })
  })

  test("should display chat interface", async ({ page }) => {
    await page.goto("/dashboard/ai/chat")
    await expect(page.getByRole("heading", { name: /Chat|Claude|AI/i })).toBeVisible()
  })

  test("should display terminal interface", async ({ page }) => {
    await page.goto("/dashboard/ai/terminal")
    await expect(page.getByRole("heading", { name: /Terminal|CLI/i })).toBeVisible()
  })

  test("should display suggestions page", async ({ page }) => {
    await page.goto("/dashboard/ai/suggestions")
    await expect(page.getByRole("heading", { name: /Suggest/i })).toBeVisible()
  })
})
