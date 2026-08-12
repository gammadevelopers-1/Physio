import { buildTaskName, buildTaskNamePrefix, parseTaskName } from './task-name';

describe('buildTaskName', () => {
  it('assembles the expected {entity}--{id}--{event}--v{version} string', () => {
    expect(
      buildTaskName({
        entity: 'maint',
        id: 'abc123',
        event: 'activate',
        version: 1700000000000,
      }),
    ).toBe('maint--abc123--activate--v1700000000000');
  });

  it('normalises Date versions to epoch milliseconds', () => {
    const d = new Date('2026-08-05T12:00:00.000Z');
    expect(
      buildTaskName({ entity: 'x', id: '1', event: 'e', version: d }),
    ).toBe(`x--1--e--v${d.getTime()}`);
  });

  it('accepts bigint versions', () => {
    expect(
      buildTaskName({
        entity: 'x',
        id: '1',
        event: 'e',
        version: BigInt(42),
      }),
    ).toBe('x--1--e--v42');
  });

  it('truncates decimals on numeric versions', () => {
    expect(
      buildTaskName({ entity: 'x', id: '1', event: 'e', version: 1.9 }),
    ).toBe('x--1--e--v1');
  });

  it('replaces invalid chars with underscore', () => {
    expect(
      buildTaskName({
        entity: 'user.session',
        id: 'foo/bar',
        event: 'end',
        version: 1,
      }),
    ).toBe('user_session--foo_bar--end--v1');
  });

  it('accepts UUIDs (already valid chars)', () => {
    const id = '00000000-0000-4000-a000-000000000000';
    expect(
      buildTaskName({ entity: 'session', id, event: 'remind', version: 1 }),
    ).toContain(`session--${id}--remind--v1`);
  });

  it('rejects an empty part', () => {
    expect(() =>
      buildTaskName({ entity: '', id: '1', event: 'e', version: 1 }),
    ).toThrow();
  });

  it('rejects a non-finite version', () => {
    expect(() =>
      buildTaskName({ entity: 'x', id: '1', event: 'e', version: NaN }),
    ).toThrow();
  });

  it('rejects overly long names', () => {
    expect(() =>
      buildTaskName({
        entity: 'x'.repeat(250),
        id: 'y'.repeat(250),
        event: 'e',
        version: 1,
      }),
    ).toThrow(/exceeds 500 chars/);
  });
});

describe('buildTaskNamePrefix', () => {
  it('produces a prefix that matches every version of one event', () => {
    const prefix = buildTaskNamePrefix({
      entity: 'maint',
      id: 'abc',
      event: 'activate',
    });
    expect(prefix).toBe('maint--abc--activate--v');
    expect(
      buildTaskName({
        entity: 'maint',
        id: 'abc',
        event: 'activate',
        version: 42,
      }).startsWith(prefix),
    ).toBe(true);
    expect(
      buildTaskName({
        entity: 'maint',
        id: 'abc',
        event: 'activate',
        version: 999999,
      }).startsWith(prefix),
    ).toBe(true);
  });
});

describe('parseTaskName', () => {
  it('round-trips buildTaskName output', () => {
    const parts = {
      entity: 'session',
      id: 'abc',
      event: 'remind',
      version: 12345,
    };
    const parsed = parseTaskName(buildTaskName(parts));
    expect(parsed?.entity).toBe('session');
    expect(parsed?.id).toBe('abc');
    expect(parsed?.event).toBe('remind');
    expect(parsed?.version).toBe(12345);
  });

  it('returns null on garbage input', () => {
    expect(parseTaskName('nope')).toBeNull();
    expect(parseTaskName('')).toBeNull();
  });
});
