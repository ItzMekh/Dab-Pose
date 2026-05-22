// Mobile preset (lhci calls this `perf`, which simulates mobile 4G).
// Mirrors lhci.config.js but with mobile emulation and a separate outputDir
// so the desktop and mobile artifacts don't overwrite each other.
const DEFAULT_OUT = './perf/runs/round-0/lhci-mobile'

module.exports = {
  ci: {
    collect: {
      url: [
        'https://dabpose.fun/',
        'https://dabpose.fun/leaderboard',
        'https://dabpose.fun/signup',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'perf',
        extraHeaders: process.env.PERF_BYPASS_TOKEN
          ? { 'x-perf-test': process.env.PERF_BYPASS_TOKEN }
          : {},
        skipAudits: ['uses-http2'],
      },
    },
    assert: {
      preset: 'lighthouse:no-pwa',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.90 }],
        'categories:accessibility': ['error', { minScore: 0.90 }],
        'categories:best-practices': ['warn', { minScore: 0.90 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: process.env.LHCI_OUTPUT_DIR || DEFAULT_OUT,
    },
  },
}
