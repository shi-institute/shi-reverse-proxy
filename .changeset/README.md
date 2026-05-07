# Changesets

This directory contains pending changesets — descriptions of changes that will be included in the next release.

## Releasing a change

**1. Add a changeset** while working on a branch:

```sh
pnpm changeset
```

The CLI will ask which packages are affected and whether the change is a `patch`, `minor`, or `major` bump. A markdown file is created in this directory and committed with your branch.

**2. Merge to `main`.** The release workflow (`.github/workflows/release.yml`) opens or updates a "chore: release packages" PR that bumps versions and generates `CHANGELOG.md` entries for each affected package.

**3. Merge the release PR.** The workflow tags each bumped package (e.g. `@shi-institute/utils@1.2.0`) and creates a GitHub release with the changelog.

## Version bump guide

| Type    | When to use                                     |
| ------- | ----------------------------------------------- |
| `patch` | Bug fixes, internal refactors, dependency bumps |
| `minor` | New backwards-compatible features               |
| `major` | Breaking API changes                            |
