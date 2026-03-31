import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible()
    await expect(page.getByLabel("Email")).toBeVisible()
    await expect(page.getByLabel("Password")).toBeVisible()
  })

  test("should show validation errors for empty fields", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page.getByText("Please enter a valid email")).toBeVisible()
  })

  test("should login with demo credentials", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("admin@cloudmanager.dev")
    await page.getByLabel("Password").fill("admin123")
    await page.getByRole("button", { name: "Sign In" }).click()
    await page.waitForURL("**/dashboard**", { timeout: 10000 })
    await expect(page).toHaveURL(/dashboard/)
  })

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill("invalid@test.com")
    await page.getByLabel("Password").fill("wrongpassword")
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page.getByText("Invalid email or password")).toBeVisible()
  })

  test("should navigate to register page", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("link", { name: "Register" }).click()
    await expect(page).toHaveURL(/register/)
  })

  test("should navigate to forgot password", async ({ page }) => {
    await page.goto("/login")
    await page.getByRole("link", { name: "Forgot password?" }).click()
    await expect(page).toHaveURL(/forgot-password/)
  })
})
