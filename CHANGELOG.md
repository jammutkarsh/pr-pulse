# Changelog

All notable changes to PR Pulse are documented in this file.

## [2.2.0] – 2026-08-26

- **Desktop notifications**: PR Pulse now tells you when something changes between polls — a review requested of you, an approval or requested changes on your PR, CI failing or recovering, and PRs that are no longer open. Several changes of the same kind in one refresh collapse into a single line rather than a stack. Clicking a notification opens the relevant PR (or the deep link to the first unresolved thread, when changes were requested).
- **Notifications are opt-in**: Granted as an optional permission from the popup, onboarding, or Settings, so an update never disables the extension pending re-approval. A "Send test notification" button verifies the whole path end to end.
- **Find shortcut**: <kbd>Cmd/Ctrl</kbd>+<kbd>F</kbd> opens search and filters in the popup.

## [2.1.0] – 2026-08-22

- **Code Quality & Architecture**: Extracted the popup's non-visual state (bootstrap order, filter restore/commit, new-PR counting) into a testable `popup-session` module, so the popup shell only owns surface UI state. Unified token intake across onboarding and settings in `github-connect` — one validation path, one commit order (`connectGithubToken` + `commitProvider`) — and split token-expiry refresh into its own `refreshTokenExpiration` path so a failed refresh no longer looks like a failed connection. Badge count now syncs through a storage watcher in the service worker instead of the popup pushing `UPDATE_BADGE_COUNT` messages. Added test suites for popup-session, pr-view, storage, and jira. No user-facing change.

## [2.0.0] – 2026-08-21

- **GraphQL Migration**: Migrated GitHub data fetching from REST API to GraphQL. A refresh now costs 4 requests at most instead of up to ~280, and each view's query is sized to a cheap count probe rather than a fixed page size.
- **More than 30 PRs per view**: Views are no longer capped at 30 pull requests — up to 300 per view are fetched via pagination.
- **Check status accuracy**: Check state now comes from GitHub's own status rollup instead of being folded from a capped list of individual checks, so a pull request with many checks can no longer report passing while one is failing.
- **Unresolved comment counts**: "Changes Requested (N)" now counts unresolved review threads rather than every top-level review comment, so resolved and outdated threads no longer inflate the number. Counts above 25 are reported as 25.
- **Author names**: Pull request cards show the author's profile name where they previously showed their login.
- **Legacy commit statuses**: Checks reported through GitHub's older commit status API (used by some external CI providers) now feed the check indicator; previously these showed as "No Checks".
- **Unreadable pull requests**: Pull requests in repositories the token cannot read (SSO-restricted, archived, or deleted) are dropped from the dashboard and reported in the extension console rather than failing the whole refresh.
- **Code Quality & Architecture**: Collapsed the provider's three separate fetch methods into one, replaced blind string conversion of GitHub's API values with explicit maps that warn on anything unrecognised, and removed unused fields from the pull request model. Status indicators on the PR card now resolve their styling in one step instead of three. No visual change.

## [1.6.0] – 2026-07-04

- **Token Expiration Handling**: Inline red banner when your GitHub token expires or is revoked, graceful degradation that preserves cached PRs on refresh failure, and auto-revalidation on settings tab focus — replacing the previous silent-fail and full-error-screen behaviour.
- **Code Quality & Architecture**: Split the monolithic CSS into modular files, and standardized formatting across the entire project with Prettier.
- **Filter Improvements**: "Clear all filters" button and refactored filter state management for better maintainability.
- **Bug Fixes**: Branch URL double-encoding, onboarding interactive guide links not opening, and PR card layout shifting on title hover.

## [1.5.0] – 2026-07-02

