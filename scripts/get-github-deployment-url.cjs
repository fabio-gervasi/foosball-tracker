#!/usr/bin/env node
/**
 * Get Vercel Deployment URL from GitHub Deployments API
 * This is the most reliable way to get the actual deployment URL
 */

const https = require('https');

class GitHubDeploymentFinder {
  constructor(repoOwner, repoName, githubToken) {
    this.repoOwner = repoOwner;
    this.repoName = repoName;
    this.githubToken = githubToken;
  }

  /**
   * Find the latest deployment URL for a specific commit
   */
  async findDeploymentUrl(commitSha, environment = 'Preview') {
    console.log(`🔍 Searching GitHub deployments for commit: ${commitSha.substring(0, 8)}`);

    try {
      const deployments = await this.fetchDeployments();

      // Find deployment matching our commit and environment
      const matchingDeployment = deployments.find(deployment =>
        deployment.sha === commitSha &&
        (deployment.environment === environment || deployment.environment.includes('preview'))
      );

      if (matchingDeployment) {
        console.log(`✅ Found matching deployment: ${matchingDeployment.id}`);

        // Get deployment statuses to find the Vercel URL
        const statuses = await this.fetchDeploymentStatuses(matchingDeployment.id);

        // Look for successful Vercel deployment status
        const vercelStatus = statuses.find(status =>
          status.state === 'success' &&
          status.target_url &&
          status.target_url.includes('vercel.app')
        );

        if (vercelStatus) {
          console.log(`✅ Found Vercel deployment URL: ${vercelStatus.target_url}`);
          return vercelStatus.target_url;
        }
      }

      // If no exact match, try to find the latest deployment
      const latestDeployment = deployments.find(d => d.environment.includes('preview'));
      if (latestDeployment) {
        console.log(`⚠️ Using latest preview deployment: ${latestDeployment.id}`);
        const statuses = await this.fetchDeploymentStatuses(latestDeployment.id);
        const vercelStatus = statuses.find(status =>
          status.state === 'success' && status.target_url && status.target_url.includes('vercel.app')
        );

        if (vercelStatus) {
          return vercelStatus.target_url;
        }
      }

      throw new Error('No Vercel deployment URL found in GitHub deployments');
    } catch (error) {
      console.error(`❌ Error fetching from GitHub API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch deployments from GitHub API
   */
  async fetchDeployments() {
    const url = `/repos/${this.repoOwner}/${this.repoName}/deployments`;
    const response = await this.makeGitHubRequest(url);
    return JSON.parse(response);
  }

  /**
   * Fetch deployment statuses from GitHub API
   */
  async fetchDeploymentStatuses(deploymentId) {
    const url = `/repos/${this.repoOwner}/${this.repoName}/deployments/${deploymentId}/statuses`;
    const response = await this.makeGitHubRequest(url);
    return JSON.parse(response);
  }

  /**
   * Make authenticated request to GitHub API
   */
  makeGitHubRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
          'Authorization': `token ${this.githubToken}`,
          'User-Agent': 'Foosball-Tracker-CI',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`GitHub API error: ${res.statusCode} ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const commitSha = args[0];
  const repoOwner = args[1];
  const repoName = args[2];
  const githubToken = args[3] || process.env.GITHUB_TOKEN;

  if (!commitSha || !repoOwner || !repoName) {
    console.error('❌ Usage: node get-github-deployment-url.js <commit-sha> <repo-owner> <repo-name> [github-token]');
    console.error('   Example: node get-github-deployment-url.js abc123def fabio-gervasi foosball-tracker');
    console.error('   GitHub token can be provided as argument or GITHUB_TOKEN environment variable');
    process.exit(1);
  }

  if (!githubToken) {
    console.error('❌ GitHub token is required. Set GITHUB_TOKEN environment variable or pass as argument.');
    process.exit(1);
  }

  try {
    const finder = new GitHubDeploymentFinder(repoOwner, repoName, githubToken);
    const url = await finder.findDeploymentUrl(commitSha);

    // Output for GitHub Actions
    console.log(`PREVIEW_URL=${url}`);
    if (process.env.GITHUB_OUTPUT) {
      require('fs').appendFileSync(process.env.GITHUB_OUTPUT, `url=${url}\n`);
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

module.exports = { GitHubDeploymentFinder };
