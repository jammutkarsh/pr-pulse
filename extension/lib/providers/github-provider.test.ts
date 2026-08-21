import assert from 'node:assert/strict';
import { nextPageSize } from './github-provider';

// Sizing the request to the count probe is what keeps a 7-PR user from being billed like a 100-PR one,
// so the arithmetic gets a check. Run with: npm test
function testNextPageSize(): void {
	// Small view: one page sized exactly, no rounding up to the max.
	assert.equal(nextPageSize(7, 0), 7);

	// Empty view still floors at 1 — GraphQL rejects `first: 0`. Callers skip the request entirely.
	assert.equal(nextPageSize(0, 0), 1);

	// Large view: clamped to GitHub's per-page maximum.
	assert.equal(nextPageSize(250, 0), 100);

	// Later pages ask only for the remainder, so the last page of 250 costs half a full page.
	assert.equal(nextPageSize(250, 100), 100);
	assert.equal(nextPageSize(250, 200), 50);

	// Drift: PRs closed between the probe and the fetch can push seen past the count. Still never 0.
	assert.equal(nextPageSize(10, 12), 1);
}

testNextPageSize();
console.log('github-provider: all checks passed');
