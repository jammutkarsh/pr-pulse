<script lang="ts">
    import { tick } from 'svelte';
    import { onDestroy, onMount } from 'svelte';
    import { ChevronDown, ChevronRight, ListFilter, Search, X } from 'lucide-svelte';
    import type { PullRequestRepoOwner } from '../../lib/types';

    type PopupFilters = {
        owners: string[];
        repos: string[];
        ageRange: string;
    };

    type RepoFilterOption = {
        fullName: string;
        owner: string;
        ownerType: PullRequestRepoOwner['type'];
        name: string;
    };

    type OwnerFilterOption = {
        login: string;
        type: PullRequestRepoOwner['type'];
    };

    type FilterChip = {
        key: string;
        label: string;
        value: string;
        onRemove: () => void;
    };

    const EMPTY_FILTERS: PopupFilters = {
        owners: [],
        repos: [],
        ageRange: '',
    };

    /*
    const AGE_OPTIONS = [
        { value: '24h', label: '24H' },
        { value: '7d', label: '7D' },
        { value: '14d', label: '14D' },
        { value: '1m', label: '1M' },
        { value: '3m', label: '3M' },
        { value: 'gt3m', label: '> 3M' },
    ];
    */

    interface Props {
        query?: string;
        activeFilters?: PopupFilters;
        availableRepos?: RepoFilterOption[];
        availableOwners?: OwnerFilterOption[];
        isSearchOpen?: boolean;
        isFilterOpen?: boolean;
    }

    let {
        query = $bindable(''),
        activeFilters = $bindable({ ...EMPTY_FILTERS }),
        availableRepos = [] as RepoFilterOption[],
        availableOwners = [] as OwnerFilterOption[],
        isSearchOpen = $bindable(false),
        isFilterOpen = $bindable(false),
    }: Props = $props();

    let expandedSections = $state({
        owners: false,
        repos: false,
        // age: false,
    });

    let searchInput = $state<HTMLInputElement | null>(null);
    let surfaceElement = $state<HTMLDivElement | null>(null);
    let ignoreOutsideClick = false;
    let wasSearchOpen = false;
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

    function toggleOwner(owner: string) {
        const owners = activeFilters.owners.includes(owner)
            ? activeFilters.owners.filter((entry) => entry !== owner)
            : [...activeFilters.owners, owner];

        activeFilters = { ...activeFilters, owners };
    }

    /*
    function selectAgeRange(value: string) {
        activeFilters = {
            ...activeFilters,
            ageRange: activeFilters.ageRange === value ? '' : value,
        };
    }
    */

    function clearSearch() {
        query = '';
    }

    function closeSearchSurface() {
        clearOutsideClickGuard();
        isSearchOpen = false;
        isFilterOpen = false;
    }

    function clearFilters() {
        activeFilters = { ...EMPTY_FILTERS };
    }

    function getOwnerDisplay(ownerLogin: string) {
        const owner = availableOwners.find((entry) => entry.login === ownerLogin);
        return owner ? getOwnerTypeLabel(owner.type) : 'Owner';
    }

    function getRepoDisplay(repoFullName: string) {
        const repo = availableRepos.find((entry) => entry.fullName === repoFullName);

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
    // Age filter is temporarily disabled. Restore the commented ageRange count when re-enabling it.
    // let activeFilterCount = $derived(activeFilters.owners.length + activeFilters.repos.length + Number(Boolean(activeFilters.ageRange)));
    let activeFilterCount = $derived(activeFilters.owners.length + activeFilters.repos.length);
    let hasActiveFilters = $derived(activeFilterCount > 0);
    let selectedFilterChips = $derived<FilterChip[]>([
        ...activeFilters.owners.map((ownerLogin) => ({
            key: `owner:${ownerLogin}`,
            label: ownerLogin,
            value: getOwnerDisplay(ownerLogin),
            onRemove: () => toggleOwner(ownerLogin),
        })),
        ...activeFilters.repos.map((repoFullName) => ({
            key: `repo:${repoFullName}`,
            label: getRepoDisplay(repoFullName).name,
            value: getRepoDisplay(repoFullName).owner,
            onRemove: () => toggleRepo(repoFullName),
        })),
        /*
        ...(activeFilters.ageRange
            ? [
                    {
                        key: `age:${activeFilters.ageRange}`,
                        label: 'Age',
                        value: AGE_OPTIONS.find((option) => option.value === activeFilters.ageRange)?.label || activeFilters.ageRange,
                        onRemove: () => selectAgeRange(activeFilters.ageRange),
                    },
                ]
            : []),
        */
    ]);

    $effect(() => {
        syncSearchSurfaceState(isSearchOpen);
    });
</script>

{#if isSearchOpen}
<div bind:this={surfaceElement} class="relative z-20 border-b border-soft px-4 py-2.5 sm:px-4">
    <div class="space-y-2">
            <div class="flex items-center gap-2">
                <div class="relative min-w-0 flex-1">
                    <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-soft" />
                    <input
                        bind:this={searchInput}
                        type="text"
                        bind:value={query}
                        placeholder="Search PRs, branches, repos, jira"
                        class="h-9 w-full rounded-md border border-soft bg-(--bg-panel-strong) py-1.5 pl-9 pr-9 text-sm text-white placeholder-dim outline-none transition focus:border-(--accent) focus:ring-1 focus:ring-(--accent)"
                    />
                    {#if hasQuery}
                        <button class="unstyled-button absolute right-2 top-1/2 -translate-y-1/2 text-soft hover:text-white" onclick={clearSearch} aria-label="Clear search">
                            <X class="h-4 w-4" />
                        </button>
                    {/if}
                </div>

                <button
                    class={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition ${isFilterOpen || hasActiveFilters ? 'border-(--accent) bg-(--accent)/10 text-(--accent) shadow-[0_0_0_1px_rgba(55,148,255,0.22),0_0_16px_rgba(55,148,255,0.14)]' : 'border-soft bg-transparent text-soft hover:border-strong hover:bg-(--bg-muted) hover:text-white'}`}
                    onclick={toggleFilterPanel}
                    aria-label="Toggle filters"
                    title="Toggle filters"
                >
                    <ListFilter class="h-4 w-4" />
                </button>
            </div>

        {#if isFilterOpen}
            <div class="absolute left-4 right-4 top-full z-30 mt-2 max-h-88 overflow-y-auto rounded-xl border border-soft bg-(--bg-panel-strong) p-3 shadow-lg sm:left-4 sm:right-4">
                <div class="mb-3 flex items-center justify-between gap-3">
                    <!-- <p class="shrink-0 text-sm font-semibold text-white">Filters</p> -->
                    <div class="min-w-0 flex-1 overflow-x-auto scroll-thin">
                        {#if hasActiveFilters}
                            <div class="flex min-w-max items-center gap-2 px-1">
                                {#each selectedFilterChips as chip (chip.key)}
                                    <button
                                        class="unstyled-button inline-flex items-center gap-2 rounded-full border border-soft bg-(--bg-muted) px-2.5 py-1 text-[11px] text-soft transition hover:border-(--accent) hover:text-white"
                                        onclick={chip.onRemove}
                                        title={`Remove ${chip.label} filter`}
                                    >
                                        <span class="font-medium text-white">{chip.label}</span>
                                        <span class="truncate text-soft">{chip.value}</span>
                                        <X class="h-3.5 w-3.5 shrink-0" />
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                    <div class="shrink-0 flex items-center gap-3">
                        {#if hasActiveFilters}
                            <button class="unstyled-button text-xs font-medium text-(--accent) hover:underline" onclick={clearFilters}>Clear</button>
                        {/if}
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="overflow-hidden rounded-lg border border-soft">
                        <button
                            class="unstyled-button flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-(--bg-muted)"
                            onclick={() => toggleSection('owners')}
                        >
                            <span class="flex items-center gap-2">
                                    {#if expandedSections.owners}
                                        <ChevronDown class="h-4 w-4 text-soft" />
                                    {:else}
                                        <ChevronRight class="h-4 w-4 text-soft" />
                                    {/if}
                                    <span>Owners</span>
                                </span>
                        </button>

                        {#if expandedSections.owners}
                            <div class="border-t border-soft px-3 py-2">
                                    {#if availableOwners.length === 0}
                                        <p class="text-xs text-soft">No owners available in this tab.</p>
                                    {:else}
                                        <div class="max-h-40 space-y-1 overflow-y-auto pr-1 scroll-thin">
                                            {#each availableOwners as owner (owner.login)}
                                                <label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-white transition hover:bg-(--bg-muted)">
                                                    <input
                                                        type="checkbox"
                                                        class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                        checked={activeFilters.owners.includes(owner.login)}
                                                        onchange={() => toggleOwner(owner.login)}
                                                    />
                                                    <span class="min-w-0 flex-1 truncate">{owner.login}</span>
                                                    {#if owner.type !== 'unknown'}
                                                        <span class="shrink-0 text-[11px] uppercase tracking-[0.08em] text-soft">{getOwnerTypeLabel(owner.type)}</span>
                                                    {/if}
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
                            onclick={() => toggleSection('repos')}
                        >
                            <span class="flex items-center gap-2">
                                    {#if expandedSections.repos}
                                        <ChevronDown class="h-4 w-4 text-soft" />
                                    {:else}
                                        <ChevronRight class="h-4 w-4 text-soft" />
                                    {/if}
                                    <span>Repositories</span>
                                </span>
                            </button>

                        {#if expandedSections.repos}
                            <div class="border-t border-soft px-3 py-2">
                                    {#if availableRepos.length === 0}
                                        <p class="text-xs text-soft">No repositories available in this tab.</p>
                                    {:else}
                                        <div class="max-h-48 space-y-1 overflow-y-auto pr-1 scroll-thin">
                                            {#each availableRepos as repo (repo.fullName)}
                                                <label class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm text-white transition hover:bg-(--bg-muted)">
                                                    <input
                                                        type="checkbox"
                                                        class="rounded border-soft bg-black/40 text-(--accent) focus:ring-(--accent)"
                                                        checked={activeFilters.repos.includes(repo.fullName)}
                                                        onchange={() => toggleRepo(repo.fullName)}
                                                    />
                                                    <span class="min-w-0 flex-1 truncate" title={repo.fullName}>{repo.name}</span>
                                                    <span class="shrink-0 text-[11px] uppercase tracking-[0.08em] text-soft">{repo.owner}</span>
                                                </label>
                                            {/each}
                                        </div>
                                    {/if}
                            </div>
                        {/if}
                    </div>

                    <!--
                    <div class="overflow-hidden rounded-lg border border-soft">
                        <button
                            class="unstyled-button flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-(--bg-muted)"
                            on:click={() => toggleSection('age')}
                        >
                            <span class="flex items-center gap-2">
                                    {#if expandedSections.age}
                                        <ChevronDown class="h-4 w-4 text-soft" />
                                    {:else}
                                        <ChevronRight class="h-4 w-4 text-soft" />
                                    {/if}
                                    <span>Age</span>
                                </span>
                            </button>

                        {#if expandedSections.age}
                            <div class="border-t border-soft px-3 py-2">
                                <div class="grid grid-cols-3 gap-2">
                                    {#each AGE_OPTIONS as option (option.value)}
                                        <button
                                            class={`unstyled-button rounded-md border px-2 py-1.5 text-center text-xs font-medium transition ${activeFilters.ageRange === option.value ? 'border-(--accent) bg-(--accent)/10 text-(--accent)' : 'border-soft text-soft hover:bg-(--bg-muted) hover:text-white'}`}
                                            on:click={() => selectAgeRange(option.value)}
                                        >
                                            {option.label}
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>
                    -->

                </div>
            </div>
        {/if}
    </div>
</div>
{/if}
