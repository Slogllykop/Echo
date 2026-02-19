import type { EchoRule } from "@/lib/types";

const DB_NAME = "echo-rules-db";
const DB_VERSION = 1;
const RULES_STORE = "rules";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
}

function sortRules(rules: EchoRule[]): EchoRule[] {
    return [...rules].sort((firstRule, secondRule) => {
        if (firstRule.order !== secondRule.order) {
            return firstRule.order - secondRule.order;
        }
        return secondRule.updatedAt - firstRule.updatedAt;
    });
}

let dbPromise: Promise<IDBDatabase> | null = null;

async function openDatabase(): Promise<IDBDatabase> {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(RULES_STORE)) {
                const store = database.createObjectStore(RULES_STORE, { keyPath: "id" });
                store.createIndex("order", "order", { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
}

export async function listRules(): Promise<EchoRule[]> {
    const database = await openDatabase();
    const transaction = database.transaction(RULES_STORE, "readonly");
    const store = transaction.objectStore(RULES_STORE);
    const result = await requestToPromise(store.getAll() as IDBRequest<EchoRule[]>);
    await transactionDone(transaction);
    return sortRules(result);
}

export async function upsertRule(rule: EchoRule): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(RULES_STORE, "readwrite");
    transaction.objectStore(RULES_STORE).put(rule);
    await transactionDone(transaction);
}

export async function deleteRule(ruleId: string): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(RULES_STORE, "readwrite");
    transaction.objectStore(RULES_STORE).delete(ruleId);
    await transactionDone(transaction);
}

export async function toggleRule(ruleId: string, enabled: boolean): Promise<boolean> {
    const database = await openDatabase();
    const transaction = database.transaction(RULES_STORE, "readwrite");
    const store = transaction.objectStore(RULES_STORE);
    const existingRule = await requestToPromise(
        store.get(ruleId) as IDBRequest<EchoRule | undefined>,
    );

    if (!existingRule) {
        transaction.abort();
        return false;
    }

    store.put({
        ...existingRule,
        enabled,
        updatedAt: Date.now(),
    });
    await transactionDone(transaction);
    return true;
}

export async function toggleAllRules(enabled: boolean): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(RULES_STORE, "readwrite");
    const store = transaction.objectStore(RULES_STORE);
    const allRules = await requestToPromise(store.getAll() as IDBRequest<EchoRule[]>);
    const now = Date.now();

    for (const rule of allRules) {
        if (rule.enabled === enabled) {
            continue;
        }

        store.put({
            ...rule,
            enabled,
            updatedAt: now,
        });
    }

    await transactionDone(transaction);
}

export async function reorderRules(ruleIds: string[]): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(RULES_STORE, "readwrite");
    const store = transaction.objectStore(RULES_STORE);
    const allRules = await requestToPromise(store.getAll() as IDBRequest<EchoRule[]>);
    const orderLookup = new Map(ruleIds.map((ruleId, index) => [ruleId, index]));
    const now = Date.now();

    for (const rule of allRules) {
        const nextOrder = orderLookup.get(rule.id);
        if (nextOrder === undefined || nextOrder === rule.order) {
            continue;
        }
        store.put({
            ...rule,
            order: nextOrder,
            updatedAt: now,
        });
    }

    await transactionDone(transaction);
}
