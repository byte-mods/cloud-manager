import { test, expect } from "@playwright/test"

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("admin@cloudmanager.dev")
    await page.getByLabel("Password").fill("admin123")
    await page.getByRole("button", { name: "Sign In" }).click()
    await page.waitForURL("**/dashboard**", { timeout: 10000 })
  })

  test("should display profile page", async ({ page }) => {
    await page.goto("/dashboard/settings/profile")
    await expect(page.getByRole("heading", { name: /Profile/i })).toBeVisible()
  })

  test("should display API keys page", async ({ page }) => {
    await page.goto("/dashboard/settings/api-keys")
    await expect(page.getByRole("heading", { name: /API Key/i })).toBeVisible()
  })

  test("should display cloud accounts page", async ({ page }) => {
    await page.goto("/dashboard/settings/cloud-accounts")
    await expect(page.getByRole("heading", { name: /Cloud Account/i })).toBeVisible()
  })

  test("should display organization page", async ({ page }) => {
    await page.goto("/dashboard/settings/organization")
    await expect(page.getByRole("heading", { name: /Organization/i })).toBeVisible()
  })

  test("should display notifications settings", async ({ page }) => {
    await page.goto("/dashboard/settings/notifications")
    await expect(page.getByRole("heading", { name: /Notification/i })).toBeVisible()
  })

  test("should display security settings", async ({ page }) => {
    await page.goto("/dashboard/settings/security")
    await expect(page.getByRole("heading", { name: /Security/i })).toBeVisible()
  })
})
