# Changelog

All notable changes to PR Pulse are documented in this file.

---

## [Unreleased] – 2026-03-26

### Features
- **Svelte UI migration** – Replaced the hand-crafted HTML/CSS/JS pages (popup, onboarding, settings) with a fully Svelte-driven generator. Components are now authored as `.svelte` files under `src/`, enabling smaller output, easier templating, and better developer experience.
- **TypeScript rewrite** – Migrated core library files from plain JavaScript (`lib/*.js`, `service-worker.js`) to TypeScript (`.ts`), adding strong type definitions in `lib/types.ts` and a `lib/ui-config.ts` configuration module.
- **Build tooling** – Added Vite (`vite.config.ts`) and Svelte/ESLint configuration (`svelte.config.js`, `eslint.config.js`, `tsconfig.json`) to support the new stack, along with a GitHub Actions workflow (`.github/workflows/pr-check-build.yml`) for automated PR build checks.

---

## [Unreleased] – 2026-03-23

### Features
- **Structured error handling** – Introduced a dedicated `lib/errors.js` module with a typed error hierarchy, replacing ad-hoc error strings throughout the codebase.
- **Dynamic provider registration** – Refactored `lib/provider-manager.js` to support runtime registration of providers, making it easier to add new integrations without modifying the core manager.
- **Settings UI for providers** – Added provider-specific configuration sections to `settings/settings.html` and `settings/settings.js` so users can enable/disable individual providers from the settings page.

---

## [Unreleased] – 2026-02-23

### Other
- **CNAME** – Added a `CNAME` file to configure the custom domain for the project's GitHub Pages site.

---

## [Unreleased] – 2026-02-11

### Bug Fixes
- **GitHub provider robustness** (`#2`) – Added null-safety guards, fixed a JSON parsing edge case, and eliminated redundant API calls in `lib/providers/github-provider.js`.
- **Polling alarm deduplication** – Enhanced `setupPollingAlarm` in `service-worker.js` to check whether an alarm already exists before creating a new one, preventing unnecessary recreation on extension restarts.

---

## [Unreleased] – 2026-01-27

### Bug Fixes
- **Rate-limit avoidance** – Changed the default auto-refresh interval from a faster cadence to every 10 minutes (`lib/storage.js`, `service-worker.js`, `manifest.json`, `onboarding/onboarding.html`) to stay within GitHub API rate limits. Updated the README to document the new default.

---

## [Unreleased] – 2026-01-26

### Bug Fixes
- **Security hardening** (`#1`) – Applied a comprehensive set of security improvements across the extension:
  - XSS prevention via output escaping in popup and onboarding pages.
  - URL validation and sanitization in `lib/utils.js` and `onboarding/onboarding.js`.
  - Input sanitization and safe `parseInt` usage in settings (`settings/settings.js`).
  - Jira URL validation added to the onboarding flow; redundant URL validation removed from the GitHub provider.

### Documentation
- **Project icon in README** – Added the PR Pulse icon to the README header for a more polished project page.

---

## [1.0.0] – 2026-01-25

### Features
- **Initial release** – Implemented the core PR Pulse Chrome extension:
  - `lib/providers/github-provider.js` – Fetches open pull requests and CI check statuses from GitHub.
  - `lib/providers/base-provider.js` – Abstract base class for all providers.
  - `lib/provider-manager.js` – Orchestrates multiple providers and merges results.
  - `lib/storage.js` – Persists user settings (tokens, refresh interval, display mode) via `chrome.storage`.
  - `lib/utils.js` – Shared utility functions (sanitization, URL helpers, etc.).
  - `service-worker.js` – Background service worker that runs polling alarms and sends badge/notification updates.
  - `popup/` – Popup UI (HTML, CSS, JS) showing the live list of pull requests.
  - `settings/` – Settings page (HTML, CSS, JS) for managing tokens and preferences.
  - `onboarding/` – Onboarding wizard (HTML, CSS, JS) guiding new users through first-time setup.
  - `manifest.json` – Chrome extension manifest (Manifest V3).
- **Branding & icons** – Added icon assets (`icons/icon1024.png`, `icon128.png`, `icon48.png`) and wired them into the manifest.
- **Improved check-status logic** – Refined the GitHub provider's algorithm for determining the overall CI status of a PR from individual check runs.
- **Documentation & licensing** – Added `README.md` with full project overview, installation guide, feature list, and configuration reference. Added `LICENSE` (MIT).
