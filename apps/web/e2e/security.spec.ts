import { test, expect } from "@playwright/test"

test.describe("Security Module", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("admin@cloudmanager.dev")
    await page.getByLabel("Password").fill("admin123")
    await page.getByRole("button", { name: "Sign In" }).click()
    await page.waitForURL("**/dashboard**", { timeout: 10000 })
  })

  test("should display IAM users", async ({ page }) => {
    await page.goto("/dashboard/security/iam/users")
    await expect(page.getByRole("heading", { name: /Users|IAM/i })).toBeVisible()
  })

  test("should display IAM roles", async ({ page }) => {
    await page.goto("/dashboard/security/iam/roles")
    await expect(page.getByRole("heading", { name: /Roles/i })).toBeVisible()
  })

  test("should display security posture", async ({ page }) => {
    await page.goto("/dashboard/security-testing/posture")
    await expect(page.getByRole("heading", { name: /Posture|Security/i })).toBeVisible()
  })

  test("should display compliance frameworks", async ({ page }) => {
    await page.goto("/dashboard/security-testing/compliance")
    await expect(page.getByRole("heading", { name: /Compliance/i })).toBeVisible()
  })

  test("should display VAPT scanning", async ({ page }) => {
    await page.goto("/dashboard/security-testing/vapt")
    await expect(page.getByRole("heading", { name: /VAPT|Scan/i })).toBeVisible()
  })

  test("should display vulnerability scanner", async ({ page }) => {
    await page.goto("/dashboard/security-testing/vulnerability")
    await expect(page.getByRole("heading", { name: /Vulnerabilit/i })).toBeVisible()
  })
})
