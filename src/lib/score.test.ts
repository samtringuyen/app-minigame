import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from './errors.js';
import { MAX_DURATION_MS, MAX_MOVES, assertValidAttempt, deriveScore } from './score.js';

describe('deriveScore', () => {
  it('uses 100000 - 100 per move - 1 per 100ms', () => {
    assert.equal(deriveScore(20, 15_000), 97_850);
    assert.equal(deriveScore(0, 0), 100_000);
    assert.equal(deriveScore(5, 2_000), 99_480);
  });

  it('never goes below zero', () => {
    assert.equal(deriveScore(MAX_MOVES, MAX_DURATION_MS), 0);
  });

  it('rewards fewer moves at the same duration', () => {
    assert.ok(deriveScore(10, 0) > deriveScore(11, 0));
  });
});

describe('assertValidAttempt', () => {
  it('allows durationMs of 0', () => {
    assert.doesNotThrow(() => assertValidAttempt(8, 0));
  });

  it('rejects negative moves and duration', () => {
    assert.throws(() => assertValidAttempt(-1, 100), AppError);
    assert.throws(() => assertValidAttempt(1, -1), AppError);
  });
});
