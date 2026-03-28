import { describe, it, expect } from 'bun:test';
import { createChppEncryption } from './chpp-encryption';

// Valid 64-char hex key for tests
const TEST_KEY = 'a'.repeat(64);

describe('createChppEncryption', () => {
  it('should encrypt and decrypt a token successfully', () => {
    const enc = createChppEncryption(TEST_KEY);
    const original = 'my-secret-access-token';

    const encrypted = enc.encrypt(original);
    const decrypted = enc.decrypt(encrypted);

    expect(decrypted).toBe(original);
  });

  it('should produce different ciphertext for the same plaintext (random IV)', () => {
    const enc = createChppEncryption(TEST_KEY);
    const original = 'same-token';

    const encrypted1 = enc.encrypt(original);
    const encrypted2 = enc.encrypt(original);

    // Same plaintext, different ciphertext due to random IV
    expect(encrypted1).not.toBe(encrypted2);
    // But both decrypt correctly
    expect(enc.decrypt(encrypted1)).toBe(original);
    expect(enc.decrypt(encrypted2)).toBe(original);
  });

  it('stored format should be iv:authTag:ciphertext (3 parts separated by colon)', () => {
    const enc = createChppEncryption(TEST_KEY);
    const encrypted = enc.encrypt('token-value');
    const parts = encrypted.split(':');

    expect(parts).toHaveLength(3);
    // IV: 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // AuthTag: 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Ciphertext: non-empty
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('should throw on invalid key length', () => {
    expect(() => createChppEncryption('tooshort')).toThrow('64 hex characters');
  });

  it('should throw when decrypting malformed stored value', () => {
    const enc = createChppEncryption(TEST_KEY);
    expect(() => enc.decrypt('notvalid')).toThrow('Invalid encrypted token format');
  });

  it('should throw when auth tag is tampered (GCM integrity check)', () => {
    const enc = createChppEncryption(TEST_KEY);
    const encrypted = enc.encrypt('sensitive-token');
    // Tamper with the auth tag (second segment)
    const parts = encrypted.split(':');
    parts[1] = 'f'.repeat(32); // replace auth tag with garbage
    const tampered = parts.join(':');

    expect(() => enc.decrypt(tampered)).toThrow();
  });

  it('should handle long token strings', () => {
    const enc = createChppEncryption(TEST_KEY);
    const longToken = 'a'.repeat(500);

    const encrypted = enc.encrypt(longToken);
    expect(enc.decrypt(encrypted)).toBe(longToken);
  });
});
