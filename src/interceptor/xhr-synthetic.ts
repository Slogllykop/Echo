export interface SyntheticXhrState {
    useSynthetic: boolean;
    readyState: number;
    status: number;
    statusText: string;
    responseType: XMLHttpRequestResponseType;
    responseText: string;
    response: unknown;
    responseURL: string;
    responseHeaders: Headers;
}

const syntheticXhrStateByInstance = new WeakMap<XMLHttpRequest, SyntheticXhrState>();
const patchedXhrInstances = new WeakSet<XMLHttpRequest>();

const xhrPrototype = XMLHttpRequest.prototype;
const originalXhrGetResponseHeader = xhrPrototype.getResponseHeader;
const originalXhrGetAllResponseHeaders = xhrPrototype.getAllResponseHeaders;

const readyStateDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "readyState");
const statusDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "status");
const statusTextDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "statusText");
const responseDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "response");
const responseTextDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "responseText");
const responseURLDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "responseURL");
export const responseTypeDescriptor = Object.getOwnPropertyDescriptor(xhrPrototype, "responseType");

export function getNativeXhrValue<T>(
    descriptor: PropertyDescriptor | undefined,
    xhr: XMLHttpRequest,
    fallbackValue: T,
): T {
    if (descriptor?.get) {
        return descriptor.get.call(xhr) as T;
    }
    return fallbackValue;
}

function createDefaultSyntheticState(xhr: XMLHttpRequest): SyntheticXhrState {
    return {
        useSynthetic: false,
        readyState: getNativeXhrValue(readyStateDescriptor, xhr, 0),
        status: getNativeXhrValue(statusDescriptor, xhr, 0),
        statusText: getNativeXhrValue(statusTextDescriptor, xhr, ""),
        responseType: getNativeXhrValue(responseTypeDescriptor, xhr, ""),
        responseText: "",
        response: "",
        responseURL: "",
        responseHeaders: new Headers(),
    };
}

export function getSyntheticState(xhr: XMLHttpRequest): SyntheticXhrState {
    let state = syntheticXhrStateByInstance.get(xhr);
    if (!state) {
        state = createDefaultSyntheticState(xhr);
        syntheticXhrStateByInstance.set(xhr, state);
    }
    return state;
}

export function resetSyntheticState(xhr: XMLHttpRequest): void {
    const state = getSyntheticState(xhr);
    state.useSynthetic = false;
    state.readyState = getNativeXhrValue(readyStateDescriptor, xhr, 0);
    state.status = getNativeXhrValue(statusDescriptor, xhr, 0);
    state.statusText = getNativeXhrValue(statusTextDescriptor, xhr, "");
    state.responseType = getNativeXhrValue(responseTypeDescriptor, xhr, "");
    state.responseText = "";
    state.response = "";
    state.responseURL = "";
    state.responseHeaders = new Headers();
}

export function installSyntheticXhrOverrides(xhr: XMLHttpRequest): void {
    if (patchedXhrInstances.has(xhr)) {
        return;
    }

    patchedXhrInstances.add(xhr);

    Object.defineProperties(xhr, {
        readyState: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.readyState;
                }
                return getNativeXhrValue(readyStateDescriptor, xhr, 0);
            },
        },
        status: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.status;
                }
                return getNativeXhrValue(statusDescriptor, xhr, 0);
            },
        },
        statusText: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.statusText;
                }
                return getNativeXhrValue(statusTextDescriptor, xhr, "");
            },
        },
        response: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.response;
                }
                return getNativeXhrValue(responseDescriptor, xhr, null);
            },
        },
        responseText: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.responseText;
                }
                return getNativeXhrValue(responseTextDescriptor, xhr, "");
            },
        },
        responseURL: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.responseURL;
                }
                return getNativeXhrValue(responseURLDescriptor, xhr, "");
            },
        },
        responseType: {
            configurable: true,
            get() {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.responseType;
                }
                return getNativeXhrValue(responseTypeDescriptor, xhr, "");
            },
            set(value: XMLHttpRequestResponseType) {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    state.responseType = value;
                    return;
                }
                responseTypeDescriptor?.set?.call(xhr, value);
            },
        },
        getResponseHeader: {
            configurable: true,
            value(name: string): string | null {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return state.responseHeaders.get(name);
                }
                return originalXhrGetResponseHeader.call(xhr, name);
            },
        },
        getAllResponseHeaders: {
            configurable: true,
            value(): string {
                const state = syntheticXhrStateByInstance.get(xhr);
                if (state?.useSynthetic) {
                    return Array.from(state.responseHeaders.entries())
                        .map(([key, value]) => `${key}: ${value}`)
                        .join("\r\n");
                }
                return originalXhrGetAllResponseHeaders.call(xhr);
            },
        },
    });
}

export function emitProgressEvent(xhr: XMLHttpRequest, type: string): void {
    xhr.dispatchEvent(new ProgressEvent(type));
}

export function emitReadyStateChange(xhr: XMLHttpRequest, nextReadyState: number): void {
    const state = getSyntheticState(xhr);
    state.readyState = nextReadyState;
    emitProgressEvent(xhr, "readystatechange");
}

export function emitSyntheticAbort(xhr: XMLHttpRequest): void {
    const state = getSyntheticState(xhr);
    state.useSynthetic = true;
    state.status = 0;
    state.statusText = "";
    state.responseText = "";
    state.response = "";
    state.responseURL = "";
    state.responseHeaders = new Headers();
    emitReadyStateChange(xhr, 4);
    emitProgressEvent(xhr, "abort");
    emitProgressEvent(xhr, "loadend");
}

export async function readSyntheticXhrBody(
    response: Response,
    responseType: XMLHttpRequestResponseType,
): Promise<{ response: unknown; responseText: string }> {
    if (responseType === "arraybuffer") {
        return { response: await response.arrayBuffer(), responseText: "" };
    }

    if (responseType === "blob") {
        return { response: await response.blob(), responseText: "" };
    }

    const responseText = await response.text();

    if (responseType === "json") {
        try {
            return {
                response: responseText ? (JSON.parse(responseText) as unknown) : null,
                responseText,
            };
        } catch {
            return { response: null, responseText };
        }
    }

    return { response: responseText, responseText };
}
