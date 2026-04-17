import browser from 'webextension-polyfill';
import type { RuntimeMessage } from './types';

type CloneableValue = null | undefined | string | number | boolean | CloneableValue[] | { [key: string]: CloneableValue };

export const extensionBrowser = browser;

export type StorageChangeMap = Record<string, browser.Storage.StorageChange>;

export function toPlainData<T>(value: T): T {
	return normalizeCloneableValue(value, new WeakMap()) as T;
}

function normalizeCloneableValue(value: unknown, seen: WeakMap<object, unknown>): CloneableValue {
	if (value == null) {
		return value as null | undefined;
	}

	if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => normalizeCloneableValue(entry, seen));
	}

	if (typeof value !== 'object') {
		return JSON.parse(JSON.stringify(value)) as CloneableValue;
	}

	if (seen.has(value)) {
		return seen.get(value) as CloneableValue;
	}

	const plainObject: Record<string, CloneableValue> = {};
	seen.set(value, plainObject);

	for (const [key, entry] of Object.entries(value)) {
		plainObject[key] = normalizeCloneableValue(entry, seen);
	}

	return plainObject;
}

export function runtimeSendMessage<TResponse = unknown>(message: RuntimeMessage): Promise<TResponse> {
	return extensionBrowser.runtime.sendMessage(toPlainData(message)) as Promise<TResponse>;
}

export function runtimeGetURL(path: string): string {
	return extensionBrowser.runtime.getURL(path);
}

export function tabsCreate(createProperties: browser.Tabs.CreateCreatePropertiesType): Promise<browser.Tabs.Tab> {
	return extensionBrowser.tabs.create(createProperties);
}

export function actionSetBadgeText(details: browser.Action.SetBadgeTextDetailsType): Promise<void> {
	return extensionBrowser.action.setBadgeText(details);
}

export function actionSetBadgeBackgroundColor(details: browser.Action.SetBadgeBackgroundColorDetailsType): Promise<void> {
	return extensionBrowser.action.setBadgeBackgroundColor(details);
}

export function storageLocalGet<T = unknown>(keys: string[]): Promise<Record<string, T>> {
	return extensionBrowser.storage.local.get(keys) as Promise<Record<string, T>>;
}

export function storageLocalSet(items: Record<string, unknown>): Promise<void> {
	return extensionBrowser.storage.local.set(toPlainData(items));
}

export function storageLocalRemove(keys: string[]): Promise<void> {
	return extensionBrowser.storage.local.remove(keys);
}

export function storageLocalClear(): Promise<void> {
	return extensionBrowser.storage.local.clear();
}

export function alarmsGet(name: string): Promise<browser.Alarms.Alarm | undefined> {
	return extensionBrowser.alarms.get(name);
}

export function alarmsCreate(name: string, alarmInfo: browser.Alarms.CreateAlarmInfoType): void {
	extensionBrowser.alarms.create(name, alarmInfo);
}

export function alarmsClear(name: string): Promise<boolean> {
	return extensionBrowser.alarms.clear(name);
}