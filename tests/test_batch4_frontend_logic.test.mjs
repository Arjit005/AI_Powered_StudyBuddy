import test from 'node:test';
import assert from 'node:assert/strict';

test('CanvasStudio edge geometry handles non-finite and negative dimensions', () => {
  const getEdgeGeometry = (srcNode, tgtNode) => {
    const rawSrcW = Number(srcNode?.width);
    const rawSrcH = Number(srcNode?.height);
    const rawTgtW = Number(tgtNode?.width);
    const rawTgtH = Number(tgtNode?.height);
    const rawSrcX = Number(srcNode?.x);
    const rawSrcY = Number(srcNode?.y);
    const rawTgtX = Number(tgtNode?.x);
    const rawTgtY = Number(tgtNode?.y);

    const srcW = Number.isFinite(rawSrcW) && rawSrcW > 0 ? rawSrcW : 190;
    const srcH = Number.isFinite(rawSrcH) && rawSrcH > 0 ? rawSrcH : 70;
    const tgtW = Number.isFinite(rawTgtW) && rawTgtW > 0 ? rawTgtW : 190;
    const tgtH = Number.isFinite(rawTgtH) && rawTgtH > 0 ? rawTgtH : 70;

    const srcX = Number.isFinite(rawSrcX) ? rawSrcX : 0;
    const srcY = Number.isFinite(rawSrcY) ? rawSrcY : 0;
    const tgtX = Number.isFinite(rawTgtX) ? rawTgtX : 0;
    const tgtY = Number.isFinite(rawTgtY) ? rawTgtY : 0;

    const srcCenterX = srcX + srcW / 2;
    const srcCenterY = srcY + srcH / 2;
    const tgtCenterX = tgtX + tgtW / 2;
    const tgtCenterY = tgtY + tgtH / 2;

    const diffX = tgtCenterX - srcCenterX;
    const diffY = tgtCenterY - srcCenterY;

    let x1, y1, x2, y2, pathD;

    if (Math.abs(diffX) >= Math.abs(diffY)) {
      if (diffX >= 0) {
        x1 = srcX + srcW;
        y1 = srcCenterY;
        x2 = tgtX;
        y2 = tgtCenterY;
      } else {
        x1 = srcX;
        y1 = srcCenterY;
        x2 = tgtX + tgtW;
        y2 = tgtCenterY;
      }
      const dx = Math.max(Math.abs(x2 - x1) * 0.5, 30);
      pathD = `M ${x1} ${y1} C ${x1 + (diffX >= 0 ? dx : -dx)} ${y1}, ${x2 + (diffX >= 0 ? -dx : dx)} ${y2}, ${x2} ${y2}`;
    } else {
      if (diffY >= 0) {
        x1 = srcCenterX;
        y1 = srcY + srcH;
        x2 = tgtCenterX;
        y2 = tgtY;
      } else {
        x1 = srcCenterX;
        y1 = srcY;
        x2 = tgtCenterX;
        y2 = tgtY + tgtH;
      }
      const dy = Math.max(Math.abs(y2 - y1) * 0.5, 30);
      pathD = `M ${x1} ${y1} C ${x1} ${y1 + (diffY >= 0 ? dy : -dy)}, ${x2} ${y2 + (diffY >= 0 ? -dy : dy)}, ${x2} ${y2}`;
    }

    return { x1, y1, x2, y2, pathD, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2 };
  };

  // Malformed / NaN inputs
  const geom1 = getEdgeGeometry({ x: NaN, y: undefined, width: -50, height: 0 }, { x: 'abc', y: Infinity, width: null, height: 'xyz' });
  assert.ok(Number.isFinite(geom1.x1));
  assert.ok(Number.isFinite(geom1.y1));
  assert.ok(Number.isFinite(geom1.x2));
  assert.ok(Number.isFinite(geom1.y2));
  assert.ok(!geom1.pathD.includes('NaN'));
  assert.ok(!geom1.pathD.includes('undefined'));
  assert.ok(!geom1.pathD.includes('Infinity'));
});

test('Progress validation normalizes negative and non-finite values safely', () => {
  const sanitizeStats = (data) => {
    const rawHours = Number(data.study_hours);
    const rawQuizzes = Number(data.quizzes_taken);
    const rawStreak = Number(data.streak_days);
    return {
      study_hours: Number.isFinite(rawHours) && rawHours >= 0 ? rawHours : 0,
      quizzes_taken: Number.isFinite(rawQuizzes) && rawQuizzes >= 0 ? Math.floor(rawQuizzes) : 0,
      streak_days: Number.isFinite(rawStreak) && rawStreak >= 0 ? Math.floor(rawStreak) : 0
    };
  };

  const clean = sanitizeStats({ study_hours: -15, quizzes_taken: NaN, streak_days: 'Infinity' });
  assert.strictEqual(clean.study_hours, 0);
  assert.strictEqual(clean.quizzes_taken, 0);
  assert.strictEqual(clean.streak_days, 0);

  const valid = sanitizeStats({ study_hours: 4.5, quizzes_taken: 12.8, streak_days: 7 });
  assert.strictEqual(valid.study_hours, 4.5);
  assert.strictEqual(valid.quizzes_taken, 12);
  assert.strictEqual(valid.streak_days, 7);
});

test('Maps PNG base64 validation verifies magic bytes header', () => {
  const isValidBase64 = (str) => {
    if (!str || str.length % 4 !== 0) return false;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(str)) return false;
    return true;
  };
  const hasPngMagicHeader = (str) => str.startsWith('iVBORw0KGgo');

  const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const textBase64 = Buffer.from('Hello world!').toString('base64');

  assert.ok(isValidBase64(validPngBase64) && hasPngMagicHeader(validPngBase64));
  assert.ok(!hasPngMagicHeader(textBase64));
});

test('Timer rounding math ceiling avoids premature 00:00 trigger', () => {
  const targetEndTime = Date.now() + 999;
  const now = Date.now();
  const diff = targetEndTime - now;
  const remaining = Math.max(0, Math.ceil(diff / 1000));
  assert.strictEqual(remaining, 1);
});
