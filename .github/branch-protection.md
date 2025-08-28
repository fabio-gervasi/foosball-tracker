# Foosball Tracker - Branch Protection Configuration
# REQ-5.2.2: Branch Protection Strategy

This document provides the configuration for GitHub branch protection rules that should be applied to the repository.

## Main Branch Protection Rules

### Required Configuration

Apply these settings to the `main` branch in GitHub repository settings:

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "quality-gates",
      "performance-budget",
      "Vercel – foosball-tracker"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": true
  },
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "restrictions": null
}
```

### Manual Setup Instructions

1. **Navigate to Repository Settings**
   - Go to `Settings` > `Branches` in your GitHub repository

2. **Add Branch Protection Rule**
   - Click "Add rule"
   - Branch name pattern: `main`

3. **Configure Protection Settings**
   - ✅ **Require a pull request before merging**
     - Required approving reviews: `1`
     - ✅ Dismiss stale pull request approvals when new commits are pushed
     - ✅ Require review from code owners (if CODEOWNERS file exists)
     - ✅ Require approval of the most recent reviewable push

   - ✅ **Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - Required status checks:
       - `quality-gates` (from CI workflow)
       - `performance-budget` (from CI workflow)
       - `Vercel – foosball-tracker` (Vercel deployment check)

   - ✅ **Require conversation resolution before merging**
   - ✅ **Require signed commits** (optional but recommended)
   - ✅ **Include administrators** (enforce rules for admins)
   - ❌ Allow force pushes
   - ❌ Allow deletions

4. **Save Protection Rule**

## Development Branch Protection Rules

For the `dev` branch (if used), apply similar but slightly more relaxed rules:

```json
{
  "required_status_checks": {
    "strict": false,
    "contexts": [
      "quality-gates"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": false
  },
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

## Status Check Requirements

The following status checks must pass before merging to `main`:

### 1. Quality Gates (`quality-gates`)
- ✅ ESLint validation passes
- ✅ Prettier formatting check passes
- ✅ TypeScript compilation succeeds
- ✅ All tests pass (63+ tests)
- ✅ Security audit passes (no high/critical vulnerabilities)
- ✅ Build completes successfully

### 2. Performance Budget (`performance-budget`)
- ✅ Bundle size within limits (<1MB)
- ✅ Performance budget validation
- ✅ No significant performance regressions

### 3. Vercel Deployment (`Vercel – foosball-tracker`)
- ✅ Preview deployment succeeds
- ✅ Build completes on Vercel
- ✅ No deployment errors

## Pull Request Template

Create `.github/pull_request_template.md`:

```markdown
## 📋 Pull Request Checklist

### Changes Made
- [ ] Describe the changes made in this PR
- [ ] Link to related issues or requirements

### Testing
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing completed
- [ ] Preview deployment tested

### Code Quality
- [ ] Code follows project style guidelines
- [ ] No console.log statements in production code
- [ ] TypeScript types are properly defined
- [ ] Documentation updated if needed

### Performance
- [ ] No significant performance regressions
- [ ] Bundle size impact considered
- [ ] Core Web Vitals maintained

### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented where needed
- [ ] Security headers maintained

### Deployment
- [ ] Changes are backward compatible
- [ ] Database migrations included if needed
- [ ] Environment variables documented if added

### Review Requirements
- [ ] Code has been reviewed by at least one team member
- [ ] All conversations resolved
- [ ] CI checks pass

---
**Deployment Notes:**
<!-- Add any special deployment considerations -->
```

## Enforcement Strategy

### Phase 1: Warning Mode (First 2 weeks)
- Branch protection enabled but not strictly enforced
- Failed checks generate warnings but don't block merges
- Team gets familiar with new process

### Phase 2: Soft Enforcement (Weeks 3-4)
- Most checks required but admins can override
- Focus on education and process refinement
- Monitor for false positives

### Phase 3: Full Enforcement (Week 5+)
- All protection rules strictly enforced
- No admin overrides except for emergencies
- Full CI/CD pipeline operational

## Emergency Procedures

### Emergency Hotfix Process
1. Create hotfix branch from `main`
2. Make minimal necessary changes
3. Create PR with `[HOTFIX]` prefix
4. Expedited review process (can bypass some checks with admin approval)
5. Deploy immediately after merge
6. Follow up with comprehensive testing

### Admin Override Guidelines
Admin overrides should only be used for:
- Critical security fixes
- Production outages requiring immediate fixes
- CI system failures (not code issues)
- Emergency rollbacks

All admin overrides must be:
- Documented in the PR
- Followed up with proper process compliance
- Reviewed in retrospective meetings

## Monitoring and Metrics

Track these metrics to measure branch protection effectiveness:

### Success Metrics
- **PR Merge Success Rate**: >95% of PRs pass all checks
- **Time to Merge**: <24 hours for standard PRs
- **Defect Escape Rate**: <2% of merged PRs require hotfixes
- **CI Reliability**: >98% CI success rate

### Quality Metrics
- **Test Coverage**: Maintain >80% coverage
- **Performance Regressions**: <5% of PRs cause performance issues
- **Security Issues**: 0 critical security issues merged
- **Code Review Coverage**: 100% of PRs reviewed

## Troubleshooting

### Common Issues and Solutions

#### 1. Status Check Not Found
**Problem**: Required status check doesn't appear
**Solution**:
- Ensure workflow runs on PR events
- Check workflow file syntax
- Verify status check names match exactly

#### 2. Tests Failing in CI but Passing Locally
**Problem**: Environment differences causing test failures
**Solution**:
- Check Node.js version consistency
- Verify environment variables
- Review test setup and mocks

#### 3. Performance Budget Failures
**Problem**: Bundle size or performance regressions
**Solution**:
- Analyze bundle size changes
- Check for unnecessary dependencies
- Review code splitting strategy

#### 4. Vercel Deployment Failures
**Problem**: Preview deployments failing
**Solution**:
- Check Vercel configuration
- Verify environment variables
- Review build logs

## Updates and Maintenance

### Monthly Review Process
- Review branch protection effectiveness
- Analyze CI/CD metrics and performance
- Update rules based on team feedback
- Refine automation and thresholds

### Quarterly Updates
- Update required Node.js version
- Review and update dependencies
- Assess new GitHub features
- Update documentation and procedures

---

*This configuration ensures that all code merged to main meets our quality, security, and performance standards while maintaining development velocity.*
