import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

function copyExtensionAssets() {
	let outDir = resolve(process.cwd(), 'dist');

	return {
		name: 'copy-extension-assets',
		configResolved(config) {
			outDir = resolve(config.root, config.build.outDir);
		},
		closeBundle() {
			const sourceRoot = resolve(process.cwd(), 'extension');
			const assetsToCopy = ['icons'];
			const generatedHtmlFiles = [
				{ source: resolve(outDir, 'extension/src/popup/index.html'), destination: resolve(outDir, 'popup/popup.html') },
				{ source: resolve(outDir, 'extension/src/settings/index.html'), destination: resolve(outDir, 'settings/settings.html') },
				{
					source: resolve(outDir, 'extension/src/onboarding/index.html'),
					destination: resolve(outDir, 'onboarding/onboarding.html'),
				},
			];

			for (const asset of assetsToCopy) {
				const source = resolve(sourceRoot, asset);
				if (!existsSync(source)) {
					continue;
				}

				cpSync(source, resolve(outDir, asset), { recursive: true });
			}

			for (const htmlFile of generatedHtmlFiles) {
				if (!existsSync(htmlFile.source)) {
					continue;
				}

				mkdirSync(resolve(htmlFile.destination, '..'), { recursive: true });
				renameSync(htmlFile.source, htmlFile.destination);
			}

			const generatedExtensionDir = resolve(outDir, 'extension');
			if (existsSync(generatedExtensionDir)) {
				rmSync(generatedExtensionDir, { recursive: true, force: true });
			}
		},
	};
}

export default defineConfig(({ mode }) => ({
	cacheDir: '.cache/vite',
	define: {
		__BROWSER_TARGET__: JSON.stringify(mode === 'firefox' ? 'firefox' : 'chrome'),
	},
	plugins: [svelte(), tailwindcss(), copyExtensionAssets()],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		minify: false,
		reportCompressedSize: false,
		cssMinify: false,
		target: 'es2022',
		rollupOptions: {
			input: {
				'popup/popup': resolve(process.cwd(), 'extension/src/popup/index.html'),
				'settings/settings': resolve(process.cwd(), 'extension/src/settings/index.html'),
				'onboarding/onboarding': resolve(process.cwd(), 'extension/src/onboarding/index.html'),
				'service-worker': resolve(process.cwd(), 'extension/service-worker.ts'),
			},
			output: {
				entryFileNames: (chunkInfo) => {
					if (chunkInfo.name === 'service-worker') {
						return 'service-worker.js';
					}

					return 'assets/[name]-[hash].js';
				},
				chunkFileNames: 'assets/[name]-[hash].js',
				assetFileNames: 'assets/[name]-[hash][extname]',
			},
		},
	},
}));
