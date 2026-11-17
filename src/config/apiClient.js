const RESPONSE_TYPES = new Set(['json', 'text', 'blob', 'response', 'stream', 'none']);
const AUTH_MODES = new Set(['none', 'optional', 'required']);

export class ApiError extends Error {
    constructor(kind, message, status, options = {}) {
        super(message);
        this.name = 'ApiError';
        this.kind = kind;
        if (status !== undefined) this.status = status;
        this.hasDetail = options.hasDetail === true;
    }
}

function getApiBaseUrl() {
    const configured = import.meta.env.VITE_API_BASE_URL?.trim();
    if (!configured) return null;

    let url;
    try {
        url = new URL(configured);
    } catch {
        throw new ApiError('configuration', 'The configured API base URL is invalid.');
    }

    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash
    ) {
        throw new ApiError('configuration', 'The configured API base URL must be an HTTP(S) origin.');
    }
    return url.origin;
}

function resolveUrl(path, baseUrl) {
    if (typeof path !== 'string' || (!path.startsWith('/api/') && path !== '/api')) {
        throw new ApiError('request', 'API requests must use a relative /api path.');
    }

    let parsed;
    try {
        parsed = new URL(path, baseUrl || globalThis.location?.origin || 'http://localhost');
    } catch {
        throw new ApiError('request', 'The API request path is invalid.');
    }
    if (!parsed.pathname.startsWith('/api/') && parsed.pathname !== '/api') {
        throw new ApiError('request', 'API requests must remain under /api.');
    }
    if (parsed.hash) {
        throw new ApiError('request', 'API request paths cannot include a fragment.');
    }
    return baseUrl ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
}

function readAuthToken() {
    try {
        const token = globalThis.localStorage?.getItem('auth_token');
        return typeof token === 'string' && token.trim() ? token : null;
    } catch {
        throw new ApiError('storage', 'Unable to read the saved authentication session.');
    }
}

function createRequestLifecycle(signal, timeoutMs) {
    if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs < 0)) {
        throw new ApiError('request', 'Request timeout must be a non-negative number.');
    }

    if (signal?.aborted) {
        throw new ApiError('aborted', 'The request was cancelled.');
    }

    const needsController = Boolean(signal) || (timeoutMs !== undefined && timeoutMs > 0);
    const controller = needsController ? new AbortController() : null;
    let timedOut = false;
    let timeoutId;
    let onCallerAbort;

    if (signal && controller) {
        onCallerAbort = () => controller.abort(signal.reason);
        signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    if (timeoutMs > 0 && controller) {
        timeoutId = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);
    }

    return {
        signal: controller ? controller.signal : signal,
        timedOut: () => timedOut,
        callerAborted: () => Boolean(signal?.aborted),
        cleanup: () => {
            if (timeoutId !== undefined) clearTimeout(timeoutId);
            if (signal && onCallerAbort) signal.removeEventListener('abort', onCallerAbort);
        },
    };
}

function createHeaders(input, auth, token, hasJsonBody, isFormData) {
    let headers;
    try {
        headers = new Headers(input);
    } catch {
        throw new ApiError('request', 'The request headers are invalid.');
    }

    headers.delete('Authorization');
    if (auth !== 'none' && token) headers.set('Authorization', `Bearer ${token}`);

    if (isFormData) {
        headers.delete('Content-Type');
    } else if (hasJsonBody && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    return headers;
}

async function createHttpError(response, lifecycle) {
    let message = `Request failed with status ${response.status}.`;
    let hasDetail = false;
    try {
        const text = await response.text();
        if (text) {
            try {
                const payload = JSON.parse(text);
                const detail = payload?.detail;
                const details = Array.isArray(detail)
                    ? detail.map(item => {
                        if (typeof item === 'string') return item;
                        if (item && typeof item === 'object') {
                            return item.msg || item.detail || '';
                        }
                        return '';
                    }).filter(Boolean)
                    : [detail && typeof detail === 'object'
                        ? (detail.msg || detail.detail || detail.message)
                        : detail];
                const formattedDetail = details
                    .filter(item => typeof item === 'string' && item.trim())
                    .join(', ');
                if (formattedDetail) {
                    message = formattedDetail;
                    hasDetail = true;
                }
            } catch {
                // Keep the status-only message for non-JSON error bodies.
            }
        }
    } catch (error) {
        if (
            lifecycle.timedOut() ||
            lifecycle.callerAborted() ||
            (error && typeof error === 'object' && (error.name === 'AbortError' || error.code === 20))
        ) {
            throw error;
        }
        // The status remains useful even if the error body cannot be read.
    }
    return new ApiError('http', message, response.status, { hasDetail });
}

async function parseJsonResponse(response) {
    const text = await response.text();
    if (!text.trim()) return null;
    try {
        return JSON.parse(text);
    } catch {
        throw new ApiError('parse', 'The server returned an invalid JSON response.', response.status);
    }
}

function retainStreamLifecycle(response, lifecycle) {
    if (!response.body) return response;

    const reader = response.body.getReader();
    let finished = false;
    const finish = () => {
        if (finished) return;
        finished = true;
        lifecycle.cleanup();
    };
    const originalCleanup = lifecycle.cleanup.bind(lifecycle);
    const onAbort = () => finish();
    if (lifecycle.signal && typeof lifecycle.signal.addEventListener === 'function') {
        lifecycle.signal.addEventListener('abort', onAbort, { once: true });
        lifecycle.cleanup = () => {
            lifecycle.signal.removeEventListener('abort', onAbort);
            originalCleanup();
        };
    }
    const body = new ReadableStream({
        async pull(controller) {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    finish();
                    controller.close();
                } else {
                    controller.enqueue(value);
                }
            } catch (error) {
                finish();
                if (lifecycle.timedOut()) {
                    controller.error(new ApiError('timeout', 'The request timed out.'));
                } else if (lifecycle.callerAborted()) {
                    controller.error(new ApiError('aborted', 'The request was cancelled.'));
                } else {
                    controller.error(error);
                }
            }
        },
        async cancel(reason) {
            try {
                await reader.cancel(reason);
            } finally {
                finish();
            }
        },
    });

    return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}

