import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

import { cloudflare } from "@cloudflare/vite-plugin";

const nodeModules = fileURLToPath(new URL('./node_modules', import.meta.url));

export default defineConfig({
	plugins: [svelte(), tailwindcss(), cloudflare()],
	// Reused extension code references this build-time constant (see extension vite.config).
	define: { __BROWSER_TARGET__: JSON.stringify('chrome') },
	// Allow importing the real extension source (one level up, outside this root).
	server: { fs: { allow: ['..'] } },
	resolve: {
		// Reused extension components import these, but resolve from their own dir
		// which has no node_modules — point them at the website's copy.
		alias: {
			'lucide-svelte': `${nodeModules}/lucide-svelte`,
		},
		dedupe: ['svelte'],
	},
});