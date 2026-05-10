import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/version';

describe('VERSION constant', () => {
  it('matches semantic version pattern', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('is the expected initial version', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