- **Reviewed PRs in To Review tab**: Added a "Review Status" filter toggle to show PRs you've already reviewed alongside pending ones. By default, only approved PRs are hidden — PRs with requested changes remain visible since they still need action. (Resolves [#3](https://github.com/jammutkarsh/pr-pulse/issues/3))
- **Unresolved comment counts**: When a review has requested changes, the status label now shows the number of open review threads (e.g., "Changes Requested (3)"). (Resolves [#20](https://github.com/jammutkarsh/pr-pulse/issues/20))
- **Badge count mode**: New setting to choose what the icon badge shows — total PRs in your default view, or only those matching your active filters. The badge always sticks to your pinned tab and is not affected by temporary tab switches in the popup.
- **Clickable review status**: The review status row on each PR card is now a link — clicking deep-links to the relevant review when changes are requested. Check and review status rows also show an external-link icon on hover.

## [1.4.0] – 2026-05-18

- **Draft PR filtering**: Added a "Draft PRs" filter that lets users show, hide, or isolate draft pull requests. (#19)
- **UI enhancements**: Improved filter panel UX, popup layout polish, and status indicator refinements. (#19)
- **Dependencies**: Bumped devalue to 5.8.1 (#16), bumped npm_and_yarn group deps (#18).

## [1.3.2] – 2026-04-20

### 2026-04-20

- Fix: Replace runtime browser detection with build-time `__BROWSER_TARGET__` Vite define; each bundle now statically embeds the correct store link.
- Fix: Firefox manifest — move `data_collection_permissions` into `gecko`, set `required: ['none']`, bump `strict_min_version` to `140.0`, correct icon key to `'64'`.

## [1.3.1] – 2026-04-20

### 2026-04-20

- Fix: Firefox needs `background.scripts` to load background code.
- Fix: Chrome MV3 needs badge updates awaited during startup, so worker does not suspend before toolbar state is written.

## [1.3.0] – 2026-04-19

### 2026-04-19

- **Firefox support and multi-browser packaging**: Added browser-specific manifest generation, Chrome zip and Firefox XPI packaging, and updated install/build flows for both targets.
- **Extension source reorganization**: Moved runtime code, icons, and build helpers under `extension/`, with corresponding Vite and TypeScript path updates.
- **Unified browser API layer**: Introduced a `webextension-polyfill`-based extension API wrapper used across the service worker, popup, onboarding, and settings.
- **Popup and settings refinements**: Expanded popup filtering with PR author support and searchable filter sections, while tightening related onboarding and settings interactions.

## [1.2.0] – 2026-04-13

### 2026-04-13

- **Update README**: Added new sections to the README to better explain the value proposition and purpose of PR Pulse.
- **Change Extension Name and Description**: Rebranded extension to "PR Pulse - GitHub Pull Request Dashboard" for SEO
- **Visual Demo**: Add product screenshots.

### 2026-04-12

- Introduces searchable/filterable PR list in the popup (Fuse-based search, filter UI, per-tab filter state, persistence toggle).
- Updates settings + onboarding UIs for new options (manual/custom polling, persist filters), and refactors several components to Svelte 5 + TypeScript patterns.
- Enhances PR cards and header UX (PR age display, tooltips, compact header controls).

## [1.1.0] – 2026-03-26

### 2026-03-26

- Features
    - **Svelte UI migration** – Replaced the hand-crafted HTML/CSS/JS pages (popup, onboarding, settings) with a fully Svelte-driven generator. Components are now authored as `.svelte` files under `src/`, enabling smaller output, easier templating, and better developer experience.
    - **TypeScript rewrite** – Migrated core library files from plain JavaScript (`lib/*.js`, `service-worker.js`) to TypeScript (`.ts`), adding strong type definitions in `lib/types.ts` and a `lib/ui-config.ts` configuration module.
    - **Build tooling** – Added Vite (`vite.config.ts`) and Svelte/ESLint configuration (`svelte.config.js`, `eslint.config.js`, `tsconfig.json`) to support the new stack, along with a GitHub Actions workflow (`.github/workflows/pr-check-build.yml`) for automated PR build checks.

### 2026-03-23

- Features
    - **Structured error handling** – Introduced a dedicated `lib/errors.js` module with a typed error hierarchy, replacing ad-hoc error strings throughout the codebase.
    - **Dynamic provider registration** – Refactored `lib/provider-manager.js` to support runtime registration of providers, making it easier to add new integrations without modifying the core manager.
    - **Settings UI for providers** – Added provider-specific configuration sections to `settings/settings.html` and `settings/settings.js`, so users can enable/disable individual providers from the settings page.

### 2026-02-23

- **Other**
    - **CNAME** – Added a `CNAME` file to configure the custom domain for the project's GitHub Pages site.

---

## [1.0.0] – 2026-02-11

### 2026-02-11

- **Bug Fixes**
    - **GitHub provider robustness** – Added null-safety guards, fixed a JSON parsing edge case, and eliminated redundant API calls in `lib/providers/github-provider.js`.
    - **Polling alarm deduplication** – Enhanced `setupPollingAlarm` in `service-worker.js` to check whether an alarm already exists before creating a new one, preventing unnecessary recreation on extension restarts.

### 2026-01-27

- **Bug Fixes**
    - **Rate-limit avoidance** – Changed the default auto-refresh interval from a faster cadence to every 10 minutes (`lib/storage.js`, `service-worker.js`, `manifest.json`, `onboarding/onboarding.html`) to stay within GitHub API rate limits. Updated the README to document the new default.

### 2026-01-26

- **Bug Fixes**
    - **Security hardening** – Applied a comprehensive set of security improvements across the extension:
    - XSS prevention via output escaping in popup and onboarding pages.
    - URL validation and sanitization in `lib/utils.js` and `onboarding/onboarding.js`.
    - Input sanitization and safe `parseInt` usage in settings (`settings/settings.js`).
    - Jira URL validation added to the onboarding flow; redundant URL validation removed from the GitHub provider.

- **Documentation**
    - **Project icon in README** – Added the PR Pulse icon to the README header for a more polished project page.

### 2026-01-25

- **Features**
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
    - **Branding & icons** – Added icon assets (`icons/icon1024.png`, `icon128.png`, `icon48.png`) and wired them into the manifest. Refined the GitHub provider's algorithm for determining the overall CI status of a PR from individual check runs.

- **Documentation**
    - **README & LICENSE** – Added `README.md` with full project overview, installation guide, feature list, and configuration reference. Added `LICENSE` (MIT).
