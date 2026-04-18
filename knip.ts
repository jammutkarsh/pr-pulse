// knip.ts
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: [
    'extension/service-worker.ts',
    'extension/src/popup/main.ts',
    'extension/src/onboarding/main.ts',
    'extension/src/settings/main.ts',
    'extension/scripts/generate-manifest.ts',
    'vite.config.ts'
  ],
  project: ['extension/**/*.{ts,svelte}'],
  ignore: [
    'node_modules/**', 
    'dist/**', 
    'build/**', 
    '**/*.d.ts',
    '.cache/**'
  ],
  ignoreExportsUsedInFile: true,
};

export default config;