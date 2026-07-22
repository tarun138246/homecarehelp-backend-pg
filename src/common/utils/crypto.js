const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Get encryption keys from environment
function getEncryptionKey() {
  const keys = [env.encryption_key_1, env.encryption_key_2].filter(Boolean);
  
  if (keys.length === 0) {
    throw new Error('No encryption keys configured in environment (encryption_key_1, encryption_key_2)');
  }

  // Randomly select key 1 or 2
  const keyIndex = Math.random() < 0.5 ? 1 : 2;
  const selectedKey = keyIndex === 1 ? keys[0] : keys[1];
  
  // Convert hex key to buffer (assuming keys are stored as hex strings in .env)
  const keyBuffer = Buffer.from(selectedKey, 'hex');
  
  if (keyBuffer.length !== 32) {
    throw new Error(`Encryption key ${keyIndex} must be 32 bytes (64 hex characters)`);
  }
  
  return { key: keyBuffer, keyIndex };
}

function encrypt(text) {
  const { key, keyIndex } = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(String(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    keyUsed: keyIndex // Store 1 or 2 instead of full key
  };
}

function decrypt(encryptedData, keyUsed, ivHex) {
  const keys = [env.encryption_key_1, env.encryption_key_2].filter(Boolean);
  
  if (keyUsed < 1 || keyUsed > 2) {
    throw new Error(`Invalid key index: ${keyUsed}. Must be 1 or 2`);
  }
  
  const selectedKey = keys[keyUsed - 1];
  if (!selectedKey) {
    throw new Error(`Encryption key ${keyUsed} not configured`);
  }
  
  const key = Buffer.from(selectedKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };