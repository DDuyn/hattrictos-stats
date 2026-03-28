/**
 * AES-256-GCM encryption for CHPP OAuth tokens stored in the database.
 *
 * Each call to encrypt() generates a fresh random IV (12 bytes), so the same
 * plaintext produces a different ciphertext every time. The IV and auth tag
 * are stored alongside the ciphertext (separated by ':'), making the stored
 * value self-contained for decryption.
 *
 * Format stored in DB: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *
 * The key must be 32 bytes (64 hex characters), provided via CHPP_ENCRYPTION_KEY.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits — GCM default

export interface ChppEncryption {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

/**
 * Creates an encryption helper bound to the given 32-byte key (as hex string).
 * Throws if the key is not the correct length.
 */
export function createChppEncryption(keyHex: string): ChppEncryption {
  if (keyHex.length !== 64) {
    throw new Error(
      'CHPP_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
        'Generate with: openssl rand -hex 32',
    );
  }

  const key = Buffer.from(keyHex, 'hex');

  return {
    encrypt(plaintext: string): string {
      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    },

    decrypt(stored: string): string {
      const parts = stored.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted token format');
      }

      const [ivHex, authTagHex, ciphertextHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
      decipher.setAuthTag(authTag);

      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    },
  };
}
