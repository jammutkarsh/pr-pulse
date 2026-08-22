import browser from 'webextension-polyfill';
import type { RuntimeMessage } from './types';

type CloneableValue = null | undefined | string | number | boolean | CloneableValue[] | { [key: string]: CloneableValue };
type AsyncLike<T> = T | Promise<T>;

const extensionBrowser = browser;

export type StorageChangeMap = Record<string, browser.Storage.StorageChange>;
export type StorageOnChangedListener = Parameters<typeof extensionBrowser.storage.onChanged.addListener>[0];
export type RuntimeOnInstalledListener = Parameters<typeof extensionBrowser.runtime.onInstalled.addListener>[0];
export type RuntimeOnStartupListener = Parameters<typeof extensionBrowser.runtime.onStartup.addListener>[0];
export type RuntimeOnMessageListener = (message: unknown, sender: browser.Runtime.MessageSender) => void | Promise<unknown>;
export type AlarmsOnAlarmListener = Parameters<typeof extensionBrowser.alarms.onAlarm.addListener>[0];
export type Unsubscribe = () => void;

function toPlainData<T>(value: T): T {
	return normalizeCloneableValue(value, new WeakMap()) as T;
}

function normalizeObject(value: object, seen: WeakMap<object, unknown>): CloneableValue {
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

	return normalizeObject(value, seen);
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

function logExtensionApiError(context: string, error: unknown): void {
	console.error(`Extension API error in ${context}:`, error);
}

function wrapListener<TArgs extends unknown[], TResult>(context: string, listener: (...args: TArgs) => AsyncLike<TResult>) {
	return (...args: TArgs): AsyncLike<TResult> => {
		try {
			const result = listener(...args);
			if (result instanceof Promise) {
				return result.catch((error) => {
					logExtensionApiError(context, error);
					throw error;
				}) as Promise<TResult>;
			}

			return result;
		} catch (error) {
			logExtensionApiError(context, error);
			throw error;
		}
	};
}

/** Callers unsubscribe with the returned handle, so nobody has to hold on to the listener itself. */
export function storageOnChangedAddListener(listener: StorageOnChangedListener): Unsubscribe {
	extensionBrowser.storage.onChanged.addListener(listener);
	return () => extensionBrowser.storage.onChanged.removeListener(listener);
}

export function runtimeOnInstalledAddListener(listener: RuntimeOnInstalledListener): void {
	extensionBrowser.runtime.onInstalled.addListener(wrapListener('runtime.onInstalled', listener));
}

export function runtimeOnStartupAddListener(listener: RuntimeOnStartupListener): void {
	extensionBrowser.runtime.onStartup.addListener(wrapListener('runtime.onStartup', listener));
}

export function runtimeOnMessageAddListener(listener: RuntimeOnMessageListener): void {
	extensionBrowser.runtime.onMessage.addListener(wrapListener('runtime.onMessage', listener));
}

export function alarmsOnAlarmAddListener(listener: AlarmsOnAlarmListener): void {
	extensionBrowser.alarms.onAlarm.addListener(wrapListener('alarms.onAlarm', listener));
}
