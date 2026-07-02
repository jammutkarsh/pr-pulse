<script lang="ts">
    import { tick } from 'svelte';
    import { onDestroy, onMount } from 'svelte';
    import { ChevronDown, ChevronRight, ListFilter, Search, Trash2, X } from 'lucide-svelte';
    import type { PullRequestRepoOwner, PopupAuthorFilterOption, PopupFilters, PopupOwnerFilterOption, PopupRepoFilterOption } from '@lib/types';
    import Button from '@ui/components/Button.svelte';

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

    const LAYOUT = {
        compact: {
            outerPad: 'px-2.5 py-1.5',
            panelPad: 'px-2 py-1.5',
            sectionSpace: 'space-y-1',
            headerPad: 'px-2 py-1 text-[13px]',
            contentPad: 'px-2 py-1',
            labelPad: 'px-1.5 py-0.5 text-[13px] gap-2',
            rowGap: 'gap-1',
            sectionGap: 'gap-0.5',
            filterPanelMaxHeight: '12rem',
            visibleLimit: 3,
            overflowListClass: 'max-h-[8.25rem] space-y-1 overflow-y-auto pr-1 scroll-thin',
        },
        full: {
            outerPad: 'px-4 py-3',
            panelPad: 'px-4 py-3',
            sectionSpace: 'space-y-2',
            headerPad: 'px-3 py-2 text-sm',
            contentPad: 'px-3 py-2',
            labelPad: 'px-2 py-1.5 text-sm gap-3',
            rowGap: 'gap-2',
            sectionGap: 'gap-1',
            filterPanelMaxHeight: 'min(40rem, calc(100vh - 13rem))',
            visibleLimit: 4,
            overflowListClass: 'max-h-[11rem] space-y-1 overflow-y-auto pr-1 scroll-thin',
        },
    } as const;

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
    let sectionSearch = $state({ authors: '', owners: '', repos: '' });
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

    function toggleFilter<K extends 'authors' | 'owners' | 'repos'>(key: K, value: string) {
        const list = activeFilters[key] as string[];
        const updated = list.includes(value)
            ? list.filter((entry) => entry !== value)
            : [...list, value];
        activeFilters = { ...activeFilters, [key]: updated };
    }

    function clearSearch() {
        query = '';
    }

    function clearAllFilters() {
        query = '';
        activeFilters = { ...EMPTY_FILTERS };
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
        return optionCount <= layout.visibleLimit
            ? 'space-y-1 pr-1'
            : layout.overflowListClass;
    }

    function shouldShowSectionSearch(optionCount: number) {
        return optionCount > layout.visibleLimit;
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
    let section = $derived((() => {
        const visibleAuthors = (activeFilters.authors.length > 0 || allAuthors.length > 1)
            ? sortSelectedFirst(allAuthors, (a) => activeFilters.authors.includes(a.login))
            : [];
        const visibleOwners = (activeFilters.owners.length > 0 || allOwners.length > 1)
            ? sortSelectedFirst(allOwners, (o) => activeFilters.owners.includes(o.login))
            : [];
        const visibleRepos = (activeFilters.repos.length > 0 || allRepos.length > 1)
            ? sortSelectedFirst(allRepos, (r) => activeFilters.repos.includes(r.fullName))
            : [];

        return {
            authors: {
                show: hasAuthorFilter || activeFilters.authors.length > 0,
                availableSet: new Set(availableAuthors.map(a => a.login)),
                filtered: visibleAuthors.filter(a => matchesFilterQuery(a.login, sectionSearch.authors, a.name)),
                showSearch: shouldShowSectionSearch(visibleAuthors.length),
                singleLabel: activeFilters.authors.length === 1 ? activeFilters.authors[0] : '',
            },
            owners: {
                show: hasOwnerFilter || activeFilters.owners.length > 0,
                availableSet: new Set(availableOwners.map(o => o.login)),
                filtered: visibleOwners.filter(o => matchesFilterQuery(o.login, sectionSearch.owners, getOwnerTypeLabel(o.type))),
                showSearch: shouldShowSectionSearch(visibleOwners.length),
                singleLabel: activeFilters.owners.length === 1 ? activeFilters.owners[0] : '',
            },
            repos: {
                show: hasRepoFilter || activeFilters.repos.length > 0,
                availableSet: new Set(availableRepos.map(r => r.fullName)),
                filtered: visibleRepos.filter(r => matchesFilterQuery(r.fullName, sectionSearch.repos, `${r.name} ${r.owner}`)),
                showSearch: shouldShowSectionSearch(visibleRepos.length),
                singleLabel: activeFilters.repos.length === 1 ? getRepoDisplay(activeFilters.repos[0]).name : '',
            },
        };
    })());
    let hasMeaningfulFilters = true; // Always true because Draft filter is always available
    let activeFilterCount = $derived(activeFilters.authors.length + activeFilters.owners.length + activeFilters.repos.length + (activeFilters.drafts !== 'exclude' ? 1 : 0) + (activeFilters.showReviewed && isToReviewTab ? 1 : 0));
    let hasActiveFilters = $derived(activeFilterCount > 0);
    let layout = $derived(fullpageMode ? LAYOUT.full : LAYOUT.compact);
    let filterButtonLabel = $derived(hasMeaningfulFilters ? 'Toggle filters' : 'No additional filters available');
    let draftFilterLabel = $derived(
        activeFilters.drafts === 'only' ? 'Only drafts' :
        activeFilters.drafts === 'include' ? 'Included' :
        'Excluded'
    );
    let reviewStatusLabel = $derived(
        activeFilters.showReviewed ? 'All' : 'Pending only'
    );
    let selectedFilterChips = $derived<FilterChip[]>([
        ...(activeFilters.authors.length > 1
            ? activeFilters.authors.map((authorLogin) => ({
                key: `author:${authorLogin}`,
                label: authorLogin,
                value: getAuthorName(authorLogin),
                onRemove: () => toggleFilter('authors', authorLogin),
            }))
            : []),
        ...(activeFilters.owners.length > 1
            ? activeFilters.owners.map((ownerLogin) => ({
                key: `owner:${ownerLogin}`,
                label: ownerLogin,
                value: getOwnerDisplay(ownerLogin),
                onRemove: () => toggleFilter('owners', ownerLogin),
            }))
            : []),
        ...(activeFilters.repos.length > 1
            ? activeFilters.repos.map((repoFullName) => ({
                key: `repo:${repoFullName}`,
                label: getRepoDisplay(repoFullName).name,
                value: getRepoDisplay(repoFullName).owner,
                onRemove: () => toggleFilter('repos', repoFullName),
            }))
            : []),
    ]);
    let hasVisibleChips = $derived(selectedFilterChips.length > 0);

    $effect(() => {
        syncSearchSurfaceState(isSearchOpen);
    });

    $effect(() => {
        const validAuthors = section.authors.show ? activeFilters.authors.filter(a => section.authors.availableSet.has(a)) : [];
        const validOwners = section.owners.show ? activeFilters.owners.filter(o => section.owners.availableSet.has(o)) : [];
        const validRepos = section.repos.show ? activeFilters.repos.filter(r => section.repos.availableSet.has(r)) : [];

        if (validAuthors.length !== activeFilters.authors.length || validOwners.length !== activeFilters.owners.length || validRepos.length !== activeFilters.repos.length) {
            activeFilters = { ...activeFilters, authors: validAuthors, owners: validOwners, repos: validRepos };
        }

        if (!hasMeaningfulFilters && isFilterOpen) {
            isFilterOpen = false;
        }
    });

    $effect(() => {
        if (!section.authors.showSearch && sectionSearch.authors) sectionSearch.authors = '';
        if (!section.owners.showSearch && sectionSearch.owners) sectionSearch.owners = '';
        if (!section.repos.showSearch && sectionSearch.repos) sectionSearch.repos = '';
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
<div bind:this={surfaceElement} class={embedded ? 'relative z-20' : `relative z-20 border-b border-soft ${layout.outerPad}`}>
    <div class="space-y-1">
            <div class={`flex items-center ${layout.rowGap}`}>
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
                {#if hasActiveFilters}
                    <Button
                        className="h-7 w-7 shrink-0 px-0 text-soft hover:text-white hover:bg-(--bg-muted) hover:border-strong cursor-pointer"
                        size="icon"
                        variant="ghost"
                        onclick={clearAllFilters}
                        aria-label="Clear all filters"
                        title="Clear all filters"
                    >
                        <Trash2 class="h-3.5 w-3.5" />
                    </Button>
                {/if}
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

            <div class={`overflow-y-auto rounded-xl border border-soft bg-(--bg-panel-strong) ${layout.panelPad} shadow-lg`} style:max-height={layout.filterPanelMaxHeight}>
                <div class={layout.sectionSpace}>
                    <div class="filter-section">
                        <button
                            class={`filter-section-header ${layout.headerPad}`}
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
                            <div class={`filter-section-body ${layout.contentPad}`}>
                        <div class={`flex flex-col ${layout.sectionGap}`}>
                            <label class={`filter-label ${layout.labelPad}`}>
                                <input type="radio" name="draft_filter" value="exclude" class="h-3.5 w-3.5 border-soft bg-black/40 text-(--accent) focus:ring-(--accent)" bind:group={activeFilters.drafts} />
                                <span class="filter-label-text">Don't show drafts</span>
                            </label>
                            <label class={`filter-label ${layout.labelPad}`}>
                                <input type="radio" name="draft_filter" value="include" class="h-3.5 w-3.5 border-soft bg-black/40 text-(--accent) focus:ring-(--accent)" bind:group={activeFilters.drafts} />
                                <span class="filter-label-text">Include drafts</span>
                            </label>
                            <label class={`filter-label ${layout.labelPad}`}>
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
                            class={`filter-section-header ${layout.headerPad}`}
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
                                <div class={`filter-section-body ${layout.contentPad}`}>
                            <div class={`flex flex-col ${layout.sectionGap}`}>
                                <label class={`filter-label ${layout.labelPad}`}>
                                    <input type="radio" name="review_filter" value="pending" checked={!activeFilters.showReviewed} onchange={() => { activeFilters = { ...activeFilters, showReviewed: false }; }} class="h-3.5 w-3.5 border-soft bg-black/40 text-(--accent) focus:ring-(--accent)" />
                                    <span class="filter-label-text">Only pending review</span>
                                </label>
                                <label class={`filter-label ${layout.labelPad}`}>
                                    <input type="radio" name="review_filter" value="all" checked={activeFilters.showReviewed} onchange={() => { activeFilters = { ...activeFilters, showReviewed: true }; }} class="h-3.5 w-3.5 border-soft bg-black/40 text-(--accent) focus:ring-(--accent)" />
                                    <span class="min-w-0 flex-1 text-soft">Show reviewed PRs</span>
                                </label>
                            </div>
                                </div>
                            {/if}
                        </div>
                    {/if}

                    {#if section.owners.show}
                        <div class="filter-section">
                            <button
                                class={`filter-section-header ${layout.headerPad}`}
                                onclick={() => toggleSection('owners')}
                            >
                                <span class="flex items-center gap-2">
                                        {#if expandedSections.owners}
                                            <ChevronDown class="icon-soft" />
                                        {:else}
                                            <ChevronRight class="icon-soft" />
                                        {/if}
                                        <span>Owners</span>
                                        {#if !expandedSections.owners && section.owners.singleLabel}
                                            <span class="filter-meta">· {section.owners.singleLabel}</span>
                                        {/if}
                                    </span>
                                    {#if activeFilters.owners.length > 0}
                                        <span class="filter-clear" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); activeFilters = { ...activeFilters, owners: [] }; }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); activeFilters = { ...activeFilters, owners: [] }; } }}>Clear</span>
                                    {/if}
                            </button>

                            {#if expandedSections.owners}
                                <div class={`filter-section-body ${layout.contentPad}`}>
                                    {#if section.owners.showSearch}
                                        <div class="mb-2">
                                            <input
                                                type="text"
                                                bind:value={sectionSearch.owners}
                                                placeholder="Search owners"
                                                class="filter-search-input"
                                            />
                                        </div>
                                    {/if}
                                    <div class={getSectionListClass(section.owners.filtered.length)}>
                                        {#each section.owners.filtered as owner (owner.login)}
                                            {@const ownerSelected = activeFilters.owners.includes(owner.login)}
                                            {@const ownerAvailable = section.owners.availableSet.has(owner.login)}
                                            <label class={`filter-label ${layout.labelPad} ${ownerSelected || ownerAvailable ? '' : 'filter-label-disabled'}`}>
                                                <input
                                                    type="checkbox"
                                                    class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                    checked={ownerSelected}
                                                    disabled={!ownerSelected && !ownerAvailable}
                                                    onchange={() => toggleFilter('owners', owner.login)}
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

                    {#if section.authors.show}
                        <div class="filter-section">
                            <button
                                class={`filter-section-header ${layout.headerPad}`}
                                onclick={() => toggleSection('authors')}
                            >
                                <span class="flex items-center gap-2">
                                        {#if expandedSections.authors}
                                            <ChevronDown class="icon-soft" />
                                        {:else}
                                            <ChevronRight class="icon-soft" />
                                        {/if}
                                        <span>Author</span>
                                        {#if !expandedSections.authors && section.authors.singleLabel}
                                            <span class="filter-meta">· {section.authors.singleLabel}</span>
                                        {/if}
                                    </span>
                                    {#if activeFilters.authors.length > 0}
                                        <span class="filter-clear" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); activeFilters = { ...activeFilters, authors: [] }; }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); activeFilters = { ...activeFilters, authors: [] }; } }}>Clear</span>
                                    {/if}
                            </button>

                            {#if expandedSections.authors}
                                <div class={`filter-section-body ${layout.contentPad}`}>
                                    {#if section.authors.showSearch}
                                        <div class="mb-2">
                                            <input
                                                type="text"
                                                bind:value={sectionSearch.authors}
                                                placeholder="Search PR authors"
                                                class="filter-search-input"
                                            />
                                        </div>
                                    {/if}
                                    <div class={getSectionListClass(section.authors.filtered.length)}>
                                        {#each section.authors.filtered as author (author.login)}
                                            {@const authorSelected = activeFilters.authors.includes(author.login)}
                                            {@const authorAvailable = section.authors.availableSet.has(author.login)}
                                            <label class={`filter-label ${layout.labelPad} ${authorSelected || authorAvailable ? '' : 'filter-label-disabled'}`}>
                                                <input
                                                    type="checkbox"
                                                    class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                    checked={authorSelected}
                                                    disabled={!authorSelected && !authorAvailable}
                                                    onchange={() => toggleFilter('authors', author.login)}
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

                    {#if section.repos.show}
                        <div class="filter-section">
                            <button
                                class={`filter-section-header ${layout.headerPad}`}
                                onclick={() => toggleSection('repos')}
                            >
                                <span class="flex items-center gap-2">
                                        {#if expandedSections.repos}
                                            <ChevronDown class="icon-soft" />
                                        {:else}
                                            <ChevronRight class="icon-soft" />
                                        {/if}
                                        <span>Repositories</span>
                                        {#if !expandedSections.repos && section.repos.singleLabel}
                                            <span class="filter-meta">· {section.repos.singleLabel}</span>
                                        {/if}
                                    </span>
                                    {#if activeFilters.repos.length > 0}
                                        <span class="filter-clear" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); activeFilters = { ...activeFilters, repos: [] }; }} onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); activeFilters = { ...activeFilters, repos: [] }; } }}>Clear</span>
                                    {/if}
                                </button>

                            {#if expandedSections.repos}
                                <div class={`filter-section-body ${layout.contentPad}`}>
                                    {#if section.repos.showSearch}
                                        <div class="mb-2">
                                            <input
                                                type="text"
                                                bind:value={sectionSearch.repos}
                                                placeholder="Search repositories"
                                                class="filter-search-input"
                                            />
                                        </div>
                                    {/if}
                                    <div class={getSectionListClass(section.repos.filtered.length)}>
                                        {#each section.repos.filtered as repo (repo.fullName)}
                                            {@const repoSelected = activeFilters.repos.includes(repo.fullName)}
                                            {@const repoAvailable = section.repos.availableSet.has(repo.fullName)}
                                            <label class={`filter-label ${layout.labelPad} ${repoSelected || repoAvailable ? '' : 'filter-label-disabled'}`}>
                                                <input
                                                    type="checkbox"
                                                    class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                    checked={repoSelected}
                                                    disabled={!repoSelected && !repoAvailable}
                                                    onchange={() => toggleFilter('repos', repo.fullName)}
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
