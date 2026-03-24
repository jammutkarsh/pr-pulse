import { mount } from 'svelte';
import '../styles/app.css';
import App from './App.svelte';

const target = document.getElementById('app');

if (!target) {
	throw new Error('Failed to mount onboarding app: #app element not found.');
}

mount(App, {
	target,
});