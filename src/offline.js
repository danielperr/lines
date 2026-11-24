// Registers the offline service worker and asks the browser not to evict saved data.
// Both need a secure origin (https or localhost); on plain http over Wi-Fi they are skipped.

export const registerOffline = () => {
  if (!window.isSecureContext) return;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Offline support unavailable:', error);
    });
  }
  if (navigator.storage?.persist) {
    navigator.storage.persist().catch((error) => {
      console.warn('Could not request persistent storage:', error);
    });
  }
};
