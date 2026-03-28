<svelte:options runes={false} />

<script>
    import { ChevronDown, ChevronRight, ListFilter, Search, X } from 'lucide-svelte';

    const EMPTY_FILTERS = {
        repos: [],
        orgs: [],
        myRepo: false,
        checksPassing: false,
        readyToMerge: false,
    };

    export let query = '';
    export let activeFilters = { ...EMPTY_FILTERS };
    export let availableRepos = [];
    export let availableOrgs = [];

    let isSearchOpen = false;
    let isFilterOpen = false;
    let expandedSections = {
        orgs: true,
        repos: false,
    };

    $: hasQuery = query.trim().length > 0;
    $: activeFilterCount =
        activeFilters.repos.length +
        activeFilters.orgs.length +
        Number(activeFilters.myRepo) +
        Number(activeFilters.checksPassing) +
        Number(activeFilters.readyToMerge);
    $: hasActiveFilters = activeFilterCount > 0;
    $: hasActiveCriteria = hasQuery || hasActiveFilters;
    $: if (hasQuery) {
        isSearchOpen = true;
    }

    function closeFilterPanel() {
        isFilterOpen = false;
    }

    function toggleSearch() {
        if (!isSearchOpen) {
            isSearchOpen = true;
            isFilterOpen = true;
            return;
        }

        isSearchOpen = false;
    }

    function toggleFilterPanel() {
        isFilterOpen = !isFilterOpen;
    }

    function toggleSection(section) {
        expandedSections = {
            ...expandedSections,
            [section]: !expandedSections[section],
        };
    }

    function toggleRepo(repo) {
        const repos = activeFilters.repos.includes(repo)
            ? activeFilters.repos.filter((entry) => entry !== repo)
            : [...activeFilters.repos, repo];

        activeFilters = { ...activeFilters, repos };
    }

    function toggleOrg(org) {
        const orgs = activeFilters.orgs.includes(org)
            ? activeFilters.orgs.filter((entry) => entry !== org)
            : [...activeFilters.orgs, org];

        activeFilters = { ...activeFilters, orgs };
    }

    function toggleFilter(key) {
        activeFilters = { ...activeFilters, [key]: !activeFilters[key] };
    }

    function clearSearch() {
        query = '';
    }

    function clearFilters() {
        activeFilters = { ...EMPTY_FILTERS };
    }
</script>

