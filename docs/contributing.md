# Contributing Guide

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Run tests: `pnpm test` (frontend) and `cargo test` (backend)
5. Submit a pull request

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/add-transit-gateway` |
| Bug fix | `fix/description` | `fix/vpc-creation-error` |
| Refactor | `refactor/description` | `refactor/cloud-trait-cleanup` |
| Docs | `docs/description` | `docs/api-reference-update` |
| Chore | `chore/description` | `chore/update-dependencies` |

## Commit Messages

Use conventional commits:
```
type(scope): description

feat(compute): add instance resize support
fix(networking): correct VPC CIDR validation
docs(api): update cost API examples
refactor(cloud-service): simplify provider trait
test(auth): add MFA verification tests
```

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Update documentation if adding new APIs or features
- Ensure all CI checks pass before requesting review
- Fill out the PR template with summary and test plan

## Code Standards

### TypeScript (Frontend)
- Strict mode enabled
- Functional components with hooks
- shadcn/ui for all UI primitives
- Zod schemas for form validation
- TanStack Query for API state

### Rust (Backend)
- Rust 2021 edition
- `async`/`await` with tokio runtime
- `anyhow` for error handling in applications
- `thiserror` for library error types
- `serde` for serialization
- Trait-based cloud provider abstraction

### Testing Requirements
- Frontend: Vitest unit tests for hooks, stores, and utilities
- Backend: Integration tests for handlers, unit tests for business logic
- E2E: Playwright tests for critical user flows
- All tests must pass before merge

## Code of Conduct

- Be respectful and constructive in all interactions
- Focus on the code, not the person
- Assume good intentions
- Help others learn and grow

## Reporting Issues

- Use GitHub Issues for bug reports and feature requests
- Include reproduction steps for bugs
- Label issues appropriately (bug, enhancement, documentation)
- Check existing issues before creating duplicates
