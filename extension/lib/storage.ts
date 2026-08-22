import {
	storageLocalClear,
	storageLocalGet,
	storageLocalRemove,
	storageLocalSet,
	storageOnChangedAddListener,
	type Unsubscribe,
} from './extension-api';
import { createStorage, STORAGE_KEYS, type KeyValueStore } from './storage-core';

/** The extension's own adapter at the KeyValueStore seam. `storage.test.ts` supplies the other. */
const extensionStore: KeyValueStore = {
	get: (keys) => storageLocalGet(keys),
	set: (items) => storageLocalSet(items),
	remove: (keys) => storageLocalRemove(keys),
	clear: () => storageLocalClear(),
};

export const storage = createStorage(extensionStore);

/**
 * Filters changed on disk. The worker owns the badge, and the popup's writes are the only thing that
 * moves the number while it is open — so the worker watches the key rather than being told the count.
 * Keeps the storage key inside this module, where the rest of it already lives.
 */
export function onFiltersChanged(handler: () => void): Unsubscribe {
	return storageOnChangedAddListener((changes, areaName) => {
		if (areaName === 'local' && STORAGE_KEYS.FILTERS in changes) {
			handler();
		}
	});
}
