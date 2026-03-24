import { mount } from 'svelte';
import '../styles/app.css';
import { storage } from '../../lib/storage';

const bootstrapDataPromise = storage.getPopupBootstrapData();
const { default: App } = await import('./App.svelte');

mount(App, {
	target: document.getElementById('app') as HTMLElement,
	props: {
		bootstrapDataPromise,
	},
});