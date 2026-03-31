import { test, expect } from "@playwright/test"

test.describe("Cost Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("admin@cloudmanager.dev")
    await page.getByLabel("Password").fill("admin123")
    await page.getByRole("button", { name: "Sign In" }).click()
    await page.waitForURL("**/dashboard**", { timeout: 10000 })
  })

  test("should display cost overview", async ({ page }) => {
    await page.goto("/dashboard/cost")
    await expect(page.getByRole("heading", { name: /Cost/i })).toBeVisible()
  })

  test("should display cost explorer", async ({ page }) => {
    await page.goto("/dashboard/cost/explorer")
    await expect(page.getByRole("heading", { name: /Explorer/i })).toBeVisible()
  })

  test("should display budgets", async ({ page }) => {
    await page.goto("/dashboard/cost/budgets")
    await expect(page.getByRole("heading", { name: /Budget/i })).toBeVisible()
  })

  test("should display recommendations", async ({ page }) => {
    await page.goto("/dashboard/cost/recommendations")
    await expect(page.getByRole("heading", { name: /Recommend/i })).toBeVisible()
  })

  test("should display forecasting", async ({ page }) => {
    await page.goto("/dashboard/cost/forecasting")
    await expect(page.getByRole("heading", { name: /Forecast/i })).toBeVisible()
  })
})
