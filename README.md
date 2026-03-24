# amarsia-sdk Monorepo

Monorepo for Amarsia npm packages.

## Packages

- `@amarsia/sdk`: Core SDK package template for Node and JavaScript/TypeScript runtimes.
- `@amarsia/react`: React and Next.js wrapper package template that depends on `@amarsia/sdk`.

## Repository Structure

```text
.
├── packages/
│   ├── sdk/
│   └── react/
├── .changeset/
└── .github/workflows/
```

## Workspace Scripts

- `npm run lint`: Run ESLint across the monorepo.
- `npm run lint:fix`: Run ESLint with automatic fixes.
- `npm run build`: Build all workspace packages.
- `npm run typecheck`: Type check all workspace packages.
- `npm run changeset`: Create a release changeset.
- `npm run version-packages`: Apply changeset-driven version bumps/changelogs.
- `npm run release`: Build and publish changed packages via Changesets.

## Release and Publishing

This monorepo uses [Changesets](https://github.com/changesets/changesets) with GitHub Actions:

1. Add a changeset in your PR (`npm run changeset`).
2. Merge the PR into `main`.
3. Release workflow creates or updates a Version Packages PR.
4. After merging that PR, Changesets publishes only packages that changed.

## Required GitHub Secret

- `NPM_TOKEN`: npm automation token with publish access for `@amarsia/*` packages.
