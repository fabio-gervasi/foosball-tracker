#!/usr/bin/env node
/**
 * Foosball Tracker - Deployment Rollback Automation
 * REQ-5.2.4: Deployment Rollback Strategies
 *
 * Automated rollback procedures with health monitoring and error detection
 * Integrates with Vercel API for deployment management
 */

const https = require('https');
const fs = require('fs');

class DeploymentRollbackManager {
  constructor(options = {}) {
    this.options = {
      vercelToken: process.env.VERCEL_TOKEN,
      projectId: process.env.VERCEL_PROJECT_ID || process.env.PROJECT_ID,
      teamId: process.env.VERCEL_TEAM_ID || process.env.TEAM_ID,
      healthCheckTimeout: 60000, // 1 minute
      rollbackTimeout: 300000, // 5 minutes
      maxRetries: 3,
      healthCheckInterval: 5000, // 5 seconds
      errorThreshold: 5, // 5% error rate
      responseTimeThreshold: 5000, // 5 seconds
      ...options
    };

    if (!this.options.vercelToken) {
      throw new Error('VERCEL_TOKEN environment variable is required');
    }

    this.results = {
      timestamp: new Date().toISOString(),
      action: null,
      success: false,
      deployments: [],
      healthChecks: [],
      rollbackDetails: null,
      errors: []
    };
  }

  /**
   * Monitor deployment health and trigger rollback if needed
   */
  async monitorAndRollback(deploymentUrl, options = {}) {
    const {
      autoRollback = true,
      healthCheckDuration = this.options.healthCheckTimeout,
      rollbackReason = 'health_check_failure'
    } = options;

    console.log(`🔍 Starting deployment health monitoring`);
    console.log(`🌐 Deployment URL: ${deploymentUrl}`);
    console.log(`⏰ Monitor Duration: ${healthCheckDuration / 1000}s`);
    console.log(`🔄 Auto Rollback: ${autoRollback ? 'Enabled' : 'Disabled'}`);
    console.log('');

    try {
      // Get current deployment info
      const currentDeployment = await this.getCurrentDeployment(deploymentUrl);
      console.log(`📦 Current Deployment: ${currentDeployment.uid}`);

      // Monitor deployment health
      const healthStatus = await this.monitorDeploymentHealth(
        deploymentUrl,
        healthCheckDuration
      );

      this.results.action = 'monitor';
      this.results.deployments.push(currentDeployment);

      if (healthStatus.healthy) {
        console.log('✅ Deployment is healthy - no rollback needed');
        this.results.success = true;
        return this.results;
      }

      console.log('❌ Deployment health check failed');
      console.log(`📊 Health Issues: ${healthStatus.issues.join(', ')}`);

      if (!autoRollback) {
        console.log('⚠️  Auto-rollback disabled - manual intervention required');
        this.results.success = false;
        this.results.errors = healthStatus.issues;
        return this.results;
      }

      // Trigger automatic rollback
      console.log('🔄 Triggering automatic rollback...');
      const rollbackResult = await this.performRollback(rollbackReason, healthStatus.issues);

      this.results.action = 'rollback';
      this.results.rollbackDetails = rollbackResult;
      this.results.success = rollbackResult.success;

      return this.results;

    } catch (error) {
      console.error('💥 Deployment monitoring failed:', error.message);
      this.results.errors.push(error.message);
      this.results.success = false;
      throw error;
    }
  }

