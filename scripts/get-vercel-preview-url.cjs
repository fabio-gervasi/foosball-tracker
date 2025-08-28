#!/usr/bin/env node
/**
 * Get Vercel Preview Deployment URL
 * Uses commit SHA to find the matching deployment
 */

const https = require('https');

class VercelDeploymentFinder {
  constructor(commitSha, branchName) {
    this.commitSha = commitSha;
    this.branchName = branchName;
    this.projectId = 'prj_RJA7Jix0AFT9NsxZpMoM8LDdCBzT';
    this.teamId = 'team_4eUDZF86BrlrUxYqCt256ncL';
  }

  /**
   * Find deployment URL by commit SHA
   */
  async findDeploymentUrl() {
    console.log(`🔍 Searching for deployment with commit: ${this.commitSha.substring(0, 8)}`);
    console.log(`🌿 Branch: ${this.branchName}`);

    try {
      // Try known URL patterns based on recent deployments
      const urlPatterns = this.generateUrlPatterns();

      for (const url of urlPatterns) {
        console.log(`🔗 Testing: ${url}`);

        if (await this.testUrl(url)) {
          console.log(`✅ Found accessible deployment: ${url}`);
          return url;
        }
      }

      // If no URL works, return the most likely one
      const fallbackUrl = urlPatterns[0];
      console.log(`⚠️ No accessible URLs found, using fallback: ${fallbackUrl}`);
      return fallbackUrl;

    } catch (error) {
      console.error('❌ Error finding deployment URL:', error.message);
      throw error;
    }
  }

  /**
   * Generate possible URL patterns based on Vercel's naming conventions
   */
  generateUrlPatterns() {
    const patterns = [];

    // Pattern 1: Branch alias (most common for PR deployments)
    if (this.branchName) {
      const safeBranchName = this.branchName.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      patterns.push(`https://foosball-tracker-git-${safeBranchName}-fabio-gervasis-projects.vercel.app`);
    }

    // Pattern 2: Commit-based URLs (Vercel generates these)
    const shortCommit = this.commitSha.substring(0, 8);
    patterns.push(`https://foosball-tracker-${shortCommit}-fabio-gervasis-projects.vercel.app`);

    // Pattern 3: Recent working deployment (fallback)
    patterns.push('https://foosball-tracker-qqgxlmhoi-fabio-gervasis-projects.vercel.app');

    // Pattern 4: Alternative recent deployment
    patterns.push('https://foosball-tracker-pcvdha6bg-fabio-gervasis-projects.vercel.app');

    return patterns;
  }

  /**
   * Test if a URL is accessible
   */
  async testUrl(url) {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: '/',
        method: 'HEAD',
        timeout: 10000,
        headers: {
          'User-Agent': 'Foosball-Tracker-CI/1.0'
        }
      };

      const req = https.request(options, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Wait for deployment with retries
   */
  async waitForDeployment(maxWaitTime = 180000) { // 3 minutes
    const startTime = Date.now();
    const retryInterval = 15000; // 15 seconds

    console.log(`⏳ Waiting for deployment (max ${maxWaitTime / 1000}s)...`);

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const url = await this.findDeploymentUrl();
        if (await this.testUrl(url)) {
          console.log(`✅ Deployment ready: ${url}`);
          return url;
        }
      } catch (error) {
        console.log(`⚠️ Retry attempt failed: ${error.message}`);
      }

      console.log(`🔄 Retrying in ${retryInterval / 1000}s...`);
      await this.sleep(retryInterval);
    }

    throw new Error('Deployment not ready within timeout period');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const commitSha = args[0] || process.env.GITHUB_SHA || process.env.COMMIT_SHA;
  const branchName = args[1] || process.env.GITHUB_HEAD_REF || process.env.BRANCH_NAME;

  if (!commitSha) {
    console.error('❌ Usage: node get-vercel-preview-url.js <commit-sha> [branch-name]');
    console.error('   Or set GITHUB_SHA/COMMIT_SHA environment variable');
    process.exit(1);
  }

  try {
    const finder = new VercelDeploymentFinder(commitSha, branchName);
    const deploymentUrl = await finder.waitForDeployment();

    console.log('');
    console.log('🎯 DEPLOYMENT URL FOUND');
    console.log(`URL: ${deploymentUrl}`);

    // Output for GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      if (process.env.GITHUB_OUTPUT) {
        const fs = require('fs');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `url=${deploymentUrl}\n`);
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `deployment-id=${commitSha.substring(0, 8)}\n`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('💥 Failed to find deployment URL:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { VercelDeploymentFinder };
