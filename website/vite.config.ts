import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [svelte(), tailwindcss()],
	// Reused extension code references this build-time constant (see extension vite.config).
	define: { __BROWSER_TARGET__: JSON.stringify('chrome') },
	// Allow importing the real extension source (one level up, outside this root).
	server: { fs: { allow: ['..'] } },
});
