import { storageLocalClear, storageLocalGet, storageLocalRemove, storageLocalSet } from './extension-api';
import { createStorage, type KeyValueStore } from './storage-core';

/** The extension's own adapter at the KeyValueStore seam. `storage.test.ts` supplies the other. */
const extensionStore: KeyValueStore = {
	get: (keys) => storageLocalGet(keys),
	set: (items) => storageLocalSet(items),
	remove: (keys) => storageLocalRemove(keys),
	clear: () => storageLocalClear(),
};

export const storage = createStorage(extensionStore);
