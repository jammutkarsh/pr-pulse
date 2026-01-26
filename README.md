<div align="left">
  <img src="icons/icon128.png" width="128" height="128" alt="PR Pulse Icon" />
  <h1>PR Pulse</h1>
</div>

> *Keep your finger on the pulse of your PRs. Real-time GitHub monitoring that checks every minute, so nothing slips through the cracks.*

A Chrome extension that monitors your GitHub Pull Requests like a vital signs monitor - constant, reliable, and always keeping you informed.

## Features

### 🩺 Real-Time PR Diagnostics
- **My PRs Tab** - See all your open pull requests at a glance
- **To Review Tab** - Track PRs waiting for your review
- **Auto-Refresh** - Automatic scanning every 60 seconds

### 💊 Instant Health Checks
- **CI/Checks Status** - See if checks are passing, failing, or running
- **Review Status** - Know if you're approved, have changes requested, or awaiting review
- **Smart Detection** - Recognizes when reviews are re-requested after addressing feedback

### 🔗 One-Click Navigation
- Click author avatar → Open their GitHub profile
- Click repo name → Open the repository
- Click line changes → Jump directly to the Files Changed tab
- Click anywhere else → Open the full PR

### 📋 Jira Integration
- Auto-detects Jira ticket IDs from branch names (e.g., `feat/JIRA-1234/description`)
- One-click to open the linked Jira ticket
- Copy PR links instantly with the clipboard button

### 🖥️ Flexible Display Modes
- **Popup Mode** - Quick access from your browser toolbar
- **Full Page Mode** - Dedicated tab for focused PR management
- Seamless in-app navigation in full page mode

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `chrome-extension` folder

### Quick Setup

1. Click the extension icon → Settings or Open Setup
2. Enter your GitHub Personal Access Token
   - [Create a new token](https://github.com/settings/tokens/new?scopes=repo&description=PR%20Pulse)
   - Required scope: `repo`
3. You're done! PR Pulse will start monitoring immediately

## Usage

| Action | Result |
|--------|--------|
| Click extension icon | Open PR Pulse popup |
| Click fullscreen button | Open in dedicated tab |
| Click PR title | Open the pull request |
| Click author avatar | Open their GitHub profile |
| Click repo name | Open the repository |
| Click +/- changes | Open Files Changed tab |
| Click Jira button | Open linked Jira ticket |
| Click Copy Link | Copy PR URL to clipboard |

## Project Structure

```
chrome-extension/
├── manifest.json           # Extension manifest (v3)
├── service-worker.js       # Background polling
├── popup/                  # Main popup UI
├── settings/               # Settings page
├── onboarding/             # Setup wizard
├── lib/                    # Core libraries
│   ├── providers/          # Git platform providers
│   ├── storage.js          # Chrome storage wrapper
│   └── utils.js            # Utility functions
└── icons/                  # Extension icons
```

## Extensibility

Built with a **Provider Adapter Pattern** for easy platform expansion:
- `BaseProvider` - Interface all providers implement
- `GitHubProvider` - Reference implementation

## Privacy

- Your GitHub PAT is stored locally in Chrome's extension storage
- No data is sent to any third-party servers
- All API calls are made directly to GitHub's API

## License

[MIT](LICENSE)