<div class="border-b border-soft px-4 py-2.5 sm:px-4">
    <div class="relative flex items-center gap-2">
        <div class="relative shrink-0">
            <button
                class={`relative inline-flex h-9 w-9 items-center justify-center rounded-md border transition ${isFilterOpen || hasActiveFilters ? 'border-(--accent) bg-(--accent)/10 text-(--accent)' : 'border-soft bg-transparent text-soft hover:border-strong hover:bg-(--bg-muted) hover:text-white'}`}
                on:click={toggleFilterPanel}
                aria-label="Open filters"
                title="Open filters"
            >
                <ListFilter class="h-4 w-4" />
                {#if activeFilterCount > 0}
                    <span class="absolute -right-1 -top-1 min-w-[1.1rem] rounded-full bg-(--accent) px-1 text-center text-[10px] font-semibold leading-4 text-white">{activeFilterCount}</span>
                {/if}
            </button>

            {#if isFilterOpen}
                <!-- svelte-ignore a11y-click-events-have-key-events, a11y-no-static-element-interactions -->
                <div class="fixed inset-0 z-10" on:click={closeFilterPanel}></div>
                <div class="absolute left-0 top-full z-20 mt-2 w-[18rem] rounded-xl border border-soft bg-(--bg-panel-strong) p-3 shadow-lg">
                    <div class="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <p class="text-sm font-semibold text-white">Filters</p>
                            <p class="text-xs text-soft">Persisted filters are useful for org and repo slices.</p>
                        </div>
                        {#if hasActiveFilters}
                            <button class="unstyled-button text-xs font-medium text-(--accent) hover:underline" on:click={clearFilters}>Clear</button>
                        {/if}
                    </div>

                    <div class="space-y-2">
                        <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-soft px-3 py-2 text-sm text-white transition hover:bg-(--bg-muted)">
                            <input
                                type="checkbox"
                                class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                checked={activeFilters.myRepo}
                                on:change={() => toggleFilter('myRepo')}
                            />
                            <span>My Repo</span>
                        </label>

                        <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-soft px-3 py-2 text-sm text-white transition hover:bg-(--bg-muted)">
                            <input
                                type="checkbox"
                                class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                checked={activeFilters.checksPassing}
                                on:change={() => toggleFilter('checksPassing')}
                            />
                            <span>Checks Passing</span>
                        </label>

                        <label class="flex cursor-pointer items-center gap-3 rounded-lg border border-soft px-3 py-2 text-sm text-white transition hover:bg-(--bg-muted)">
                            <input
                                type="checkbox"
                                class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                checked={activeFilters.readyToMerge}
                                on:change={() => toggleFilter('readyToMerge')}
                            />
                            <span>Ready to Merge</span>
                        </label>

                        <div class="overflow-hidden rounded-lg border border-soft">
                            <button
                                class="unstyled-button flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-(--bg-muted)"
                                on:click={() => toggleSection('orgs')}
                            >
                                <span class="flex items-center gap-2">
                                    {#if expandedSections.orgs}
                                        <ChevronDown class="h-4 w-4 text-soft" />
                                    {:else}
                                        <ChevronRight class="h-4 w-4 text-soft" />
                                    {/if}
                                    <span>Organizations</span>
                                </span>
                                {#if activeFilters.orgs.length > 0}
                                    <span class="rounded-full bg-(--accent)/10 px-2 py-0.5 text-[11px] text-(--accent)">{activeFilters.orgs.length}</span>
                                {/if}
                            </button>

                            {#if expandedSections.orgs}
                                <div class="border-t border-soft px-3 py-2">
                                    {#if availableOrgs.length === 0}
                                        <p class="text-xs text-soft">No organizations available in this tab.</p>
                                    {:else}
                                        <div class="max-h-40 space-y-1 overflow-y-auto pr-1 scroll-thin">
                                            {#each availableOrgs as org (org)}
                                                <label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-white transition hover:bg-(--bg-muted)">
                                                    <input
                                                        type="checkbox"
                                                        class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                        checked={activeFilters.orgs.includes(org)}
                                                        on:change={() => toggleOrg(org)}
                                                    />
                                                    <span class="truncate">{org}</span>
                                                </label>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        <div class="overflow-hidden rounded-lg border border-soft">
                            <button
                                class="unstyled-button flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-(--bg-muted)"
                                on:click={() => toggleSection('repos')}
                            >
                                <span class="flex items-center gap-2">
                                    {#if expandedSections.repos}
                                        <ChevronDown class="h-4 w-4 text-soft" />
                                    {:else}
                                        <ChevronRight class="h-4 w-4 text-soft" />
                                    {/if}
                                    <span>Repositories</span>
                                </span>
                                {#if activeFilters.repos.length > 0}
                                    <span class="rounded-full bg-(--accent)/10 px-2 py-0.5 text-[11px] text-(--accent)">{activeFilters.repos.length}</span>
                                {/if}
                            </button>

                            {#if expandedSections.repos}
                                <div class="border-t border-soft px-3 py-2">
                                    {#if availableRepos.length === 0}
                                        <p class="text-xs text-soft">No repositories available in this tab.</p>
                                    {:else}
                                        <div class="max-h-48 space-y-1 overflow-y-auto pr-1 scroll-thin">
                                            {#each availableRepos as repo (repo)}
                                                <label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-white transition hover:bg-(--bg-muted)">
                                                    <input
                                                        type="checkbox"
                                                        class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                        checked={activeFilters.repos.includes(repo)}
                                                        on:change={() => toggleRepo(repo)}
                                                    />
                                                    <span class="truncate">{repo}</span>
                                                </label>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/if}
        </div>

        {#if isSearchOpen}
            <div class="relative min-w-0 flex-1">
                <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
                <input
                    type="text"
                    bind:value={query}
                    placeholder="Search PRs, branches, repos, jira"
                    class="h-9 w-full rounded-md border border-soft bg-(--bg-panel-strong) py-1.5 pl-9 pr-9 text-sm text-white placeholder-dim outline-none transition focus:border-(--accent) focus:ring-1 focus:ring-(--accent)"
                />
                {#if hasQuery}
                    <button class="unstyled-button absolute right-2 top-1/2 -translate-y-1/2 text-soft hover:text-white" on:click={clearSearch} aria-label="Clear search">
                        <X class="h-4 w-4" />
                    </button>
                {/if}
            </div>
        {/if}

        <button
            class={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition ${isSearchOpen || hasActiveCriteria ? 'border-(--accent) bg-(--accent)/10 text-(--accent)' : 'border-soft bg-transparent text-soft hover:border-strong hover:bg-(--bg-muted) hover:text-white'}`}
            on:click={toggleSearch}
            aria-label="Toggle search"
            title="Toggle search"
        >
            <Search class="h-4 w-4" />
        </button>
    </div>
</div>
