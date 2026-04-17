import { mount } from 'svelte';
import '../styles/app.css';
import { storage } from '../../lib/storage';
import { applyDocumentUiConfig } from '../../lib/ui-config';
import App from './App.svelte';

const target = document.getElementById('app');

if (!target) {
	throw new Error('Failed to mount onboarding app: #app element not found.');
}

const settings = await storage.getSettings();
applyDocumentUiConfig(settings.ui);

mount(App, {
	target,
});