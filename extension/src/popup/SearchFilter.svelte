<script lang="ts">
    import { tick } from 'svelte';
    import { onDestroy, onMount } from 'svelte';
    import { ChevronDown, ChevronRight, ListFilter, Search, X } from 'lucide-svelte';
    import type { PullRequestRepoOwner, PopupAuthorFilterOption, PopupFilters, PopupOwnerFilterOption, PopupRepoFilterOption } from '../../lib/types';
    import Button from '../lib/components/Button.svelte';

    type AuthorFilterOption = PopupAuthorFilterOption;
    type RepoFilterOption = PopupRepoFilterOption;
    type OwnerFilterOption = PopupOwnerFilterOption;

    type FilterChip = {
        key: string;
        label: string;
        value: string;
        onRemove: () => void;
    };

    const EMPTY_FILTERS: PopupFilters = {
        authors: [],
        owners: [],
        repos: [],
        ageRange: '',
        drafts: 'exclude',
        showReviewed: false,
    };

    interface Props {
        query?: string;
        activeFilters?: PopupFilters;
        allAuthors?: AuthorFilterOption[];
        allRepos?: RepoFilterOption[];
        allOwners?: OwnerFilterOption[];
        availableAuthors?: AuthorFilterOption[];
        availableRepos?: RepoFilterOption[];
        availableOwners?: OwnerFilterOption[];
        hasAuthorFilter?: boolean;
        hasOwnerFilter?: boolean;
        hasRepoFilter?: boolean;
        isToReviewTab?: boolean;
        isSearchOpen?: boolean;
        isFilterOpen?: boolean;
        embedded?: boolean;
        fullpageMode?: boolean;
    }

    let {
        query = $bindable(''),
        activeFilters = $bindable({ ...EMPTY_FILTERS }),
        allAuthors = [] as AuthorFilterOption[],
        allRepos = [] as RepoFilterOption[],
        allOwners = [] as OwnerFilterOption[],
        availableAuthors = [] as AuthorFilterOption[],
        availableRepos = [] as RepoFilterOption[],
        availableOwners = [] as OwnerFilterOption[],
        hasAuthorFilter = false,
        hasOwnerFilter = false,
        hasRepoFilter = false,
        isToReviewTab = false,
        isSearchOpen = $bindable(false),
        isFilterOpen = $bindable(false),
        embedded = false,
        fullpageMode = false,
    }: Props = $props();

    let expandedSections = $state({
        authors: false,
        owners: false,
        repos: false,
        drafts: false,
        reviewStatus: false,
    });

    let searchInput = $state<HTMLInputElement | null>(null);
    let authorSearchQuery = $state('');
    let ownerSearchQuery = $state('');
    let repoSearchQuery = $state('');
    let surfaceElement = $state<HTMLDivElement | null>(null);
    let ignoreOutsideClick = false;
    let wasSearchOpen = false;
    let wasFilterOpen = false;
    let openGuardTimeout: ReturnType<typeof setTimeout> | null = null;

    onMount(() => {
        function handleClick(event: MouseEvent) {
            if (!isSearchOpen || !surfaceElement || ignoreOutsideClick) {
                return;
            }

            const clickPath = event.composedPath();
            if (!clickPath.includes(surfaceElement)) {
                closeSearchSurface();
            }
        }

        window.addEventListener('click', handleClick);

        return () => {
            window.removeEventListener('click', handleClick);
        };
    });

    onDestroy(() => {
        clearOutsideClickGuard();
    });

    function syncSearchSurfaceState(searchOpen: boolean) {
        if (searchOpen === wasSearchOpen) {
            return;
        }

        wasSearchOpen = searchOpen;

        if (searchOpen) {
            armOutsideClickGuard();
            return;
        }

        clearOutsideClickGuard();
    }

    function armOutsideClickGuard() {
        ignoreOutsideClick = true;
        tick().then(() => searchInput?.focus());

        if (openGuardTimeout !== null) {
            clearTimeout(openGuardTimeout);
        }

        openGuardTimeout = setTimeout(() => {
            ignoreOutsideClick = false;
            openGuardTimeout = null;
        }, 0);
    }

    function clearOutsideClickGuard() {
        if (openGuardTimeout !== null) {
            clearTimeout(openGuardTimeout);
            openGuardTimeout = null;
        }

        ignoreOutsideClick = false;
    }

    function toggleFilterPanel() {
        if (!hasMeaningfulFilters) {
            return;
        }

        isFilterOpen = !isFilterOpen;
    }

    function toggleSection(section: keyof typeof expandedSections) {
        expandedSections = {
            ...expandedSections,
            [section]: !expandedSections[section],
        };
    }

    function toggleRepo(repo: string) {
        const repos = activeFilters.repos.includes(repo)
            ? activeFilters.repos.filter((entry) => entry !== repo)
            : [...activeFilters.repos, repo];

        activeFilters = { ...activeFilters, repos };
    }

    function toggleAuthor(author: string) {
        const authors = activeFilters.authors.includes(author)
            ? activeFilters.authors.filter((entry) => entry !== author)
            : [...activeFilters.authors, author];

        activeFilters = { ...activeFilters, authors };
    }

    function toggleOwner(owner: string) {
        const owners = activeFilters.owners.includes(owner)
            ? activeFilters.owners.filter((entry) => entry !== owner)
            : [...activeFilters.owners, owner];

        activeFilters = { ...activeFilters, owners };
    }

    function clearSearch() {
        query = '';
    }

    function closeSearchSurface() {
        clearOutsideClickGuard();
        isSearchOpen = false;
        isFilterOpen = false;
    }

    function matchesFilterQuery(value: string, filterQuery: string, alternateValue = '') {
        const normalizedQuery = filterQuery.trim().toLowerCase();

        if (!normalizedQuery) {
            return true;
        }

        return value.toLowerCase().includes(normalizedQuery) || alternateValue.toLowerCase().includes(normalizedQuery);
    }

    function getSectionListClass(optionCount: number) {
        const visibleLimit = fullpageMode ? 4 : 3;

        if (optionCount <= visibleLimit) {
            return 'space-y-1 pr-1';
        }

        return fullpageMode
            ? 'max-h-[11rem] space-y-1 overflow-y-auto pr-1 scroll-thin'
            : 'max-h-[8.25rem] space-y-1 overflow-y-auto pr-1 scroll-thin';
    }

    function shouldShowSectionSearch(optionCount: number) {
        const visibleLimit = fullpageMode ? 4 : 3;
        return optionCount > visibleLimit;
    }

    function sortSelectedFirst<T>(items: T[], isSelected: (item: T) => boolean) {
        return [...items].sort((left, right) => Number(isSelected(right)) - Number(isSelected(left)));
    }

    function getAuthorName(authorLogin: string) {
        const author = allAuthors.find((entry) => entry.login === authorLogin);
        return author?.name && author.name !== authorLogin ? author.name : '';
    }

    function getOwnerDisplay(ownerLogin: string) {
        const owner = allOwners.find((entry) => entry.login === ownerLogin);
        return owner ? getOwnerTypeLabel(owner.type) : 'Owner';
    }

    function getRepoDisplay(repoFullName: string) {
        const repo = allRepos.find((entry) => entry.fullName === repoFullName);

        if (repo) {
            return { name: repo.name, owner: repo.owner };
        }

        const [owner = 'Repo', name = repoFullName] = repoFullName.split('/');
        return { name, owner };
    }

    function getOwnerTypeLabel(type: PullRequestRepoOwner['type']) {
        if (type === 'org') {
            return 'Org';
        }

        if (type === 'user') {
            return 'User';
        }

        return 'Unknown';
    }

    let hasQuery = $derived(query.trim().length > 0);
    let showAuthorFilter = $derived(hasAuthorFilter || activeFilters.authors.length > 0);
    let showOwnerFilter = $derived(hasOwnerFilter || activeFilters.owners.length > 0);
    let showRepoFilter = $derived(hasRepoFilter || activeFilters.repos.length > 0);
    let availableAuthorLogins = $derived(new Set(availableAuthors.map((author) => author.login)));
    let availableOwnerLogins = $derived(new Set(availableOwners.map((owner) => owner.login)));
    let availableRepoNames = $derived(new Set(availableRepos.map((repo) => repo.fullName)));
    let visibleAuthors = $derived(
        activeFilters.authors.length > 0 || allAuthors.length > 1
            ? sortSelectedFirst(allAuthors, (author) => activeFilters.authors.includes(author.login))
            : []
    );
    let visibleOwners = $derived(
        activeFilters.owners.length > 0 || allOwners.length > 1
            ? sortSelectedFirst(allOwners, (owner) => activeFilters.owners.includes(owner.login))
            : []
    );
    let visibleRepos = $derived(
        activeFilters.repos.length > 0 || allRepos.length > 1
            ? sortSelectedFirst(allRepos, (repo) => activeFilters.repos.includes(repo.fullName))
            : []
    );
    let filteredAuthors = $derived(
        visibleAuthors.filter((author) => matchesFilterQuery(author.login, authorSearchQuery, author.name))
    );
    let filteredOwners = $derived(
        visibleOwners.filter((owner) => matchesFilterQuery(owner.login, ownerSearchQuery, getOwnerTypeLabel(owner.type)))
    );
    let filteredRepos = $derived(
        visibleRepos.filter((repo) => matchesFilterQuery(repo.fullName, repoSearchQuery, `${repo.name} ${repo.owner}`))
    );
    let hasMeaningfulFilters = true; // Always true because Draft filter is always available
    let showAuthorSearch = $derived(shouldShowSectionSearch(visibleAuthors.length));
    let showOwnerSearch = $derived(shouldShowSectionSearch(visibleOwners.length));
    let showRepoSearch = $derived(shouldShowSectionSearch(visibleRepos.length));
    let activeFilterCount = $derived(activeFilters.authors.length + activeFilters.owners.length + activeFilters.repos.length + (activeFilters.drafts !== 'exclude' ? 1 : 0) + (activeFilters.showReviewed && isToReviewTab ? 1 : 0));
    let hasActiveFilters = $derived(activeFilterCount > 0);
    let filterButtonLabel = $derived(hasMeaningfulFilters ? 'Toggle filters' : 'No additional filters available');
    let filterPanelMaxHeight = $derived(fullpageMode ? 'min(40rem, calc(100vh - 13rem))' : '12rem');
    let outerPad = $derived(fullpageMode ? 'px-4 py-3' : 'px-2.5 py-1.5');
    let panelPad = $derived(fullpageMode ? 'px-4 py-3' : 'px-2 py-1.5');
    let sectionSpace = $derived(fullpageMode ? 'space-y-2' : 'space-y-1');
    let headerPad = $derived(fullpageMode ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-[13px]');
    let contentPad = $derived(fullpageMode ? 'px-3 py-2' : 'px-2 py-1');
    let labelPad = $derived(fullpageMode ? 'px-2 py-1.5 text-sm gap-3' : 'px-1.5 py-0.5 text-[13px] gap-2');
    let rowGap = $derived(fullpageMode ? 'gap-2' : 'gap-1');
    let sectionGap = $derived(fullpageMode ? 'gap-1' : 'gap-0.5');
    let draftFilterLabel = $derived(
        activeFilters.drafts === 'only' ? 'Only drafts' :
        activeFilters.drafts === 'include' ? 'Included' :
        'Excluded'
    );
    let reviewStatusLabel = $derived(
        activeFilters.showReviewed ? 'All' : 'Pending only'
    );
    let ownerSingleLabel = $derived(
        activeFilters.owners.length === 1 ? activeFilters.owners[0] : ''
    );
    let authorSingleLabel = $derived(
        activeFilters.authors.length === 1 ? activeFilters.authors[0] : ''
    );
    let repoSingleLabel = $derived(
        activeFilters.repos.length === 1 ? getRepoDisplay(activeFilters.repos[0]).name : ''
    );
    let selectedFilterChips = $derived<FilterChip[]>([
        ...(activeFilters.authors.length > 1
            ? activeFilters.authors.map((authorLogin) => ({
                key: `author:${authorLogin}`,
                label: authorLogin,
                value: getAuthorName(authorLogin),
                onRemove: () => toggleAuthor(authorLogin),
            }))
            : []),
        ...(activeFilters.owners.length > 1
            ? activeFilters.owners.map((ownerLogin) => ({
                key: `owner:${ownerLogin}`,
                label: ownerLogin,
                value: getOwnerDisplay(ownerLogin),
                onRemove: () => toggleOwner(ownerLogin),
            }))
            : []),
        ...(activeFilters.repos.length > 1
            ? activeFilters.repos.map((repoFullName) => ({
                key: `repo:${repoFullName}`,
                label: getRepoDisplay(repoFullName).name,
                value: getRepoDisplay(repoFullName).owner,
                onRemove: () => toggleRepo(repoFullName),
            }))
            : []),
    ]);
    let hasVisibleChips = $derived(selectedFilterChips.length > 0);

    $effect(() => {
        syncSearchSurfaceState(isSearchOpen);
    });

    $effect(() => {
        const allAuthorLogins = new Set(allAuthors.map((author) => author.login));
        const allOwnerLogins = new Set(allOwners.map((owner) => owner.login));
        const allRepoNames = new Set(allRepos.map((repo) => repo.fullName));
        const authors = showAuthorFilter ? activeFilters.authors.filter((author) => allAuthorLogins.has(author)) : [];
        const owners = showOwnerFilter ? activeFilters.owners.filter((owner) => allOwnerLogins.has(owner)) : [];
        const repos = showRepoFilter ? activeFilters.repos.filter((repo) => allRepoNames.has(repo)) : [];

        if (authors.length !== activeFilters.authors.length || owners.length !== activeFilters.owners.length || repos.length !== activeFilters.repos.length) {
            activeFilters = {
                ...activeFilters,
                authors,
                owners,
                repos,
            };
        }

        if (!hasMeaningfulFilters && isFilterOpen) {
            isFilterOpen = false;
        }
    });

    $effect(() => {
        if (!showAuthorSearch && authorSearchQuery) {
            authorSearchQuery = '';
        }

        if (!showOwnerSearch && ownerSearchQuery) {
            ownerSearchQuery = '';
        }

        if (!showRepoSearch && repoSearchQuery) {
            repoSearchQuery = '';
        }
    });

    $effect(() => {
        if (isFilterOpen === wasFilterOpen) {
            return;
        }

        wasFilterOpen = isFilterOpen;

        if (!isFilterOpen) {
            expandedSections = {
                authors: false,
                owners: false,
                repos: false,
                drafts: false,
                reviewStatus: false,
            };
        }
    });
</script>

{#if isSearchOpen}
<div bind:this={surfaceElement} class={embedded ? 'relative z-20' : `relative z-20 border-b border-soft ${outerPad}`}>
    <div class="space-y-1">
            <div class={`flex items-center ${rowGap}`}>
                <div class="relative min-w-0 flex-1">
                    <Search class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-soft" />
                    <input
                        bind:this={searchInput}
                        type="text"
                        bind:value={query}
                        placeholder="Search PRs, branches, repos, jira"
                        class="field-input popup-search-input"
                    />
                    {#if hasQuery}
                        <button class="unstyled-button absolute right-1.5 top-1/2 -translate-y-1/2 text-soft hover:text-white" onclick={clearSearch} aria-label="Clear search">
                            <X class="h-3.5 w-3.5" />
                        </button>
                    {/if}
                </div>

                <Button
                    className={isFilterOpen || hasActiveFilters ? 'h-7 w-7 shrink-0 px-0 border-(--accent) bg-(--accent)/10 text-(--accent) shadow-[0_0_0_1px_rgba(55,148,255,0.22),0_0_16px_rgba(55,148,255,0.14)] hover:border-(--accent) hover:bg-(--accent)/10 hover:text-(--accent)' : 'h-7 w-7 shrink-0 px-0 border-soft bg-transparent text-soft hover:border-strong hover:bg-(--bg-muted) hover:text-white'}
                    size="icon"
                    variant="ghost"
                    onclick={toggleFilterPanel}
                    disabled={!hasMeaningfulFilters}
                    aria-label={filterButtonLabel}
                    title={filterButtonLabel}
                >
                    <ListFilter class="h-3.5 w-3.5" />
                </Button>
            </div>

        {#if isFilterOpen && hasMeaningfulFilters}
            {#if hasVisibleChips}
                <div class="flex items-center gap-3">
                    <div class="min-w-0 flex-1 overflow-x-auto scroll-thin">
                        <div class="flex min-w-max items-center gap-1.5 px-0.5">
                            {#each selectedFilterChips as chip (chip.key)}
                                <button
                                    class="filter-chip"
                                    onclick={chip.onRemove}
                                    title={`Remove ${chip.label} filter`}
                                >
                                    <span class="font-medium text-white">{chip.label}</span>
                                    {#if chip.value}
                                        <span class="truncate text-soft">{chip.value}</span>
                                    {/if}
                                    <X class="h-3 w-3 shrink-0" />
                                </button>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}

            <div class={`overflow-y-auto rounded-xl border border-soft bg-(--bg-panel-strong) ${panelPad} shadow-lg`} style:max-height={filterPanelMaxHeight}>
                <div class={sectionSpace}>
                    <div class="filter-section">
                        <button
                            class={`filter-section-header ${headerPad}`}
                            onclick={() => toggleSection('drafts')}
                        >
                            <span class="flex items-center gap-2">
                                {#if expandedSections.drafts}
                                    <ChevronDown class="icon-soft" />
                                {:else}
                                    <ChevronRight class="icon-soft" />
                                {/if}
                                <span>Draft PRs</span>
                                {#if !expandedSections.drafts}
                                    <span class="filter-meta">· {draftFilterLabel}</span>
                                {/if}
                            </span>
                        </button>

                        {#if expandedSections.drafts}
                            <div class={`filter-section-body ${contentPad}`}>
                        <div class={`flex flex-col ${sectionGap}`}>
                            <label class={`filter-label ${labelPad}`}>
                                <input type="radio" name="draft_filter" value="exclude" class="h-3.5 w-3.5 border-soft bg-black/40 text-(--accent) focus:ring-(--accent)" bind:group={activeFilters.drafts} />
                                <span class="filter-label-text">Don't show drafts</span>
                            </label>
                            <label class={`filter-label ${labelPad}`}>
                                <input type="radio" name="draft_filter" value="include" class="h-3.5 w-3.5 border-soft bg-black/40 text-(--accent) focus:ring-(--accent)" bind:group={activeFilters.drafts} />
                                <span class="filter-label-text">Include drafts</span>
                            </label>
                            <label class={`filter-label ${labelPad}`}>
                                <input type="radio" name="draft_filter" value="only" class="h-3.5 w-3.5 border-soft bg-black/40 text-(--accent) focus:ring-(--accent)" bind:group={activeFilters.drafts} />
                                <span class="min-w-0 flex-1 text-soft">Only show drafts</span>
                            </label>
                        </div>
                            </div>
                        {/if}
                    </div>

                    {#if isToReviewTab}
                        <div class="filter-section">
                            <button
                            class={`filter-section-header ${headerPad}`}
                                onclick={() => toggleSection('reviewStatus')}
                            >
                                <span class="flex items-center gap-2">
                                    {#if expandedSections.reviewStatus}
                                        <ChevronDown class="icon-soft" />
                                    {:else}
                                        <ChevronRight class="icon-soft" />
                                    {/if}
                                    <span>Review Status</span>
                                    {#if !expandedSections.reviewStatus}
                                        <span class="filter-meta">· {reviewStatusLabel}</span>
                                    {/if}
                                </span>
                            </button>

                            {#if expandedSections.reviewStatus}
                                <div class={`filter-section-body ${contentPad}`}>
                            <div class={`flex flex-col ${sectionGap}`}>
                                <label class={`filter-label ${labelPad}`}>
                                    <input type="radio" name="review_filter" value="pending" checked={!activeFilters.showReviewed} onchange={() => { activeFilters = { ...activeFilters, showReviewed: false }; }} class="h-3.5 w-3.5 border-soft bg-black/40 text-(--accent) focus:ring-(--accent)" />
                                    <span class="filter-label-text">Only pending review</span>
                                </label>
                                <label class={`filter-label ${labelPad}`}>
                                    <input type="radio" name="review_filter" value="all" checked={activeFilters.showReviewed} onchange={() => { activeFilters = { ...activeFilters, showReviewed: true }; }} class="h-3.5 w-3.5 border-soft bg-black/40 text-(--accent) focus:ring-(--accent)" />
                                    <span class="min-w-0 flex-1 text-soft">Show reviewed PRs</span>
                                </label>
                            </div>
                                </div>
                            {/if}
                        </div>
                    {/if}

                    {#if showOwnerFilter}
                        <div class="filter-section">
                            <button
                                class={`filter-section-header ${headerPad}`}
                                onclick={() => toggleSection('owners')}
                            >
                                <span class="flex items-center gap-2">
                                        {#if expandedSections.owners}
                                            <ChevronDown class="icon-soft" />
                                        {:else}
                                            <ChevronRight class="icon-soft" />
                                        {/if}
                                        <span>Owners</span>
                                        {#if !expandedSections.owners && ownerSingleLabel}
                                            <span class="filter-meta">· {ownerSingleLabel}</span>
                                        {/if}
                                    </span>
                                    {#if activeFilters.owners.length > 0}
                                        <span class="filter-clear" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); activeFilters = { ...activeFilters, owners: [] }; }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); activeFilters = { ...activeFilters, owners: [] }; } }}>Clear</span>
                                    {/if}
                            </button>

                            {#if expandedSections.owners}
                                <div class={`filter-section-body ${contentPad}`}>
                                    {#if showOwnerSearch}
                                        <div class="mb-2">
                                            <input
                                                type="text"
                                                bind:value={ownerSearchQuery}
                                                placeholder="Search owners"
                                                class="filter-search-input"
                                            />
                                        </div>
                                    {/if}
                                    <div class={getSectionListClass(filteredOwners.length)}>
                                        {#each filteredOwners as owner (owner.login)}
                                            {@const ownerSelected = activeFilters.owners.includes(owner.login)}
                                            {@const ownerAvailable = availableOwnerLogins.has(owner.login)}
                                            <label class={`filter-label ${labelPad} ${ownerSelected || ownerAvailable ? '' : 'filter-label-disabled'}`}>
                                                <input
                                                    type="checkbox"
                                                    class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                    checked={ownerSelected}
                                                    disabled={!ownerSelected && !ownerAvailable}
                                                    onchange={() => toggleOwner(owner.login)}
                                                />
                                                <span class="truncate-text">{owner.login}</span>
                                                {#if owner.type !== 'unknown'}
                                                    <span class="type-label">{getOwnerTypeLabel(owner.type)}</span>
                                                {/if}
                                            </label>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/if}

                    {#if showAuthorFilter}
                        <div class="filter-section">
                            <button
                                class={`filter-section-header ${headerPad}`}
                                onclick={() => toggleSection('authors')}
                            >
                                <span class="flex items-center gap-2">
                                        {#if expandedSections.authors}
                                            <ChevronDown class="icon-soft" />
                                        {:else}
                                            <ChevronRight class="icon-soft" />
                                        {/if}
                                        <span>Author</span>
                                        {#if !expandedSections.authors && authorSingleLabel}
                                            <span class="filter-meta">· {authorSingleLabel}</span>
                                        {/if}
                                    </span>
                                    {#if activeFilters.authors.length > 0}
                                        <span class="filter-clear" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); activeFilters = { ...activeFilters, authors: [] }; }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); activeFilters = { ...activeFilters, authors: [] }; } }}>Clear</span>
                                    {/if}
                            </button>

                            {#if expandedSections.authors}
                                <div class={`filter-section-body ${contentPad}`}>
                                    {#if showAuthorSearch}
                                        <div class="mb-2">
                                            <input
                                                type="text"
                                                bind:value={authorSearchQuery}
                                                placeholder="Search PR authors"
                                                class="filter-search-input"
                                            />
                                        </div>
                                    {/if}
                                    <div class={getSectionListClass(filteredAuthors.length)}>
                                        {#each filteredAuthors as author (author.login)}
                                            {@const authorSelected = activeFilters.authors.includes(author.login)}
                                            {@const authorAvailable = availableAuthorLogins.has(author.login)}
                                            <label class={`filter-label ${labelPad} ${authorSelected || authorAvailable ? '' : 'filter-label-disabled'}`}>
                                                <input
                                                    type="checkbox"
                                                    class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                    checked={authorSelected}
                                                    disabled={!authorSelected && !authorAvailable}
                                                    onchange={() => toggleAuthor(author.login)}
                                                />
                                                <span class="truncate-text">{author.login}</span>
                                                {#if getAuthorName(author.login)}
                                                    <span class="shrink-0 truncate text-[11px] text-soft">{getAuthorName(author.login)}</span>
                                                {/if}
                                            </label>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/if}

                    {#if showRepoFilter}
                        <div class="filter-section">
                            <button
                                class={`filter-section-header ${headerPad}`}
                                onclick={() => toggleSection('repos')}
                            >
                                <span class="flex items-center gap-2">
                                        {#if expandedSections.repos}
                                            <ChevronDown class="icon-soft" />
                                        {:else}
                                            <ChevronRight class="icon-soft" />
                                        {/if}
                                        <span>Repositories</span>
                                        {#if !expandedSections.repos && repoSingleLabel}
                                            <span class="filter-meta">· {repoSingleLabel}</span>
                                        {/if}
                                    </span>
                                    {#if activeFilters.repos.length > 0}
                                        <span class="filter-clear" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); activeFilters = { ...activeFilters, repos: [] }; }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); activeFilters = { ...activeFilters, repos: [] }; } }}>Clear</span>
                                    {/if}
                                </button>

                            {#if expandedSections.repos}
                                <div class={`filter-section-body ${contentPad}`}>
                                    {#if showRepoSearch}
                                        <div class="mb-2">
                                            <input
                                                type="text"
                                                bind:value={repoSearchQuery}
                                                placeholder="Search repositories"
                                                class="filter-search-input"
                                            />
                                        </div>
                                    {/if}
                                    <div class={getSectionListClass(filteredRepos.length)}>
                                        {#each filteredRepos as repo (repo.fullName)}
                                            {@const repoSelected = activeFilters.repos.includes(repo.fullName)}
                                            {@const repoAvailable = availableRepoNames.has(repo.fullName)}
                                            <label class={`filter-label ${labelPad} ${repoSelected || repoAvailable ? '' : 'filter-label-disabled'}`}>
                                                <input
                                                    type="checkbox"
                                                    class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                    checked={repoSelected}
                                                    disabled={!repoSelected && !repoAvailable}
                                                    onchange={() => toggleRepo(repo.fullName)}
                                                />
                                                <span class="truncate-text" title={repo.fullName}>{repo.name}</span>
                                                <span class="type-label">{repo.owner}</span>
                                            </label>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/if}

                </div>
            </div>
        {/if}
    </div>
</div>
{/if}
