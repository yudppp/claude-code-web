# Release Process

This document describes the process for releasing new versions of claude-code-web.

## Prerequisites

1. You must have write access to the repository
2. You must have an npm account with publish access to `@yudppp2/claude-code-web`
3. Set up the `NPM_TOKEN` secret in GitHub repository settings

## Automatic Release Process (Recommended)

### 1. Version Bump
```bash
# On main branch
git checkout main
git pull origin main

# Use the GitHub Actions workflow
# Go to Actions > Version Bump > Run workflow
# Select version type: patch, minor, major, etc.
```

### 2. Create Release
After the version is bumped and merged:

```bash
# Tag the release
git tag v1.0.1  # Replace with your version
git push origin v1.0.1
```

This will automatically:
- Create a GitHub release with changelog
- Publish to npm

## Manual Release Process

### 1. Version Bump
```bash
# On main branch
npm version patch  # or minor, major
git push origin main --tags
```

### 2. Manual Publish
```bash
npm run build
npm publish --access public
```

## Pre-release Versions

For beta or alpha releases:

```bash
# Beta release
npm version prerelease --preid=beta
git tag v1.0.1-beta.0
git push origin v1.0.1-beta.0

# Alpha release
npm version prerelease --preid=alpha
git tag v1.0.1-alpha.0
git push origin v1.0.1-alpha.0
```

Pre-releases will be published with appropriate npm tags:
- Beta: `npm install @yudppp2/claude-code-web@beta`
- Alpha: `npm install @yudppp2/claude-code-web@alpha`

## Workflow Dispatch

You can also manually trigger a publish through GitHub Actions:

1. Go to Actions > Publish to npm
2. Click "Run workflow"
3. Optionally specify version and tag
4. Click "Run workflow"

## Verifying the Release

After release:

1. Check npm: https://www.npmjs.com/package/@yudppp2/claude-code-web
2. Test installation: `npx @yudppp2/claude-code-web --help`
3. Verify GitHub release page

## Rollback

If something goes wrong:

```bash
# Unpublish a specific version (within 72 hours)
npm unpublish @yudppp2/claude-code-web@1.0.1

# Deprecate a version (recommended over unpublish)
npm deprecate @yudppp2/claude-code-web@1.0.1 "Critical bug, please use 1.0.2"
```