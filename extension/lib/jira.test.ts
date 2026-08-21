import assert from 'node:assert/strict';
import { jiraLinkFor, jiraTicketFor, sanitizeJiraUrl } from './jira';

// This module takes a user-supplied URL and builds a link the popup renders as an anchor, so the
// sanitising is a trust boundary, not a formatting nicety. Run with: npm test

function testSanitizeAcceptsWhatUsersActuallyType(): void {
	assert.equal(sanitizeJiraUrl('https://acme.atlassian.net'), 'https://acme.atlassian.net');

	// A bare host is the common case — the scheme gets filled in.
	assert.equal(sanitizeJiraUrl('acme.atlassian.net'), 'https://acme.atlassian.net');

	// Only the origin survives: a pasted deep link, query and hash are all discarded.
	assert.equal(sanitizeJiraUrl('  acme.atlassian.net/browse/ABC-1  '), 'https://acme.atlassian.net');
	assert.equal(sanitizeJiraUrl('https://acme.atlassian.net/path?q=1#h'), 'https://acme.atlassian.net');

	// http and explicit ports are kept — self-hosted Jira lives there.
	assert.equal(sanitizeJiraUrl('http://localhost:8080'), 'http://localhost:8080');
	assert.equal(sanitizeJiraUrl('jira.internal:8080'), 'https://jira.internal:8080');
}

function testSanitizeRejectsEverythingElse(): void {
	// The one that matters: this string reaches an href, so a script scheme must never survive.
	assert.equal(sanitizeJiraUrl('javascript:alert(1)'), '');
	assert.equal(sanitizeJiraUrl('javascript://comment%0aalert(1)'), '');
	assert.equal(sanitizeJiraUrl('data:text/html,<script>alert(1)</script>'), '');

	// Regression: `ftp://x.com` used to come back as `https://ftp`. Prepending https:// to an input
	// that already had a scheme made the host `ftp` and left the protocol check below unreachable.
	assert.equal(sanitizeJiraUrl('ftp://x.com'), '');
	assert.equal(sanitizeJiraUrl('file:///etc/passwd'), '');

	assert.equal(sanitizeJiraUrl('not a url'), '');
	assert.equal(sanitizeJiraUrl('   '), '');
	assert.equal(sanitizeJiraUrl(''), '');
}

function testTicketExtraction(): void {
	assert.equal(jiraTicketFor('feat/ABC-123-thing'), 'ABC-123');
	assert.equal(jiraTicketFor('ABC-123'), 'ABC-123');

	// Lowercase branches are normalised — Jira keys are uppercase.
	assert.equal(jiraTicketFor('fix/abc-1'), 'ABC-1');

	// First match wins when a branch names two tickets.
	assert.equal(jiraTicketFor('feat/ABC-123-and-XYZ-9'), 'ABC-123');

	assert.equal(jiraTicketFor('no-ticket-here'), '');
	assert.equal(jiraTicketFor(''), '');

	// Known false positive, documented rather than fixed: any word-dash-digits pair looks like a key.
	// Tightening it would break the deliberate lowercase support above.
	assert.equal(jiraTicketFor('release-2024-01'), 'RELEASE-2024');
}

function testLinkNeedsBothHalves(): void {
	assert.deepEqual(jiraLinkFor('feat/ABC-123-thing', 'acme.atlassian.net'), {
		ticket: 'ABC-123',
		url: 'https://acme.atlassian.net/browse/ABC-123',
	});

	// No ticket, no base URL, or a base URL that failed sanitising: no link, never a half-built one.
	assert.equal(jiraLinkFor('no-ticket-here', 'acme.atlassian.net'), null);
	assert.equal(jiraLinkFor('feat/ABC-123', ''), null);
	assert.equal(jiraLinkFor('feat/ABC-123', 'javascript:alert(1)'), null);
	assert.equal(jiraLinkFor('', 'acme.atlassian.net'), null);
}

testSanitizeAcceptsWhatUsersActuallyType();
testSanitizeRejectsEverythingElse();
testTicketExtraction();
testLinkNeedsBothHalves();
console.log('jira: all checks passed');
