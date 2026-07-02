import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
	test: {
		projects: [
			{
				resolve: {
					alias: [
						{ find: '@lib', replacement: resolve(import.meta.dirname, 'extension/lib') },
						{ find: '@ui', replacement: resolve(import.meta.dirname, 'extension/src/ui') },
					],
				},
				test: {
					name: 'unit',
					include: [
						'extension/lib/__tests__/**/*.test.ts',
						'extension/src/ui/__tests__/**/*.test.ts',
					],
					environment: 'node',
					setupFiles: ['./tests/setup/unit.ts'],
				},
			},
		],
	},
});
