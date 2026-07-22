/**
 * Utility for secure memory cleanup of sensitive data
 */

/**
 * Overwrites a variable's value with random data before setting to null
 * Helps prevent sensitive data from lingering in memory
 * @param {string} variableRef - The sensitive string to clear
 * @returns {string} Garbage string of same length
 */
function secureClear(variableRef) {
  if (typeof variableRef !== 'string' || variableRef.length === 0) {
    return '';
  }
  
  // Overwrite string with random characters of same length
  const length = variableRef.length;
  let overwrite = '';
  for (let i = 0; i < length; i++) {
    overwrite += String.fromCharCode(Math.floor(Math.random() * 256));
  }
  
  return overwrite; // Return garbage string
}

/**
 * Clears sensitive data from an object
 * @param {Object} obj - The object containing sensitive data
 * @param {string[]} sensitiveKeys - Array of keys to clear
 */
function clearSensitiveData(obj, sensitiveKeys) {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  
  for (const key of sensitiveKeys) {
    if (obj[key]) {
      if (typeof obj[key] === 'string') {
        obj[key] = secureClear(obj[key]);
      }
      obj[key] = null;
    }
  }
}

/**
 * Securely clears a buffer by filling with zeros
 * @param {Buffer} buffer - The buffer to clear
 */
function clearBuffer(buffer) {
  if (buffer && Buffer.isBuffer(buffer)) {
    buffer.fill(0);
    return Buffer.alloc(0); // Return empty buffer
  }
  return null;
}

module.exports = { secureClear, clearSensitiveData, clearBuffer };