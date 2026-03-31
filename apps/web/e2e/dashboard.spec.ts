import { test, expect } from "@playwright/test"

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("admin@cloudmanager.dev")
    await page.getByLabel("Password").fill("admin123")
    await page.getByRole("button", { name: "Sign In" }).click()
    await page.waitForURL("**/dashboard**", { timeout: 10000 })
  })

  test("should display dashboard layout", async ({ page }) => {
    await expect(page.locator("[data-testid='sidebar'], nav")).toBeVisible()
  })

  test("should navigate to compute instances", async ({ page }) => {
    await page.getByRole("link", { name: /Instances/i }).first().click()
    await expect(page).toHaveURL(/compute\/instances/)
  })

  test("should navigate to storage", async ({ page }) => {
    await page.getByRole("link", { name: /Object Storage/i }).first().click()
    await expect(page).toHaveURL(/storage\/object/)
  })

  test("should navigate to networking", async ({ page }) => {
    await page.getByRole("link", { name: /VPC/i }).first().click()
    await expect(page).toHaveURL(/networking\/vpc/)
  })

  test("should navigate to security", async ({ page }) => {
    await page.getByRole("link", { name: /IAM.*Users|Users/i }).first().click()
    await expect(page).toHaveURL(/security/)
  })

  test("should navigate to cost management", async ({ page }) => {
    await page.getByRole("link", { name: /Cost.*Overview|Overview/i }).first().click()
    await expect(page).toHaveURL(/cost/)
  })

  test("should navigate to monitoring", async ({ page }) => {
    await page.getByRole("link", { name: /Dashboards/i }).first().click()
    await expect(page).toHaveURL(/monitoring/)
  })

  test("should navigate to settings", async ({ page }) => {
    await page.getByRole("link", { name: /Profile/i }).first().click()
    await expect(page).toHaveURL(/settings\/profile/)
  })
})
