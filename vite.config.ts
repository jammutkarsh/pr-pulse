import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

function copyExtensionAssets() {
	return {
		name: 'copy-extension-assets',
		closeBundle() {
			const root = process.cwd();
			const outDir = resolve(root, 'dist');
			const assetsToCopy = ['manifest.json', 'icons'];
			const generatedHtmlFiles = [
				{ source: resolve(outDir, 'src/popup/index.html'), destination: resolve(outDir, 'popup/popup.html') },
				{ source: resolve(outDir, 'src/settings/index.html'), destination: resolve(outDir, 'settings/settings.html') },
				{ source: resolve(outDir, 'src/onboarding/index.html'), destination: resolve(outDir, 'onboarding/onboarding.html') },
			];

			for (const asset of assetsToCopy) {
				const source = resolve(root, asset);
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

			const generatedSrcDir = resolve(outDir, 'src');
			if (existsSync(generatedSrcDir)) {
				rmSync(generatedSrcDir, { recursive: true, force: true });
			}
		},
	};
}

export default defineConfig({
	cacheDir: '.cache/vite',
	plugins: [svelte(), tailwindcss(), copyExtensionAssets()],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		minify: false,
		reportCompressedSize: false,
		cssMinify: true,
		target: 'es2022',
		rollupOptions: {
			input: {
				'popup/popup': resolve(process.cwd(), 'src/popup/index.html'),
				'settings/settings': resolve(process.cwd(), 'src/settings/index.html'),
				'onboarding/onboarding': resolve(process.cwd(), 'src/onboarding/index.html'),
				'service-worker': resolve(process.cwd(), 'service-worker.ts'),
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
});