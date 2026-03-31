import { test, expect } from "@playwright/test"

test.describe("Networking Module", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("admin@cloudmanager.dev")
    await page.getByLabel("Password").fill("admin123")
    await page.getByRole("button", { name: "Sign In" }).click()
    await page.waitForURL("**/dashboard**", { timeout: 10000 })
  })

  test("should display VPC list", async ({ page }) => {
    await page.goto("/dashboard/networking/vpc")
    await expect(page.getByRole("heading", { name: /VPC/i })).toBeVisible()
  })

  test("should display transit gateway page", async ({ page }) => {
    await page.goto("/dashboard/networking/transit-gateway")
    await expect(page.getByRole("heading", { name: /Transit Gateway/i })).toBeVisible()
  })

  test("should display direct connect page", async ({ page }) => {
    await page.goto("/dashboard/networking/direct-connect")
    await expect(page.getByRole("heading", { name: /Direct Connect/i })).toBeVisible()
  })

  test("should display endpoints page", async ({ page }) => {
    await page.goto("/dashboard/networking/endpoints")
    await expect(page.getByRole("heading", { name: /VPC Endpoints/i })).toBeVisible()
  })

  test("should display flow logs page", async ({ page }) => {
    await page.goto("/dashboard/networking/flow-logs")
    await expect(page.getByRole("heading", { name: /Flow Logs/i })).toBeVisible()
  })

  test("should display load balancers", async ({ page }) => {
    await page.goto("/dashboard/networking/load-balancers")
    await expect(page.getByRole("heading", { name: /Load Balancer/i })).toBeVisible()
  })

  test("should display DNS page", async ({ page }) => {
    await page.goto("/dashboard/networking/dns")
    await expect(page.getByRole("heading", { name: /DNS/i })).toBeVisible()
  })
})
