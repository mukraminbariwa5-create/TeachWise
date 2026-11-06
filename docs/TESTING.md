# Testing TeachWise

## API and frontend

From `backend/`, run `composer install` and `php artisan test`. The feature suite uses an in-memory SQLite database and disables live Ollama calls. It does not reset the normal school database. PHP needs the SQLite extensions for tests.

From `app/`, run `npm ci`, `npm run typecheck`, and `npm run build:web`. Both Node and Composer lockfiles are versioned for reproducible installs. GitHub Actions runs the API suite, frontend checks and public-demo container checks.

## Browser checks

Start the local web app on port 8081. Install Playwright separately, for example `npm install --prefix .ui-checks/browser-tools playwright` from the repository root, and install a browser with that package's CLI. Tests use Edge by default; set `UI_BROWSER` to an installed Playwright browser channel as needed. `PLAYWRIGHT_MODULE` can point to the installed package's absolute path.

Run scripts with `node app/scripts/<script>.cjs` from the repository root. Common options:

| Variable | Purpose |
| --- | --- |
| `UI_ORIGIN` | App URL; defaults to `http://localhost:8081` |
| `UI_BROWSER` | Browser channel; defaults to `msedge` |
| `PLAYWRIGHT_MODULE` | Playwright package name or absolute package directory |
| `UI_OUTPUT_DIR` | Override output for scripts that support it; otherwise artifacts use ignored `.ui-checks/` |
| `UI_WIDTHS` | Comma-separated viewport widths for the fixture and route-layout scripts |

Useful checks:

- `verify-ui.cjs`: isolated student rating/review/submission fixtures, drafts, empty/closed periods and bottom-tab navigation.
- `verify-responsive-navigation.cjs`: student navigation without a hamburger, Account settings, phone/tablet resizing and chat composer visibility.
- `verify-screens.cjs`: real demo-account reads across student, teacher, school-admin, dean and owner screens; mobile drawers only for admins/deans. `UI_ROLES` and `UI_ROUTES` narrow the routes. `UI_CONFIGS` accepts a JSON array of `{width, height, dark, lang}` configurations. This script requires a seeded demo API; it does not submit evaluations.
- `verify-admin-responsibilities.cjs`: fixture-based school-admin/dean controls and school-wide identity editing.
- `verify-audit.cjs`, `verify-polish.cjs`, `verify-appearance-focus.cjs`: short screens, long content, recovery, registration, appearance, dialogs and focus behavior.
- `verify-cache-boundaries.cjs`: correct-account restoration and rejection of foreign/legacy cached data.
- `verify-wise.cjs`: fixture-based conversation history, desktop/mobile layout, request recovery and navigation.

Fixture scripts intercept API writes. `verify-real-ui.cjs` is read-only by default; evaluation submission requires both `UI_SUBMIT_TO_COPY=1` and an explicit isolated `UI_ORIGIN`. `verify-assignment-flow.cjs` also requires its separately seeded disposable API; read the assertions at the top before running it. Never enable these write modes against real school accounts.

## Optional live Ollama checks

From `backend/`, run `php vendor/phpunit/phpunit/phpunit tests/Live/WiseLiveTest.php` to exercise the configured model with isolated test storage. Keep Ollama running. These tests are separate from the normal feature suite.

`verify-wise-live.cjs` requires `WISE_ISOLATED_DB=1` and `WISE_TEST_API` pointing to a newly seeded disposable API. It can create/delete chats in that isolated account. It must not target normal school accounts.

Generated screenshots, reports, local database copies, package caches and obsolete design archives stay in ignored `.ui-checks/`. The four current README screenshots stay in `docs/screenshots/`. Browser viewport checks complement physical-device testing; they do not replace Android/iOS acceptance checks.
