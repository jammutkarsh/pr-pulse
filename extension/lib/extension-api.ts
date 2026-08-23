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

export interface NotificationContent {
	title: string;
	message: string;
	/** Button 0's label. Button 1 is always Dismiss. Chrome only — Firefox draws no buttons. */
	action: string;
}

/**
 * `buttons` and `requireInteraction` are Chrome-only, and Firefox's schema validation *rejects* an
 * unknown property rather than ignoring it — so the options object is built per target rather than
 * passed through and hoped for.
 */
export function notificationsCreate(id: string, content: NotificationContent): Promise<string> {
	const options = {
		type: 'basic' as const,
		iconUrl: runtimeGetURL('icons/icon128.png'),
		title: content.title,
		message: content.message,
	};

	if (__BROWSER_TARGET__ === 'firefox') {
		return extensionBrowser.notifications.create(id, options);
	}

	return extensionBrowser.notifications.create(id, {
		...options,
		buttons: [{ title: content.action }, { title: 'Dismiss' }],
		requireInteraction: true,
	} as browser.Notifications.CreateNotificationOptions);
}

export function notificationsClear(id: string): Promise<boolean> {
	return extensionBrowser.notifications.clear(id);
}

export function notificationsOnClickedAddListener(listener: (notificationId: string) => void): void {
	extensionBrowser.notifications.onClicked.addListener(wrapListener('notifications.onClicked', listener));
}

/** Firefox has no `onButtonClicked`; the guard is what keeps the worker from throwing on load there. */
export function notificationsOnButtonClickedAddListener(listener: (notificationId: string, buttonIndex: number) => void): void {
	const event = extensionBrowser.notifications.onButtonClicked;
	if (!event) {
		return;
	}

	event.addListener(wrapListener('notifications.onButtonClicked', listener));
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
