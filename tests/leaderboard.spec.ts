import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal streak score payload that satisfies the Score type used by the UI. */
const MOCK_STREAK_SCORES = [
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    username: 'TestUser1',
    time_ms: null,
    count: 42,
    mode: 'streak',
    created_at: new Date().toISOString(),
  },
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000002',
    username: 'TestUser2',
    time_ms: null,
    count: 35,
    mode: 'streak',
    created_at: new Date().toISOString(),
  },
]

const MOCK_SINGLE_SCORES = [
  {
    id: 'bbbbbbbb-0000-0000-0000-000000000001',
    username: 'FastUser1',
    time_ms: 312,
    count: null,
    mode: 'single',
    created_at: new Date().toISOString(),
  },
]

// ---------------------------------------------------------------------------
// Test 1 – Tab switching: "Dab Rush" tab shows "Dabs / 30s" column header
// ---------------------------------------------------------------------------
test('tab switching: Dab Rush tab shows "Dabs / 30s" column header', async ({ page }) => {
  // Intercept both leaderboard API calls so the table actually renders.
  await page.route('**/api/leaderboard?mode=single**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SINGLE_SCORES) })
  )
  await page.route('**/api/leaderboard?mode=streak**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_STREAK_SCORES) })
  )

  await page.goto('/leaderboard')

  // Default tab is Reflex Dab — "Time (ms)" should be visible first.
  await expect(page.getByRole('columnheader', { name: 'Time (ms)' })).toBeVisible()

  // Switch to Dab Rush tab.
  await page.getByRole('button', { name: /Dab Rush/i }).click()

  // "Dabs / 30s" column header must appear; "Time (ms)" must be gone.
  await expect(page.getByRole('columnheader', { name: 'Dabs / 30s' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Time (ms)' })).not.toBeVisible()
})

// ---------------------------------------------------------------------------
// Test 2 – Period tab: "This Week" — page doesn't crash
// ---------------------------------------------------------------------------
test('period tab: This Week loads without error', async ({ page }) => {
  await page.goto('/leaderboard')

  await page.getByRole('button', { name: 'This Week' }).click()

  // We accept either a loading spinner, data rows, or empty-state message —
  // but NOT an error message.
  const errorMsg = page.getByText(/Failed to load scores/i)
  // Give the fetch a moment to resolve (or show loading).
  await page.waitForTimeout(3000)
  await expect(errorMsg).not.toBeVisible()

  // The leaderboard container itself must still be present.
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
})

// ---------------------------------------------------------------------------
// Test 3 – Period tab: "Today" — page doesn't crash
// ---------------------------------------------------------------------------
test('period tab: Today loads without error', async ({ page }) => {
  await page.goto('/leaderboard')

  await page.getByRole('button', { name: 'Today' }).click()

  const errorMsg = page.getByText(/Failed to load scores/i)
  await page.waitForTimeout(3000)
  await expect(errorMsg).not.toBeVisible()

  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible()
})

// ---------------------------------------------------------------------------
// Test 4 – API contract: GET /api/leaderboard?mode=single → 200 JSON array
// ---------------------------------------------------------------------------
test('API contract: mode=single returns 200 JSON array', async ({ request }) => {
  const response = await request.get('/api/leaderboard?mode=single')

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/application\/json/)

  const body = await response.json()
  expect(Array.isArray(body)).toBe(true)
})

// ---------------------------------------------------------------------------
// Test 5 – API contract: GET /api/leaderboard?mode=streak → 200 JSON array
// ---------------------------------------------------------------------------
test('API contract: mode=streak returns 200 JSON array', async ({ request }) => {
  const response = await request.get('/api/leaderboard?mode=streak')

  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/application\/json/)

  const body = await response.json()
  expect(Array.isArray(body)).toBe(true)
})

// ---------------------------------------------------------------------------
// Test 6 – API contract: invalid mode defaults to single (200 JSON array)
// ---------------------------------------------------------------------------
test('API contract: invalid mode defaults gracefully to 200 JSON array', async ({ request }) => {
  const response = await request.get('/api/leaderboard?mode=invalid')

  // The route handler falls back to 'single' when mode is not 'streak',
  // so the response must still be 200 with a JSON array.
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toMatch(/application\/json/)

  const body = await response.json()
  expect(Array.isArray(body)).toBe(true)
})