  /**
   * Perform manual rollback to previous deployment
   */
  async performRollback(reason = 'manual', issues = []) {
    console.log(`🔄 Performing deployment rollback`);
    console.log(`📝 Reason: ${reason}`);
    if (issues.length > 0) {
      console.log(`🚨 Issues: ${issues.join(', ')}`);
    }
    console.log('');

    const rollbackResult = {
      reason,
      issues,
      success: false,
      previousDeployment: null,
      newDeployment: null,
      rollbackTime: Date.now(),
      steps: []
    };

    try {
      // Step 1: Get deployment history
      rollbackResult.steps.push('Fetching deployment history');
      console.log('📜 Fetching deployment history...');
      const deployments = await this.getDeploymentHistory();

      if (deployments.length < 2) {
        throw new Error('No previous deployment found to rollback to');
      }

      // Step 2: Find the last stable deployment
      rollbackResult.steps.push('Finding stable deployment');
      console.log('🔍 Finding last stable deployment...');
      const stableDeployment = await this.findLastStableDeployment(deployments);

      if (!stableDeployment) {
        throw new Error('No stable deployment found to rollback to');
      }

      rollbackResult.previousDeployment = stableDeployment;
      console.log(`📦 Target Deployment: ${stableDeployment.uid} (${stableDeployment.createdAt})`);

      // Step 3: Promote previous deployment to production
      rollbackResult.steps.push('Promoting previous deployment');
      console.log('🚀 Promoting previous deployment to production...');
      const promotionResult = await this.promoteDeployment(stableDeployment.uid);

      rollbackResult.newDeployment = promotionResult;
      console.log(`✅ Deployment promoted successfully`);

      // Step 4: Verify rollback health
      rollbackResult.steps.push('Verifying rollback health');
      console.log('🔍 Verifying rollback health...');
      const rollbackUrl = promotionResult.url || `https://${this.options.projectId}.vercel.app`;

      // Wait a moment for DNS propagation
      await this.sleep(10000);

      const healthCheck = await this.monitorDeploymentHealth(rollbackUrl, 30000);

      if (healthCheck.healthy) {
        rollbackResult.success = true;
        console.log('✅ Rollback completed successfully');
        console.log(`🌐 Production URL: ${rollbackUrl}`);
      } else {
        console.log('⚠️  Rollback completed but health check shows issues');
        console.log(`🚨 New Issues: ${healthCheck.issues.join(', ')}`);
        rollbackResult.success = false;
        rollbackResult.issues.push(...healthCheck.issues);
      }

      // Step 5: Send notifications
      rollbackResult.steps.push('Sending notifications');
      await this.sendRollbackNotification(rollbackResult);

      return rollbackResult;

    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      rollbackResult.success = false;
      rollbackResult.issues.push(error.message);
      rollbackResult.steps.push(`Failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Monitor deployment health over a period of time
   */
  async monitorDeploymentHealth(deploymentUrl, duration) {
    console.log(`🏥 Monitoring deployment health for ${duration / 1000}s...`);

    const healthStatus = {
      healthy: true,
      issues: [],
      checks: [],
      metrics: {
        totalChecks: 0,
        successfulChecks: 0,
        errorCount: 0,
        averageResponseTime: 0,
        maxResponseTime: 0
      }
    };

    const startTime = Date.now();
    const endTime = startTime + duration;
    let totalResponseTime = 0;

    while (Date.now() < endTime) {
      try {
        const checkStart = Date.now();
        const response = await this.performHealthCheck(deploymentUrl);
        const responseTime = Date.now() - checkStart;

        healthStatus.metrics.totalChecks++;
        totalResponseTime += responseTime;
        healthStatus.metrics.maxResponseTime = Math.max(
          healthStatus.metrics.maxResponseTime,
          responseTime
        );

        if (response.healthy) {
          healthStatus.metrics.successfulChecks++;
        } else {
          healthStatus.metrics.errorCount++;
          healthStatus.issues.push(...response.issues);
        }

        healthStatus.checks.push({
          timestamp: new Date().toISOString(),
          responseTime,
          healthy: response.healthy,
          statusCode: response.statusCode,
          issues: response.issues
        });

        // Log progress
        const elapsed = Date.now() - startTime;
        const progress = Math.round((elapsed / duration) * 100);
        process.stdout.write(`\r  📊 Progress: ${progress}% | Checks: ${healthStatus.metrics.totalChecks} | Errors: ${healthStatus.metrics.errorCount}`);

      } catch (error) {
        healthStatus.metrics.totalChecks++;
        healthStatus.metrics.errorCount++;
        healthStatus.issues.push(error.message);

        healthStatus.checks.push({
          timestamp: new Date().toISOString(),
          responseTime: null,
          healthy: false,
          statusCode: null,
          issues: [error.message]
        });
      }

      await this.sleep(this.options.healthCheckInterval);
    }

    console.log(''); // New line after progress indicator

    // Calculate final metrics
    healthStatus.metrics.averageResponseTime = totalResponseTime / healthStatus.metrics.totalChecks;
    const errorRate = (healthStatus.metrics.errorCount / healthStatus.metrics.totalChecks) * 100;

    // Determine overall health
    if (errorRate > this.options.errorThreshold) {
      healthStatus.healthy = false;
      healthStatus.issues.push(`Error rate ${errorRate.toFixed(1)}% exceeds threshold ${this.options.errorThreshold}%`);
    }

    if (healthStatus.metrics.averageResponseTime > this.options.responseTimeThreshold) {
      healthStatus.healthy = false;
      healthStatus.issues.push(`Average response time ${healthStatus.metrics.averageResponseTime.toFixed(0)}ms exceeds threshold ${this.options.responseTimeThreshold}ms`);
    }

    console.log(`📊 Health Check Summary:`);
    console.log(`  Total Checks: ${healthStatus.metrics.totalChecks}`);
    console.log(`  Success Rate: ${((healthStatus.metrics.successfulChecks / healthStatus.metrics.totalChecks) * 100).toFixed(1)}%`);
    console.log(`  Error Rate: ${errorRate.toFixed(1)}%`);
    console.log(`  Avg Response Time: ${healthStatus.metrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`  Max Response Time: ${healthStatus.metrics.maxResponseTime}ms`);

    this.results.healthChecks.push(healthStatus);
    return healthStatus;
  }

  /**
   * Perform a single health check
   */
  async performHealthCheck(url) {
    const healthCheck = {
      healthy: true,
      issues: [],
      statusCode: null,
      responseTime: null
    };

    try {
      const startTime = Date.now();
      const response = await this.makeRequest(url + '/api/health');
      healthCheck.responseTime = Date.now() - startTime;
      healthCheck.statusCode = response.statusCode;

      // Check response status
      if (response.statusCode >= 500) {
        healthCheck.healthy = false;
        healthCheck.issues.push(`Server error: HTTP ${response.statusCode}`);
      } else if (response.statusCode >= 400) {
        healthCheck.healthy = false;
        healthCheck.issues.push(`Client error: HTTP ${response.statusCode}`);
      }

      // Check response time
      if (healthCheck.responseTime > this.options.responseTimeThreshold) {
        healthCheck.healthy = false;
        healthCheck.issues.push(`Slow response: ${healthCheck.responseTime}ms`);
      }

      // Try to parse health check response
      try {
        const healthData = JSON.parse(response.body);
        if (healthData.status !== 'healthy' && healthData.status !== 'ok') {
          healthCheck.healthy = false;
          healthCheck.issues.push(`Health endpoint reports: ${healthData.status}`);
        }
      } catch (parseError) {
        // If not JSON, just check that we got a successful response
        if (response.statusCode !== 200) {
          healthCheck.healthy = false;
          healthCheck.issues.push('Health endpoint not responding correctly');
        }
      }

    } catch (error) {
      healthCheck.healthy = false;
      healthCheck.issues.push(`Health check failed: ${error.message}`);
    }

    return healthCheck;
  }

  /**
   * Get current deployment info
   */
  async getCurrentDeployment(url) {
    // Extract deployment info from URL or use Vercel API
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // If it's a Vercel deployment URL, extract the deployment ID
    if (hostname.includes('.vercel.app')) {
      const deploymentId = hostname.split('.')[0].split('-').pop();
      return {
        uid: deploymentId,
        url: url,
        createdAt: new Date().toISOString()
      };
    }

    // For custom domains, get the current deployment via API
    const deployments = await this.getDeploymentHistory(1);
    return deployments[0] || { uid: 'unknown', url: url, createdAt: new Date().toISOString() };
  }

  /**
   * Get deployment history from Vercel API
   */
  async getDeploymentHistory(limit = 10) {
    if (!this.options.projectId) {
      throw new Error('Project ID is required for deployment history');
    }

    try {
      const response = await this.makeVercelApiRequest(
        `/v6/deployments?projectId=${this.options.projectId}&limit=${limit}`
      );

      if (response.statusCode !== 200) {
        throw new Error(`Failed to fetch deployments: HTTP ${response.statusCode}`);
      }

      const data = JSON.parse(response.body);
      return data.deployments || [];
    } catch (error) {
      console.warn(`⚠️  Could not fetch deployment history: ${error.message}`);
      return [];
    }
  }

  /**
   * Find the last stable deployment
   */
  async findLastStableDeployment(deployments) {
    // Filter for production deployments that are in READY state
    const stableDeployments = deployments.filter(deployment =>
      deployment.state === 'READY' &&
      deployment.target === 'production' &&
      deployment.readyState === 'READY'
    );

    // Return the most recent stable deployment (excluding the current one)
    return stableDeployments[1] || null;
  }

  /**
   * Promote a deployment to production
   */
  async promoteDeployment(deploymentId) {
    console.log(`🚀 Promoting deployment ${deploymentId} to production...`);

    try {
      const response = await this.makeVercelApiRequest(
        `/v13/deployments/${deploymentId}/promote`,
        'POST'
      );

      if (response.statusCode !== 200) {
        throw new Error(`Failed to promote deployment: HTTP ${response.statusCode} - ${response.body}`);
      }

      const result = JSON.parse(response.body);
      console.log(`✅ Deployment promoted successfully`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to promote deployment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send rollback notification
   */
  async sendRollbackNotification(rollbackResult) {
    console.log('📧 Sending rollback notifications...');

    // In a real implementation, this would send notifications via:
    // - Slack webhook
    // - Email
    // - PagerDuty
    // - GitHub issue/comment

    const notification = {
      type: 'deployment_rollback',
      timestamp: new Date().toISOString(),
      success: rollbackResult.success,
      reason: rollbackResult.reason,
      issues: rollbackResult.issues,
      previousDeployment: rollbackResult.previousDeployment?.uid,
      steps: rollbackResult.steps
    };

    // For now, just log the notification
    console.log('📋 Notification Details:');
    console.log(JSON.stringify(notification, null, 2));

    // If running in GitHub Actions, create a workflow summary
    if (process.env.GITHUB_ACTIONS) {
      const summary = this.generateGitHubSummary(rollbackResult);
      console.log('::group::Rollback Summary');
      console.log(summary);
      console.log('::endgroup::');
    }
  }

  /**
   * Generate GitHub Actions workflow summary
   */
  generateGitHubSummary(rollbackResult) {
    let summary = '## 🔄 Deployment Rollback Summary\n\n';

    summary += `**Status:** ${rollbackResult.success ? '✅ Success' : '❌ Failed'}\n`;
    summary += `**Reason:** ${rollbackResult.reason}\n`;
    summary += `**Timestamp:** ${new Date(rollbackResult.rollbackTime).toISOString()}\n\n`;

    if (rollbackResult.previousDeployment) {
      summary += `**Rolled back to:** ${rollbackResult.previousDeployment.uid}\n\n`;
    }

    if (rollbackResult.issues.length > 0) {
      summary += '### 🚨 Issues Detected\n';
      rollbackResult.issues.forEach(issue => {
        summary += `- ${issue}\n`;
      });
      summary += '\n';
    }

    summary += '### 📋 Rollback Steps\n';
    rollbackResult.steps.forEach((step, index) => {
      summary += `${index + 1}. ${step}\n`;
    });

    return summary;
  }

  /**
   * Make HTTP request
   */
  makeRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          'User-Agent': 'Foosball-Tracker-Rollback-Manager/1.0'
        },
        timeout: 30000
      };

      if (data) {
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(data);
      }

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (data) {
        req.write(data);
      }

      req.end();
    });
  }

