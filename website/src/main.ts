import { hydrate, mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const target = document.getElementById('app')!;
// Prod build prerenders App.svelte into this element (see scripts/prerender.mjs) —
// hydrate over that markup. Dev server serves it empty, so mount fresh instead.
export default target.hasChildNodes() ? hydrate(App, { target }) : mount(App, { target });
