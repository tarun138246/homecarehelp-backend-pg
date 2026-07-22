// In-memory store for e-signed-but-not-yet-paid partner agreements.
// Extracted from partnerService so the cleanup cron can prune stale entries
// without creating a circular dependency between the two.

const sessions = new Map(); // partnerId -> { signature, pdfBuffer, createdAt }

exports.set = (partnerId, signature, pdfBuffer) => {
  // Auto-cleanup after 10 seconds as safety measure
  const timeoutMs = 10000; // 10 seconds
  
  const partnerIdStr = partnerId.toString();
  
  sessions.set(partnerIdStr, { 
    signature, 
    pdfBuffer, 
    createdAt: Date.now() 
  });
  
  // Schedule automatic cleanup to ensure sensitive data doesn't linger
  const cleanupTimer = setTimeout(() => {
    if (sessions.has(partnerIdStr)) {
      console.log('[SessionStore] Auto-cleaning session for partner:', partnerIdStr);
      const session = sessions.get(partnerIdStr);
      if (session) {
        // Overwrite buffers before deletion for extra security
        if (session.signature) {
          session.signature = null;
          delete session.signature;
        }
        if (session.pdfBuffer) {
          session.pdfBuffer.fill(0); // Overwrite buffer with zeros
          session.pdfBuffer = null;
          delete session.pdfBuffer;
        }
        session.createdAt = null;
        delete session.createdAt;
      }
      sessions.delete(partnerIdStr);
    }
  }, timeoutMs);
  
  // Store the timer reference so we can clear it if manual deletion happens
  if (sessions.has(partnerIdStr)) {
    const sessionData = sessions.get(partnerIdStr);
    sessionData._cleanupTimer = cleanupTimer;
  }
};

exports.get = (partnerId) => {
  const session = sessions.get(partnerId.toString());
  if (!session) return null;
  
  // Return a copy without internal properties
  const { _cleanupTimer, ...cleanSession } = session;
  return cleanSession;
};

exports.delete = (partnerId) => {
  const partnerIdStr = partnerId.toString();
  const session = sessions.get(partnerIdStr);
  
  if (session) {
    // Clear the auto-cleanup timer if it exists
    if (session._cleanupTimer) {
      clearTimeout(session._cleanupTimer);
      session._cleanupTimer = null;
      delete session._cleanupTimer;
    }
    
    // Overwrite buffers before deletion for extra security
    if (session.signature) {
      session.signature = null;
      delete session.signature;
    }
    if (session.pdfBuffer) {
      session.pdfBuffer.fill(0); // Overwrite buffer with zeros
      session.pdfBuffer = null;
      delete session.pdfBuffer;
    }
    session.createdAt = null;
    delete session.createdAt;
    
    console.log('[SessionStore] Manually cleaning session for partner:', partnerIdStr);
  }
  
  return sessions.delete(partnerIdStr);
};

exports.entries = () => {
  // Return entries without exposing internal _cleanupTimer property
  const entries = [];
  for (const [key, value] of sessions.entries()) {
    const { _cleanupTimer, ...cleanValue } = value;
    entries.push([key, cleanValue]);
  }
  return entries[Symbol.iterator]();
};

exports.has = (partnerId) => {
  return sessions.has(partnerId.toString());
};

exports.size = () => {
  return sessions.size;
};

exports.clear = () => {
  // Clear all timers and secure delete all sessions
  for (const [partnerId, session] of sessions.entries()) {
    if (session._cleanupTimer) {
      clearTimeout(session._cleanupTimer);
    }
    if (session.signature) {
      session.signature = null;
    }
    if (session.pdfBuffer) {
      session.pdfBuffer.fill(0);
      session.pdfBuffer = null;
    }
  }
  sessions.clear();
  console.log('[SessionStore] All sessions cleared');
};

// Optional: Periodic cleanup of any leaked sessions (runs every 5 minutes)
const PERIODIC_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SESSION_AGE = 30 * 60 * 1000; // 30 minutes

const periodicCleanup = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [partnerId, session] of sessions.entries()) {
    if (session.createdAt && (now - session.createdAt) > MAX_SESSION_AGE) {
      console.log('[SessionStore] Periodic cleanup - removing stale session:', partnerId);
      
      if (session._cleanupTimer) {
        clearTimeout(session._cleanupTimer);
      }
      if (session.signature) {
        session.signature = null;
      }
      if (session.pdfBuffer) {
        session.pdfBuffer.fill(0);
        session.pdfBuffer = null;
      }
      
      sessions.delete(partnerId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[SessionStore] Periodic cleanup removed ${cleanedCount} stale sessions`);
  }
}, PERIODIC_CLEANUP_INTERVAL);

// Allow the interval to be cleared if the process exits
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    clearInterval(periodicCleanup);
  });
  
  // Also clean up on SIGTERM/SIGINT
  ['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, () => {
      clearInterval(periodicCleanup);
      exports.clear();
    });
  });
}

// Prevent the interval from keeping the process alive
if (periodicCleanup.unref) {
  periodicCleanup.unref();
}