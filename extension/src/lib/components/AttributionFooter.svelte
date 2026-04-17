<script>
	import {
		Github,
		Star,
		Twitter,
		Linkedin,
	} from "lucide-svelte";

	const GITHUB_URL = "https://github.com/jammutkarsh/pr-pulse";
	const CWS_URL = "https://short.utkarshchourasia.in/prpulse";
	const TWITTER_PROFILE = "https://x.com/jammutkarsh";

	const SHARE_TEXT =
		"Check out PR Pulse — a Chrome extension that keeps you on top of your GitHub pull requests ⚡";
	const TWEET_URL = `https://x.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(CWS_URL)}`;
	const LINKEDIN_URL = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(CWS_URL)}`;
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
		<span aria-hidden="true" class="attribution-sep">·</span>
		<a
			href={CWS_URL}
			target="_blank"
			rel="noopener noreferrer"
			class="attribution-link"
			title="Rate on Chrome Web Store"
		>
			<Star class="attribution-icon" />
			<span>Rate on Web Store</span>
		</a>
		<span aria-hidden="true" class="attribution-sep">·</span>
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
