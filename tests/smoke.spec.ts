import { test, expect } from '@playwright/test'

// Test 1: Landing page loads with correct document title and is not blank
test('landing page loads with correct title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Dab Pose — How Fast Can You Dab?')
  // The main heading "DAB POSE" must be visible
  await expect(page.getByRole('heading', { name: /DAB/i })).toBeVisible()
})

// Test 2: Landing page shows mode selection buttons (Reflex Dab + Dab Rush) and the start button
test('landing page shows mode selection and start button', async ({ page }) => {
  await page.goto('/')
  // Both mode cards must be visible
  await expect(page.getByText('Reflex Dab')).toBeVisible()
  await expect(page.getByText('Dab Rush')).toBeVisible()
  // The primary CTA — must be visible but we do NOT click it (would open camera)
  await expect(page.getByRole('button', { name: /Let's Go/i })).toBeVisible()
  // Leaderboard link is also on the landing page
  await expect(page.getByRole('link', { name: /Leaderboard/i })).toBeVisible()
})

// Test 3: /leaderboard page loads without error and shows core content
test('leaderboard page loads and shows content', async ({ page }) => {
  await page.goto('/leaderboard')
  await expect(page).toHaveTitle('Leaderboard — Dab Pose')
  // Main heading
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
  // Mode tabs
  await expect(page.getByRole('button', { name: /Reflex Dab/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Dab Rush/i })).toBeVisible()
  // Period tabs
  await expect(page.getByRole('button', { name: 'All Time' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'This Week' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible()
})

// Test 4: /leaderboard has a "Play Now" link back to home
test('leaderboard has Play Now link back to home', async ({ page }) => {
  await page.goto('/leaderboard')
  const playNow = page.getByRole('link', { name: /Play Now/i })
  await expect(playNow).toBeVisible()
  // Verify it points to the root
  await expect(playNow).toHaveAttribute('href', '/')
})
