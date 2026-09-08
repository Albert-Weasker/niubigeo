# Release layout

This repository separates the open-source product from local validation output.

## Public repository content

- `src/`: product source code.
- `test/`: unit and integration tests that run without private provider results.
- `e2e/`: browser tests and their Playwright configuration.
- `docs/`, `README.md`, and `README.zh-CN.md`: product and contributor documentation.
- `assets/`: public brand and documentation assets.
- `examples/`: public configurations and frozen study manifests. Versioned case exports may contain reviewed public-brand answers and redacted evidence, separately hashed and clearly distinguished from their private raw archives. Never place credentials in manifests.
- `scripts/`: repeatable development, validation, and maintenance commands. Scripts must write run output outside the tracked source tree or under ignored validation paths.

## Local-only validation content

- `validation/`: real-provider responses, raw payloads, run directories, generated reports, screenshots, cost records, and adjudication files.
- `runs/` and `data/`: local audit and product data.
- `test-results/`, `playwright-report/`, `blob-report/`, trace archives, and videos: generated browser-test output.
- `.env` and other environment files: local credentials and configuration.

These paths are ignored by Git and Docker. Public case exports are an explicit allowlist, not a copy of the private validation tree. User projects, conversation files, cost ledgers, and unreviewed Provider payloads remain local.

## Release review rule

Before publishing a release, review the staged file list and the release manifest. Include source, tests, documentation, reviewed assets and safe examples only. Public case evidence and candidate-container screenshots require provenance and a credential/personal-data review. Private project data, unreviewed payloads, account screenshots, keys, cost ledgers and run directories are excluded. Public evidence is never a reason to unignore `validation/` or `data/`.
