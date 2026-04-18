import { mount } from 'svelte';
import '../styles/app.css';
import { storage } from '../../lib/storage';
import { applyDocumentUiConfig } from '../../lib/ui-config';
import App from './App.svelte';

const bootstrapDataPromise = storage.getPopupBootstrapData();
const bootstrapData = await bootstrapDataPromise;
const target = document.getElementById('app');
const shell = document.getElementById('app-shell');

if (!target) {
	throw new Error('Failed to mount popup app: #app element not found.');
}

applyDocumentUiConfig(bootstrapData.settings.ui);

mount(App, {
	target,
	props: {
		bootstrapDataPromise: Promise.resolve(bootstrapData),
	},
});

requestAnimationFrame(() => {
	shell?.remove();
});