  /**
   * Make Vercel API request
   */
  makeVercelApiRequest(path, method = 'GET', data = null) {
    const url = `https://api.vercel.com${path}`;
    const headers = {
      'Authorization': `Bearer ${this.options.vercelToken}`,
      'User-Agent': 'Foosball-Tracker-Rollback-Manager/1.0'
    };

    if (this.options.teamId) {
      headers['X-Vercel-Team-Id'] = this.options.teamId;
    }

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
        timeout: 30000
      };

      if (data) {
        const jsonData = JSON.stringify(data);
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(jsonData);
      }

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Vercel API request timeout'));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const deploymentUrl = args[1];

  if (!command || !deploymentUrl) {
    console.error('❌ Usage: node deployment-rollback.js <command> <deployment-url>');
    console.error('');
    console.error('Commands:');
    console.error('  monitor    - Monitor deployment and auto-rollback if unhealthy');
    console.error('  rollback   - Force rollback to previous deployment');
    console.error('  health     - Check deployment health only');
    console.error('');
    console.error('Examples:');
    console.error('  node deployment-rollback.js monitor https://foosball-tracker-abc123.vercel.app');
    console.error('  node deployment-rollback.js rollback https://foosball-tracker-abc123.vercel.app');
    process.exit(1);
  }

  try {
    const manager = new DeploymentRollbackManager();
    let results;

    switch (command) {
      case 'monitor':
        results = await manager.monitorAndRollback(deploymentUrl, { autoRollback: true });
        break;

      case 'rollback':
        results = await manager.performRollback('manual', ['Manual rollback requested']);
        break;

      case 'health':
        const healthStatus = await manager.monitorDeploymentHealth(deploymentUrl, 30000);
        results = { success: healthStatus.healthy, healthStatus };
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    // Output results for GitHub Actions
    if (process.env.GITHUB_ACTIONS) {
      console.log('');
      console.log('::group::Rollback Results JSON');
      console.log(JSON.stringify(results, null, 2));
      console.log('::endgroup::');

      console.log(`::set-output name=success::${results.success}`);
      console.log(`::set-output name=action::${command}`);
    }

    // Exit with appropriate code
    process.exit(results.success ? 0 : 1);
  } catch (error) {
    console.error('💥 Deployment rollback operation failed:', error.message);
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

module.exports = { DeploymentRollbackManager };
