import { mount } from 'svelte';
import '../styles/app.css';
import { storage } from '../../lib/storage';

const bootstrapDataPromise = storage.getPopupBootstrapData();
const { default: App } = await import('./App.svelte');
const target = document.getElementById('app');

if (!target) {
	throw new Error('Failed to mount popup app: #app element not found.');
}

mount(App, {
	target,
	props: {
		bootstrapDataPromise,
	},
});