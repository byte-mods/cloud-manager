import { test, expect } from "@playwright/test"

test.describe("Compute Module", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("admin@cloudmanager.dev")
    await page.getByLabel("Password").fill("admin123")
    await page.getByRole("button", { name: "Sign In" }).click()
    await page.waitForURL("**/dashboard**", { timeout: 10000 })
  })

  test("should display instances list", async ({ page }) => {
    await page.goto("/dashboard/compute/instances")
    await expect(page.getByRole("heading", { name: /Instances/i })).toBeVisible()
  })

  test("should navigate to kubernetes", async ({ page }) => {
    await page.goto("/dashboard/compute/kubernetes")
    await expect(page.getByRole("heading", { name: /Kubernetes/i })).toBeVisible()
  })

  test("should navigate to serverless", async ({ page }) => {
    await page.goto("/dashboard/compute/serverless")
    await expect(page.getByRole("heading", { name: /Serverless|Functions/i })).toBeVisible()
  })

  test("should navigate to containers", async ({ page }) => {
    await page.goto("/dashboard/compute/containers")
    await expect(page.getByRole("heading", { name: /Containers/i })).toBeVisible()
  })

  test("should navigate to batch", async ({ page }) => {
    await page.goto("/dashboard/compute/batch")
    await expect(page.getByRole("heading", { name: /Batch/i })).toBeVisible()
  })
})
