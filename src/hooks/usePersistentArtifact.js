import { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../config/apiClient';

/**
 * Migration helper for versioned artifact payloads
 */
const migratePayload = (payload, fromVersion, kind) => {
    if (!payload || typeof payload !== 'object') return payload;
    let current = { ...payload };

    // Example migration: if v1 missing viewport or engine defaults
    if (fromVersion < 2) {
        if (kind === 'mindmap' && !current.viewport) {
            current.viewport = { x: 0, y: 0, zoom: 1 };
        }
        if (kind === 'canvas' && !current.gridVisible) {
            current.gridVisible = true;
        }
        if (kind === 'flashcards' && current.currentIndex === undefined) {
            current.currentIndex = 0;
        }
    }
    return current;
};

/**
 * usePersistentArtifact Hook
 * Contract:
 * - Local-first hydration from localStorage (never blocks initial render)
 * - Network reconcile with GET /api/sessions/{sessionId}/artifacts/{kind}
 * - Conflict resolution (server wins, local saved as backup)
 * - 800ms debounce autosave via PUT with revision check
 * - Flush dirty state on visibilitychange / pagehide
 * - BroadcastChannel sync across open browser tabs
 * - Non-blocking status: 'idle' | 'saving' | 'saved' | 'offline' | 'error'
 */
export function usePersistentArtifact({ sessionId, kind, initial = null, schemaVersion = 1 }) {
    const storageKey = `asb:v1:${sessionId || 'default'}:${kind}`;
    
    // 1. Local-first synchronous hydration
    const [data, setDataInternal] = useState(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.payload !== undefined) {
                    return migratePayload(parsed.payload, parsed.schema_version || 1, kind);
                }
                return parsed;
            }
        } catch (e) {
            console.warn(`Local hydration failed for ${kind}:`, e);
        }
        return initial;
    });

    const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'offline' | 'error'
    const [isHydrated, setIsHydrated] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [error, setError] = useState(null);

    const revisionRef = useRef(1);
    const dataRef = useRef(data);
    dataRef.current = data;

    const isDirtyRef = useRef(false);
    const debounceTimerRef = useRef(null);
    const channelRef = useRef(null);

    // BroadcastChannel setup for multi-tab synchronization
    useEffect(() => {
        if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('asb-artifacts');
            channelRef.current = channel;

            channel.onmessage = (event) => {
                const msg = event.data;
                if (msg && msg.sessionId === sessionId && msg.kind === kind) {
                    if (!isDirtyRef.current) {
                        // Safe to take update from other tab
                        if (msg.payload) {
                            setDataInternal(msg.payload);
                            revisionRef.current = msg.revision || revisionRef.current;
                            setLastSavedAt(new Date().toLocaleTimeString());
                        }
                    } else {
                        // Notice user that another tab updated this artifact
                        setStatus('Updated in another tab — reload to see changes');
                    }
                }
            };

            return () => {
                channel.close();
            };
        }
    }, [sessionId, kind]);

    // Save helper to server with optimistic revision
    const persistToServer = useCallback(async (payloadToSave, currentRevision) => {
        if (!sessionId) return;
        setStatus('saving');

        try {
            const res = await apiRequest(`/api/sessions/${sessionId}/artifacts/${kind}`, {
                method: 'PUT',
                auth: 'required',
                json: {
                    payload: payloadToSave,
                    schema_version: schemaVersion,
                    revision: currentRevision
                }
            });

            if (res && res.revision) {
                revisionRef.current = res.revision;
                isDirtyRef.current = false;
                setStatus('saved');
                setLastSavedAt(new Date().toLocaleTimeString());
                setError(null);

                // Notify other tabs
                channelRef.current?.postMessage({
                    sessionId,
                    kind,
                    revision: res.revision,
                    payload: payloadToSave
                });
            }
        } catch (err) {
            // Handle 409 conflict
            if (err.status === 409 || err.message?.includes('409')) {
                console.warn(`Artifact conflict on ${kind}, server wins.`);
                try {
                    // Save local backup in localStorage
                    localStorage.setItem(`${storageKey}:conflictBackup`, JSON.stringify(payloadToSave));
                } catch {
                    // ignore storage quota
                }
                // Refetch server version
                try {
                    const serverArt = await apiRequest(`/api/sessions/${sessionId}/artifacts/${kind}`, { auth: 'required' });
                    if (serverArt && serverArt.payload) {
                        setDataInternal(serverArt.payload);
                        revisionRef.current = serverArt.revision;
                        isDirtyRef.current = false;
                        setStatus('saved');
                    }
                } catch {
                    setStatus('error');
                }
            } else if (!navigator.onLine) {
                setStatus('offline');
            } else {
                setStatus('error');
                setError(err.message || 'Failed to save artifact');
            }
        }
    }, [sessionId, kind, schemaVersion, storageKey]);

    // Setter with automatic localStorage mirror + 800ms debounce server push
    const setData = useCallback((updater) => {
        setDataInternal((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            isDirtyRef.current = true;
            setStatus('saving');

            // Mirror to localStorage instantly
            try {
                localStorage.setItem(storageKey, JSON.stringify({
                    payload: next,
                    schema_version: schemaVersion,
                    revision: revisionRef.current,
                    updated_at: new Date().toISOString()
                }));
            } catch (storageErr) {
                console.warn(`LocalStorage quota exceeded for ${kind}:`, storageErr);
            }

            // Debounce server PUT (800ms)
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                persistToServer(next, revisionRef.current);
            }, 800);

            return next;
        });
    }, [storageKey, schemaVersion, kind, persistToServer]);

    // Network Reconcile on Mount / sessionId Change
    useEffect(() => {
        let isCancelled = false;

        const reconcile = async () => {
            if (!sessionId) {
                setIsHydrated(true);
                return;
            }

            try {
                const serverData = await apiRequest(`/api/sessions/${sessionId}/artifacts/${kind}`, { auth: 'required' });
                if (isCancelled) return;

                if (serverData && serverData.payload) {
                    const serverRev = serverData.revision || 1;
                    const serverPayload = migratePayload(serverData.payload, serverData.schema_version || 1, kind);

                    // Reconcile: server revision vs local revision
                    if (serverRev >= revisionRef.current) {
                        setDataInternal(serverPayload);
                        revisionRef.current = serverRev;
                        localStorage.setItem(storageKey, JSON.stringify({
                            payload: serverPayload,
                            schema_version: schemaVersion,
                            revision: serverRev,
                            updated_at: serverData.updated_at
                        }));
                    } else if (revisionRef.current > serverRev && isDirtyRef.current) {
                        // User edited offline; push local to server
                        persistToServer(dataRef.current, serverRev);
                    }
                    setStatus('saved');
                    setLastSavedAt(new Date().toLocaleTimeString());
                }
            } catch (err) {
                // 404 is normal for newly initiated sessions without existing artifact
                if (!navigator.onLine) {
                    setStatus('offline');
                }
            } finally {
                if (!isCancelled) {
                    setIsHydrated(true);
                }
            }
        };

        reconcile();

        return () => {
            isCancelled = true;
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, [sessionId, kind, schemaVersion, storageKey, persistToServer]);

    // Flush dirty state on page exit / visibility change
    useEffect(() => {
        const handleExit = () => {
            if (isDirtyRef.current && sessionId && dataRef.current) {
                // If beacon is supported, use beacon on pagehide
                const token = localStorage.getItem('auth_token');
                const url = `/api/sessions/${sessionId}/artifacts/${kind}`;
                const payloadBlob = new Blob([JSON.stringify({
                    payload: dataRef.current,
                    schema_version: schemaVersion,
                    revision: revisionRef.current
                })], { type: 'application/json' });

                if (navigator.sendBeacon && token) {
                    navigator.sendBeacon(url, payloadBlob);
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && isDirtyRef.current) {
                persistToServer(dataRef.current, revisionRef.current);
            }
        };

        window.addEventListener('pagehide', handleExit);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('pagehide', handleExit);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [sessionId, kind, schemaVersion, persistToServer]);

    return {
        data,
        setData,
        status,
        isHydrated,
        lastSavedAt,
        error
    };
}
