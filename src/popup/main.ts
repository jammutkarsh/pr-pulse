import { mount } from 'svelte';
import '../styles/app.css';
import { storage } from '../../lib/storage';
import App from './App.svelte';

const bootstrapDataPromise = storage.getPopupBootstrapData();
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