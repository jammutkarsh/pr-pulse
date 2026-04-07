# Changelog

All notable changes to PR Pulse are documented in this file.

---

## [1.1.0] – 2026-03-26

### 2026-03-26 · [`516d63c`](https://github.com/jammutkarsh/pr-pulse/commit/516d63ccb123d828b838ad19f880693ab82549d2)

#### Features
- **Svelte UI migration** – Replaced the hand-crafted HTML/CSS/JS pages (popup, onboarding, settings) with a fully Svelte-driven generator. Components are now authored as `.svelte` files under `src/`, enabling smaller output, easier templating, and better developer experience.
- **TypeScript rewrite** – Migrated core library files from plain JavaScript (`lib/*.js`, `service-worker.js`) to TypeScript (`.ts`), adding strong type definitions in `lib/types.ts` and a `lib/ui-config.ts` configuration module.
- **Build tooling** – Added Vite (`vite.config.ts`) and Svelte/ESLint configuration (`svelte.config.js`, `eslint.config.js`, `tsconfig.json`) to support the new stack, along with a GitHub Actions workflow (`.github/workflows/pr-check-build.yml`) for automated PR build checks.

---

### 2026-03-23 · [`e437918`](https://github.com/jammutkarsh/pr-pulse/commit/e4379183563459c1a65b4e320adf44d79a2a3668)

#### Features
- **Structured error handling** – Introduced a dedicated `lib/errors.js` module with a typed error hierarchy, replacing ad-hoc error strings throughout the codebase.
- **Dynamic provider registration** – Refactored `lib/provider-manager.js` to support runtime registration of providers, making it easier to add new integrations without modifying the core manager.
- **Settings UI for providers** – Added provider-specific configuration sections to `settings/settings.html` and `settings/settings.js` so users can enable/disable individual providers from the settings page.

---

### 2026-02-23 · [`b43d74e`](https://github.com/jammutkarsh/pr-pulse/commit/b43d74e6abb3d64361091e3b27167e4468f168f4)

#### Other
- **CNAME** – Added a `CNAME` file to configure the custom domain for the project's GitHub Pages site.

---

### 2026-02-11

#### Bug Fixes
- **GitHub provider robustness** ([`64ebee6`](https://github.com/jammutkarsh/pr-pulse/commit/64ebee6aeb07bac7cde350fb6e1caf8aff50ef24), `#2`) – Added null-safety guards, fixed a JSON parsing edge case, and eliminated redundant API calls in `lib/providers/github-provider.js`.
- **Polling alarm deduplication** ([`af6c70d`](https://github.com/jammutkarsh/pr-pulse/commit/af6c70d61d72902e2c7a994c7a2745e48d222911)) – Enhanced `setupPollingAlarm` in `service-worker.js` to check whether an alarm already exists before creating a new one, preventing unnecessary recreation on extension restarts.

---

### 2026-01-27 · [`67e6fcd`](https://github.com/jammutkarsh/pr-pulse/commit/67e6fcd74fd92808901f7535ca639e4ae17b78f0)

#### Bug Fixes
- **Rate-limit avoidance** – Changed the default auto-refresh interval from a faster cadence to every 10 minutes (`lib/storage.js`, `service-worker.js`, `manifest.json`, `onboarding/onboarding.html`) to stay within GitHub API rate limits. Updated the README to document the new default.

---

### 2026-01-26

#### Bug Fixes
- **Security hardening** ([`ee7004d`](https://github.com/jammutkarsh/pr-pulse/commit/ee7004d231c74076df05093f38e1e44fd9fa6bb9), `#1`) – Applied a comprehensive set of security improvements across the extension:
  - XSS prevention via output escaping in popup and onboarding pages.
  - URL validation and sanitization in `lib/utils.js` and `onboarding/onboarding.js`.
  - Input sanitization and safe `parseInt` usage in settings (`settings/settings.js`).
  - Jira URL validation added to the onboarding flow; redundant URL validation removed from the GitHub provider.

#### Documentation
- **Project icon in README** ([`a0b6f7c`](https://github.com/jammutkarsh/pr-pulse/commit/a0b6f7c5ad5f6c307ca66018bef7947dbcb4b60f)) – Added the PR Pulse icon to the README header for a more polished project page.

---

## [1.0.0] – 2026-01-25

### 2026-01-25

#### Features
- **Initial release** ([`eb601af`](https://github.com/jammutkarsh/pr-pulse/commit/eb601aff8b480473b546500acdf9732a79827134)) – Implemented the core PR Pulse Chrome extension:
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
- **Branding & icons** ([`db8866f`](https://github.com/jammutkarsh/pr-pulse/commit/db8866f8803057155a2b196ececa4e4abda6491d)) – Added icon assets (`icons/icon1024.png`, `icon128.png`, `icon48.png`) and wired them into the manifest. Refined the GitHub provider's algorithm for determining the overall CI status of a PR from individual check runs.

#### Documentation
- **README & LICENSE** ([`2641091`](https://github.com/jammutkarsh/pr-pulse/commit/2641091e82a8183e6b6fd007c6f511d86b2a847c)) – Added `README.md` with full project overview, installation guide, feature list, and configuration reference. Added `LICENSE` (MIT).
