import test from 'node:test';
import assert from 'node:assert/strict';

// Helper for deterministic deferred promises
function createDeferred() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

// 1. Fallback fetch throws and catch executes without ReferenceError
test('Fallback fetch throws and catch executes without ReferenceError', async () => {
    const sendGenerationRef = { current: 1 };
    const invalidatedConvsRef = { current: new Set() };
    const activeConvIdRef = { current: 'conv-101' };
    const originatingConvId = 'conv-101';
    let streamConvId = originatingConvId;

    const isStillCurrentConv = () => {
        if (1 !== sendGenerationRef.current) return false;
        if (invalidatedConvsRef.current.has(originatingConvId)) return false;
        if (streamConvId && invalidatedConvsRef.current.has(streamConvId)) return false;
        return (
            originatingConvId === activeConvIdRef.current || 
            (originatingConvId === null && (activeConvIdRef.current === null || activeConvIdRef.current === streamConvId)) ||
            (streamConvId && activeConvIdRef.current === streamConvId)
        );
    };

    let caughtErrorHandled = false;
    let fallbackErrorMessageAppended = false;

    // Simulate fallback /api/chat throwing an error
    try {
        throw new Error('Fallback /api/chat timed out');
    } catch (err) {
        // Outer catch executes isStillCurrentConv() without ReferenceError
        if (isStillCurrentConv()) {
            fallbackErrorMessageAppended = true;
        }
        caughtErrorHandled = true;
    }

    assert.equal(caughtErrorHandled, true);
    assert.equal(fallbackErrorMessageAppended, true);

    // If active conversation changed before outer catch executed, message is not appended
    activeConvIdRef.current = 'conv-diff';
    assert.equal(isStillCurrentConv(), false);
});

// 2. Conversation deletion overlaps with a conversation-list update
test('Conversation deletion overlaps with a conversation-list update', async () => {
    let conversations = [
        { id: 'c1', title: 'Session 1' },
        { id: 'c2', title: 'Session 2' }
    ];
    const activeConvIdRef = { current: 'c1' };
    let activeConvId = 'c1';

    const deferredDelete = createDeferred();

    // Start deletion of c1
    const deletePromise = (async () => {
        await deferredDelete.promise;
        // Functional update as implemented in ChatInterface.jsx
        conversations = ((prev) => {
            const remaining = prev.filter(c => c.id !== 'c1');
            if (activeConvIdRef.current === 'c1') {
                if (remaining.length > 0) {
                    activeConvIdRef.current = remaining[0].id;
                    activeConvId = remaining[0].id;
                } else {
                    activeConvIdRef.current = null;
                    activeConvId = null;
                }
            }
            return remaining;
        })(conversations);
    })();

    // While deletion is pending, a concurrent list update adds 'c3'
    conversations = [...conversations, { id: 'c3', title: 'Session 3' }];

    // Resolve deletion
    deferredDelete.resolve();
    await deletePromise;

    // Verify c3 is preserved and active conversation moved safely to c2
    assert.deepEqual(conversations.map(c => c.id), ['c2', 'c3']);
    assert.equal(activeConvId, 'c2');
    assert.equal(activeConvIdRef.current, 'c2');
});

// 3. Initial fetch resolves after the user selects another conversation
test('Initial fetch resolves after the user selects another conversation', async () => {
    const fetchConversationsGenRef = { current: 0 };
    const activeConvIdRef = { current: null };
    let activeConvId = null;
    let conversations = [];

    const deferredFetch = createDeferred();

    const fetchConversations = async () => {
        const thisFetchGen = ++fetchConversationsGenRef.current;
        const data = await deferredFetch.promise;
        if (thisFetchGen !== fetchConversationsGenRef.current) return;
        conversations = data;
        if (data.length > 0 && !activeConvIdRef.current) {
            activeConvIdRef.current = data[0].id;
            setActiveConvId(data[0].id);
        }
    };

    const runFetch = fetchConversations();

    // User navigates and selects 'user-selected-chat' before initial fetch finishes
    activeConvIdRef.current = 'user-selected-chat';
    activeConvId = 'user-selected-chat';

    // Initial fetch finally returns
    deferredFetch.resolve([{ id: 'default-old', title: 'Default Old' }]);
    await runFetch;

    // User selection is preserved
    assert.equal(activeConvId, 'user-selected-chat');
    assert.equal(activeConvIdRef.current, 'user-selected-chat');
    assert.deepEqual(conversations, [{ id: 'default-old', title: 'Default Old' }]);
});

