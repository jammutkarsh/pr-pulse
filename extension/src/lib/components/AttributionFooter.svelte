<script lang="ts">
	import {
		Github,
		Star,
		Twitter,
		Linkedin,
	} from "lucide-svelte";

	const GITHUB_URL = "https://github.com/jammutkarsh/pr-pulse";
	const CHROME_WEB_STORE_URL = "https://short.utkarshchourasia.in/prpulse";
	const FIREFOX_ADDONS_URL = "https://short.utkarshchourasia.in/prpulse-firefox";
	const TWITTER_PROFILE = "https://x.com/jammutkarsh";

	type StoreLink = {
		url: string;
		label: string;
		title: string;
	};

	const currentStoreLink: StoreLink | null = __BROWSER_TARGET__ === 'firefox'
		? { url: FIREFOX_ADDONS_URL, label: 'Rate on Add-ons', title: 'Rate on Firefox Add-ons' }
		: { url: CHROME_WEB_STORE_URL, label: 'Rate on Web Store', title: 'Rate on Chrome Web Store' };

	const shareTargetUrl = currentStoreLink.url;

	const SHARE_TEXT =
		"Check out PR Pulse — a Pull Request dashboard browser extension ⚡";
	const TWEET_URL = `https://x.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(shareTargetUrl)}`;
	const LINKEDIN_URL = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareTargetUrl)}`;
</script>

<footer class="attribution-footer">
	<div class="attribution-built-by">
		Built by
		<a
			href={TWITTER_PROFILE}
			target="_blank"
			rel="noopener noreferrer"
			class="attribution-link attribution-link--author"
		>
			Utkarsh Chourasia
		</a>
	</div>

	<div class="attribution-actions">
		<a
			href={GITHUB_URL}
			target="_blank"
			rel="noopener noreferrer"
			class="attribution-link"
			title="Star on GitHub"
		>
			<Github class="attribution-icon" />
			<span>Star on GitHub</span>
		</a>
		{#if currentStoreLink}
			<span aria-hidden="true" class="attribution-sep">·</span>
			<a
				href={currentStoreLink.url}
				target="_blank"
				rel="noopener noreferrer"
				class="attribution-link"
				title={currentStoreLink.title}
			>
				<Star class="attribution-icon" />
				<span>{currentStoreLink.label}</span>
			</a>
			<span aria-hidden="true" class="attribution-sep">·</span>
		{/if}
		<a
			href={TWEET_URL}
			target="_blank"
			rel="noopener noreferrer"
			class="attribution-link"
			title="Share on X"
		>
			<Twitter class="attribution-icon" />
			<span>Share on X</span>
		</a>
		<span aria-hidden="true" class="attribution-sep">·</span>
		<a
			href={LINKEDIN_URL}
			target="_blank"
			rel="noopener noreferrer"
			class="attribution-link"
			title="Share on LinkedIn"
		>
			<Linkedin class="attribution-icon" />
			<span>Share on LinkedIn</span>
		</a>
	</div>
</footer>
