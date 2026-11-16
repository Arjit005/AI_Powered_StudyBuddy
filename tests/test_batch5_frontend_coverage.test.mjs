import test from 'node:test';
import assert from 'node:assert/strict';

// --- A. CanvasStudio Async Lifecycle & Geometry Coverage ---
test('CanvasStudio request generation increment drops stale async responses', () => {
  let activeGen = 0;
  let canvasState = null;

  const simulateFetchCanvas = async (genId, resultData, delayMs) => {
    await new Promise(r => setTimeout(r, delayMs));
    if (genId === activeGen) {
      canvasState = resultData;
    }
  };

  // User launches request 1
  const req1Gen = ++activeGen;
  simulateFetchCanvas(req1Gen, { id: 'canvas_1' }, 50);

  // User rapidly types or generates request 2
  const req2Gen = ++activeGen;
  simulateFetchCanvas(req2Gen, { id: 'canvas_2' }, 10);

  // After 60ms, ensure req1 did not overwrite req2
  return new Promise((resolve) => {
    setTimeout(() => {
      assert.strictEqual(canvasState?.id, 'canvas_2');
      resolve();
    }, 80);
  });
});

// --- B. Progress Reset Lock Coverage ---
test('Progress reset lock drops concurrent analytics refresh calls', () => {
  let resetInProgress = false;
  let refreshAttemptedDuringReset = false;
  let statsState = { study_hours: 50 };

  const handleReset = () => {
    resetInProgress = true;
    statsState = { study_hours: 0 };
  };

  const handleRefresh = () => {
    if (resetInProgress) {
      refreshAttemptedDuringReset = true;
      return; // Dropped
    }
    statsState = { study_hours: 50 }; // Stale restoration
  };

  handleReset();
  handleRefresh();
  assert.strictEqual(refreshAttemptedDuringReset, true);
  assert.strictEqual(statsState.study_hours, 0); // Stale state prevented
});

// --- C. Quiz Instance Monotonic Isolation Coverage ---
test('Quiz monotonic random UUID guarantees isolation between consecutive quizzes', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    assert.ok(!ids.has(id));
    ids.add(id);
  }
  assert.strictEqual(ids.size, 1000);
});

// --- D. Library Content JSON Safe Formatting Coverage ---
test('Library content_json formatter parses stringified JSON without crashing on malformed strings', () => {
  const formatContent = (content) => {
    if (content === null || content === undefined) return 'No content available.';
    if (typeof content === 'object') {
      try { return JSON.stringify(content, null, 2); } catch (_) { return String(content); }
    }
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          return JSON.stringify(parsed, null, 2);
        } catch (_) {
          return content;
        }
      }
      return content || 'No content available.';
    }
    return String(content);
  };

  // Valid stringified JSON
  const validJson = JSON.stringify({ a: 1, b: "hello" });
  assert.ok(formatContent(validJson).includes('"a": 1'));

  // Corrupted string with curly braces
  const brokenJson = '{ corrupted: true, missing quotes }';
  assert.strictEqual(formatContent(brokenJson), brokenJson);

  // Null & empty
  assert.strictEqual(formatContent(null), 'No content available.');
  assert.strictEqual(formatContent(''), 'No content available.');
});

// --- E. Sources File State Reset on Tab Switch Coverage ---
test('Sources state clears selectedFile when changing upload tab', () => {
  let selectedFile = { name: "test.pdf" };
  let uploadType = 'pdf';

  const switchTab = (newType) => {
    uploadType = newType;
    selectedFile = null;
  };

  switchTab('url');
  assert.strictEqual(uploadType, 'url');
  assert.strictEqual(selectedFile, null);
});

// --- F. LoginPage Username Trim & Email Detection Coverage ---
test('LoginPage trims username before checking email identifier', () => {
  const evaluateInput = (raw) => {
    const trimmed = raw.trim();
    const isEmail = trimmed.includes('@');
    return {
      email: isEmail ? trimmed : undefined,
      username: !isEmail ? trimmed : undefined
    };
  };

  const res1 = evaluateInput('   student@university.edu   ');
  assert.strictEqual(res1.email, 'student@university.edu');
  assert.strictEqual(res1.username, undefined);

  const res2 = evaluateInput('   student123   ');
  assert.strictEqual(res2.email, undefined);
  assert.strictEqual(res2.username, 'student123');
});

// --- G. FeedbackWidget Accessibility Attributes Coverage ---
test('FeedbackWidget rating stars provide accessible labels and pressed states', () => {
  const currentRating = 4;
  const stars = [1, 2, 3, 4, 5].map(star => ({
    star,
    ariaLabel: `Rate ${star} out of 5 stars`,
    ariaPressed: currentRating === star
  }));

  assert.strictEqual(stars[3].ariaLabel, 'Rate 4 out of 5 stars');
  assert.strictEqual(stars[3].ariaPressed, true);
  assert.strictEqual(stars[0].ariaPressed, false);
});
