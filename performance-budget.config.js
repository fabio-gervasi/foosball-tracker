// Foosball Tracker - Performance Budget Configuration
// REQ-5.2.5: Performance Budget Enforcement
// Performance monitoring and regression prevention

module.exports = {
  // Performance budgets for different routes
  budgets: [
    {
      path: '/',
      timings: [
        // Core Web Vitals thresholds
        { metric: 'first-contentful-paint', budget: 2000 }, // 2 seconds
        { metric: 'largest-contentful-paint', budget: 2500 }, // 2.5 seconds
        { metric: 'cumulative-layout-shift', budget: 0.1 }, // CLS threshold
        { metric: 'time-to-interactive', budget: 3500 }, // 3.5 seconds
        { metric: 'total-blocking-time', budget: 200 }, // 200ms
        { metric: 'speed-index', budget: 3000 } // 3 seconds
      ],
      resourceSizes: [
        // Bundle size limits
        { resourceType: 'script', budget: 400000 }, // 400KB for JS
        { resourceType: 'stylesheet', budget: 50000 }, // 50KB for CSS
        { resourceType: 'image', budget: 200000 }, // 200KB for images
        { resourceType: 'media', budget: 500000 }, // 500KB for media
        { resourceType: 'font', budget: 100000 }, // 100KB for fonts
        { resourceType: 'total', budget: 1000000 } // 1MB total
      ]
    },
    {
      path: '/dashboard',
      timings: [
        // Dashboard may be more complex, slightly relaxed budgets
        { metric: 'first-contentful-paint', budget: 2500 },
        { metric: 'largest-contentful-paint', budget: 3000 },
        { metric: 'cumulative-layout-shift', budget: 0.15 },
        { metric: 'time-to-interactive', budget: 4000 }
      ],
      resourceSizes: [
        { resourceType: 'script', budget: 500000 }, // 500KB for dashboard JS
        { resourceType: 'total', budget: 1200000 } // 1.2MB total for dashboard
      ]
    }
  ],

  // Global performance thresholds
  thresholds: {
    // Performance score thresholds (0-1 scale)
    performance: 0.85, // 85% minimum performance score
    accessibility: 0.90, // 90% minimum accessibility score
    bestPractices: 0.85, // 85% minimum best practices score
    seo: 0.90, // 90% minimum SEO score

    // Network thresholds
    maxResponseTime: 3000, // 3 seconds max response time
    maxErrorRate: 5, // 5% max error rate

    // Bundle analysis thresholds
    maxBundleSize: 1048576, // 1MB max bundle size
    maxChunkSize: 524288, // 512KB max chunk size

    // Core Web Vitals thresholds (matching Google recommendations)
    coreWebVitals: {
      fcp: 1800, // First Contentful Paint - Good: <1.8s
      lcp: 2500, // Largest Contentful Paint - Good: <2.5s
      cls: 0.1, // Cumulative Layout Shift - Good: <0.1
      fid: 100, // First Input Delay - Good: <100ms
      tti: 3800, // Time to Interactive - Good: <3.8s
      tbt: 200 // Total Blocking Time - Good: <200ms
    }
  },

  // CI/CD integration settings
  ci: {
    // Fail build if budgets are exceeded
    failOnBudgetExceeded: false, // Start with warnings, can be made stricter

    // Performance regression detection
    regressionThreshold: 0.1, // 10% performance regression threshold

    // Comparison settings
    compareAgainst: 'baseline', // Compare against baseline or previous deployment

    // Reporting settings
    generateReport: true,
    reportFormat: ['json', 'html'],
    reportPath: 'performance-reports/',

    // Alert settings
    alertOnRegression: true,
    alertChannels: ['github-comment', 'console']
  },

  // Lighthouse configuration
  lighthouse: {
    // Chrome flags for consistent testing
    chromeFlags: [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage'
    ],

    // Network throttling for consistent results
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1
    },

    // Device emulation
    emulatedFormFactor: 'mobile',

    // Number of runs for average
    numberOfRuns: 3,

    // Categories to audit
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
  },

  // Bundle analyzer configuration
  bundleAnalyzer: {
    // Size analysis thresholds
    warnOnLargeChunks: true,
    largeChunkThreshold: 250000, // 250KB

    // Dependency analysis
    analyzeDuplicates: true,
    analyzeUnusedCode: true,

    // Tree shaking analysis
    analyzeTreeShaking: true,

    // Output configuration
    generateReport: true,
    openAnalyzer: false // Don't open browser in CI
  },

  // Development vs Production settings
  environments: {
    development: {
      // More relaxed budgets for development
      budgetMultiplier: 1.5, // 50% more lenient
      enableDetailedLogging: true,
      skipBundleAnalysis: false
    },
    production: {
      // Strict budgets for production
      budgetMultiplier: 1.0,
      enableDetailedLogging: false,
      skipBundleAnalysis: false,
      enforceStrictBudgets: true
    },
    ci: {
      // CI-specific settings
      budgetMultiplier: 1.1, // 10% more lenient for CI variability
      enableDetailedLogging: true,
      skipBundleAnalysis: false,
      generateArtifacts: true
    }
  }
};
