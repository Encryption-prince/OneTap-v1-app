/**
 * AES-256-GCM encryption/decryption for React Native (Hermes engine)
 * Uses @noble/ciphers (pure JS) + expo-crypto for random bytes
 * Compatible with the webapp's Web Crypto AES-GCM implementation
 */
import * as ExpoCrypto from 'expo-crypto';
import { gcm } from '@noble/ciphers/aes';

// ── Base64 URL helpers ────────────────────────────────────────────────────────

export const arrayBufferToBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export const base64UrlToUint8Array = (base64) => {
  // Convert URL-safe base64 → standard base64
  let std = base64.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (std.length % 4 !== 0) std += '=';
  const binary = atob(std);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

// ── Random bytes via expo-crypto ──────────────────────────────────────────────

const getRandomBytes = (length) => {
  return ExpoCrypto.getRandomBytes(length);
};

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypts an ArrayBuffer using AES-256-GCM.
 * Output format: [12-byte IV][ciphertext+16-byte auth tag]
 * This matches the webapp's Web Crypto implementation exactly.
 *
 * @param {ArrayBuffer} arrayBuffer - plaintext data
 * @returns {{ encryptedBuffer: ArrayBuffer, base64Key: string }}
 */
export const encryptData = async (arrayBuffer) => {
  // Generate random 256-bit key and 96-bit IV
  const key = getRandomBytes(32);   // 32 bytes = 256 bits
  const iv  = getRandomBytes(12);   // 12 bytes = 96 bits (recommended for GCM)

  const plaintext = new Uint8Array(arrayBuffer);

  // Encrypt — @noble/ciphers gcm returns ciphertext + 16-byte auth tag appended
  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(plaintext); // Uint8Array: ciphertext || tag

  // Prepend IV: [iv (12)] + [ciphertext+tag]
  const result = new Uint8Array(iv.length + ciphertext.length);
  result.set(iv, 0);
  result.set(ciphertext, iv.length);

  const base64Key = arrayBufferToBase64Url(key.buffer);

  return { encryptedBuffer: result.buffer, base64Key };
};

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypts an ArrayBuffer using AES-256-GCM.
 * Expects format: [12-byte IV][ciphertext+16-byte auth tag]
 *
 * @param {ArrayBuffer} encryptedData
 * @param {string} base64Key - URL-safe base64 encoded key
 * @returns {ArrayBuffer} decrypted plaintext
 */
export const decryptData = async (encryptedData, base64Key) => {
  const key = base64UrlToUint8Array(base64Key);
  const data = new Uint8Array(encryptedData);

  const iv         = data.slice(0, 12);
  const ciphertext = data.slice(12);   // includes the 16-byte auth tag

  const cipher = gcm(key, iv);
  const plaintext = cipher.decrypt(ciphertext);

  return plaintext.buffer;
};
