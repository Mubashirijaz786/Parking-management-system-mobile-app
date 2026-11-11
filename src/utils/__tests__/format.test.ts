import { durationLabel, normalizePlate } from '@/src/utils/format';

describe('format helpers', () => {
  it('normalizes Pakistani plate input without assuming one format', () => expect(normalizePlate('lea-1234')).toBe('LEA1234'));
  it('formats parking duration compactly', () => expect(durationLabel(125)).toBe('2h 5m'));
});