export async function apiRequest(path, options = {}) {
    const {
        method = 'GET',
        auth = 'optional',
        headers: inputHeaders,
        json,
        formData,
        responseType = 'json',
        signal,
        timeoutMs,
    } = options;

    if (!AUTH_MODES.has(auth)) {
        throw new ApiError('request', 'The API authentication mode is invalid.');
    }
    if (!RESPONSE_TYPES.has(responseType)) {
        throw new ApiError('request', 'The API response type is invalid.');
    }
    const hasJsonBody = Object.prototype.hasOwnProperty.call(options, 'json') && json !== undefined;
    const hasFormData = formData !== undefined;
    if (hasJsonBody && hasFormData) {
        throw new ApiError('request', 'A request cannot contain both JSON and FormData bodies.');
    }
    if (hasFormData && (typeof FormData === 'undefined' || !(formData instanceof FormData))) {
        throw new ApiError('request', 'FormData requests require a FormData body.');
    }

    const baseUrl = getApiBaseUrl();
    const url = resolveUrl(path, baseUrl);
    const token = auth === 'none' ? null : readAuthToken();
    if (auth === 'required' && !token) {
        throw new ApiError('auth', 'Authentication is required for this request.');
    }
    const requestHeaders = createHeaders(inputHeaders, auth, token, hasJsonBody, hasFormData);
    let body;
    if (hasFormData) {
        body = formData;
    } else if (hasJsonBody) {
        try {
            body = JSON.stringify(json);
        } catch {
            throw new ApiError('request', 'The JSON request body could not be serialized.');
        }
    }
    const lifecycle = createRequestLifecycle(signal, timeoutMs);
    let retainLifecycle = false;

    try {
        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body,
            signal: lifecycle.signal,
        });

        if (!response.ok) throw await createHttpError(response, lifecycle);

        switch (responseType) {
            case 'json':
                return await parseJsonResponse(response);
            case 'text':
                return await response.text();
            case 'blob':
                return await response.blob();
            case 'none': {
                if (response.body) {
                    await response.body.cancel();
                }
                return { status: response.status, headers: response.headers };
            }
            case 'stream': {
                const streamResponse = retainStreamLifecycle(response, lifecycle);
                retainLifecycle = Boolean(response.body);
                return streamResponse;
            }
            case 'response': {
                retainLifecycle = Boolean(response.body);
                return retainLifecycle ? retainStreamLifecycle(response, lifecycle) : response;
            }
            default:
                throw new ApiError('request', 'The API response type is invalid.');
        }
    } catch (error) {
        if (error instanceof ApiError) throw error;
        if (lifecycle.timedOut()) {
            throw new ApiError('timeout', 'The request timed out.');
        }
        if (lifecycle.callerAborted()) {
            throw new ApiError('aborted', 'The request was cancelled.');
        }
        throw new ApiError('network', 'A network error interrupted the request.');
    } finally {
        if (!retainLifecycle) lifecycle.cleanup();
    }
}