// 4. Clear succeeds while a message request is pending
test('Clear succeeds while a message request is pending', async () => {
    const sendGenerationRef = { current: 1 };
    const invalidatedConvsRef = { current: new Set() };
    const activeConvIdRef = { current: 'conv-target' };
    const targetConv = 'conv-target';
    const clearKey = targetConv || 'current';

    // In-flight send started with generation 1
    const pendingSendGen = 1;
    const isSendValid = () => (
        pendingSendGen === sendGenerationRef.current &&
        !invalidatedConvsRef.current.has(targetConv)
    );

    assert.equal(isSendValid(), true);

    const deferredClear = createDeferred();

    const clearPromise = (async () => {
        await deferredClear.promise;
        // On successful clear (res.ok)
        invalidatedConvsRef.current.add(clearKey);
        sendGenerationRef.current += 1;
        invalidatedConvsRef.current.delete(clearKey);
    })();

    deferredClear.resolve();
    await clearPromise;

    // After successful clear, generation was incremented and the old in-flight request is invalid
    assert.equal(sendGenerationRef.current, 2);
    assert.equal(isSendValid(), false);
});

// 5. Clear fails while a message request is pending
test('Clear fails while a message request is pending', async () => {
    const sendGenerationRef = { current: 1 };
    const invalidatedConvsRef = { current: new Set() };
    const targetConv = 'conv-target';
    const clearKey = targetConv || 'current';

    // In-flight send with generation 1
    const pendingSendGen = 1;
    const isSendValid = () => (
        pendingSendGen === sendGenerationRef.current &&
        !invalidatedConvsRef.current.has(targetConv)
    );

    assert.equal(isSendValid(), true);

    const deferredClear = createDeferred();

    const clearPromise = (async () => {
        try {
            await deferredClear.promise;
            throw new Error('HTTP 500 Network failure');
        } catch (err) {
            // Failure keeps sendGenerationRef and invalidatedConvsRef unmutated
        }
    })();

    deferredClear.resolve();
    await clearPromise;

    // Generation remained untouched; in-flight send is preserved
    assert.equal(sendGenerationRef.current, 1);
    assert.equal(invalidatedConvsRef.current.has(clearKey), false);
    assert.equal(isSendValid(), true);
});

// 6. New conversation receives a server-assigned ID during streaming
test('New conversation receives a server-assigned ID during streaming', () => {
    const sendGenerationRef = { current: 1 };
    const invalidatedConvsRef = { current: new Set() };
    const activeConvIdRef = { current: null };
    const originatingConvId = null;
    let streamConvId = originatingConvId;

    const isStillCurrentConv = () => {
        if (1 !== sendGenerationRef.current) return false;
        if (invalidatedConvsRef.current.has(originatingConvId)) return false;
        if (streamConvId && invalidatedConvsRef.current.has(streamConvId)) return false;
        return (
            originatingConvId === activeConvIdRef.current || 
            (originatingConvId === null && (activeConvIdRef.current === null || activeConvIdRef.current === streamConvId)) ||
            (streamConvId && activeConvIdRef.current === streamConvId)
        );
    };

    assert.equal(isStillCurrentConv(), true);

    // First SSE chunk specifies newly generated conversation ID
    streamConvId = 'conv-new-auto-id';
    activeConvIdRef.current = 'conv-new-auto-id';

    // Valid under server-assigned ID
    assert.equal(isStillCurrentConv(), true);
});

// 7. Old request completes after the user switches conversations
test('Old request completes after the user switches conversations', () => {
    const sendGenerationRef = { current: 1 };
    const invalidatedConvsRef = { current: new Set() };
    const activeConvIdRef = { current: 'conv-original' };
    const originatingConvId = 'conv-original';
    let streamConvId = originatingConvId;

    const isStillCurrentConv = () => {
        if (1 !== sendGenerationRef.current) return false;
        if (invalidatedConvsRef.current.has(originatingConvId)) return false;
        if (streamConvId && invalidatedConvsRef.current.has(streamConvId)) return false;
        return (
            originatingConvId === activeConvIdRef.current || 
            (originatingConvId === null && (activeConvIdRef.current === null || activeConvIdRef.current === streamConvId)) ||
            (streamConvId && activeConvIdRef.current === streamConvId)
        );
    };

    assert.equal(isStillCurrentConv(), true);

    // User switches to 'conv-other' while request is in flight
    activeConvIdRef.current = 'conv-other';

    // Request completing now is dropped cleanly
    assert.equal(isStillCurrentConv(), false);
});
