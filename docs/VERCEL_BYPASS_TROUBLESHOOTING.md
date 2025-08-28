# Vercel Protection Bypass Troubleshooting Guide

## Current Issue: HTTP 307 Redirect Response

When the E2E tests show:

```
🔐 Preview deployment is protected (HTTP 401)
   Attempting to bypass Vercel deployment protection...
🔑 Using Vercel Protection Bypass Secret
⚠️ Bypass failed (HTTP 307), but deployment exists
   Check VERCEL_AUTOMATION_BYPASS_SECRET configuration
```

The HTTP 307 indicates a redirect response, which suggests the bypass isn't being handled correctly.

## Root Causes & Solutions

### 1. Missing `--location` Flag in curl

**Problem**: HTTP 307 redirects aren't being followed
**Solution**: Added `--location` flag to curl commands to follow redirects

### 2. Incorrect Header/Parameter Order

**Problem**: Vercel expects specific header combinations
**Solution**: Implemented multiple bypass methods:

- **Method 1**: Headers only (recommended)
- **Method 2**: Query parameters
- **Method 3**: Vercel-specific URL pattern

### 3. Secret Format Issues

**Problem**: Bypass secret format might be incorrect
**Solution**: Added validation to check secret starts with `bypass_`

## Updated Implementation

The workflow now tests 3 different bypass methods:

```bash
# Method 1: Headers (recommended by Vercel)
curl -H "x-vercel-protection-bypass: $SECRET" \
     -H "x-vercel-set-bypass-cookie: true" \
     --location "$URL"

# Method 2: Query parameters
curl --location "$URL?x-vercel-protection-bypass=$SECRET&x-vercel-set-bypass-cookie=true"

# Method 3: Vercel-specific order
curl --location "$URL?x-vercel-set-bypass-cookie=true&x-vercel-protection-bypass=$SECRET"
```

## Verification Steps

### 1. Check Secret in Vercel Dashboard

1. Go to **Vercel Project Settings** → **Deployment Protection**
2. Under **Protection Bypass for Automation**:
   - ✅ Feature should be **enabled**
   - ✅ Secret should be **generated** (starts with `bypass_`)
   - ✅ Secret should be **active** (not expired)

### 2. Check GitHub Secrets

1. Go to **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Verify `VERCEL_AUTOMATION_BYPASS_SECRET` exists
3. Value should match the Vercel-generated secret exactly

### 3. Check Deployment Protection Settings

Ensure your Vercel project has deployment protection enabled:

- **Vercel Authentication**: Should be enabled for preview deployments
- **Protection Bypass**: Should be enabled with a valid secret

## Common Issues & Fixes

### Issue: "Secret format may be incorrect"

- **Cause**: Secret doesn't start with `bypass_`
- **Fix**: Regenerate secret in Vercel dashboard, update GitHub secret

### Issue: "All bypass methods failed"

- **Cause**: Secret mismatch or protection not enabled
- **Fix**:
  1. Regenerate secret in Vercel
  2. Update GitHub secret immediately
  3. Redeploy to get new secret in deployment

### Issue: Still getting HTTP 307/401

- **Cause**: Secret not propagated to deployment
- **Fix**:
  1. Make a new commit to trigger fresh deployment
  2. Wait for deployment to complete
  3. Test bypass on the new deployment

## Testing the Fix

The updated workflow provides detailed debugging:

```
🔄 Testing bypass with headers...
   Headers method result: HTTP 307
🔄 Testing bypass with query parameters...
   Query params method result: HTTP 200
✅ Successfully bypassed Vercel protection
🧪 Running E2E tests with bypass URL: https://...
```

## Manual Testing

You can test the bypass manually:

```bash
# Replace with your actual values
SECRET="bypass_abc123..."
URL="https://your-deployment.vercel.app"

# Test headers method
curl -I -H "x-vercel-protection-bypass: $SECRET" \
        -H "x-vercel-set-bypass-cookie: true" \
        --location "$URL"

# Test query parameters method
curl -I --location "$URL?x-vercel-protection-bypass=$SECRET&x-vercel-set-bypass-cookie=true"
```

Expected result: **HTTP 200** instead of **HTTP 401** or **HTTP 307**

## Next Steps

1. **Commit and push** the updated workflow
2. **Create a new PR** or push to existing feature branch
3. **Monitor the E2E test logs** for the detailed bypass testing
4. **Verify** which method works for your setup

The workflow will now provide much more detailed information about which bypass method succeeds, making it easier to troubleshoot any remaining issues.
