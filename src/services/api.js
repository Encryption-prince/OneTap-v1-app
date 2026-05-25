const API_BASE_URL = 'https://respectable-jaclyn-koyebuser1-38d6aeac.koyeb.app/api';

class ApiService {
  constructor() { this.baseURL = API_BASE_URL; }

  convertExpiryToMinutes(value, unit) {
    const n = parseInt(value, 10) || 1;
    if (unit === 'hours') return n * 60;
    if (unit === 'days') return n * 24 * 60;
    return n;
  }

  async getRedisUsage() {
    try {
      const res = await fetch(`${this.baseURL}/redis/usage`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      // The API returns { usedMemoryMB, peakMemoryMB }
      // peakMemoryMB is NOT the limit — it's just the historical peak usage.
      // The actual Redis dataset limit is 30 MB (from the Upstash plan).
      // Available = 30 MB - usedMemoryMB
      const DATASET_LIMIT_MB = 30;
      const usedMB = data?.usedMemoryMB ?? 0;
      const availableMB = Math.max(DATASET_LIMIT_MB - usedMB, 0);

      return { success: true, available_bytes: availableMB * 1024 * 1024 };
    } catch (e) {
      // If the check fails, allow upload anyway — server will reject if truly full
      return { success: true, available_bytes: 30 * 1024 * 1024 };
    }
  }

  async uploadFile(fileUri, fileName, mimeType, expiryValue = 1, expiryUnit = 'days') {
    try {
      const formData = new FormData();
      formData.append('file', { uri: fileUri, name: fileName, type: mimeType || 'application/octet-stream' });
      const mins = this.convertExpiryToMinutes(expiryValue, expiryUnit);
      const res = await fetch(`${this.baseURL}/files/upload?expiryMinutes=${mins}`, { method: 'POST', body: formData });
      if (!res.ok) throw new Error(await res.text());
      const link = await res.text();
      const fileId = link.split('/').pop();
      return { success: true, link, fileId };
    } catch (e) { return { success: false, error: e.message }; }
  }

  /**
   * Poll conversion status until READY or ERROR.
   * Returns { success: true } when ready, { success: false, error } on failure.
   */
  async waitForConversion(fileId, onProgress, maxWaitMs = 120000) {
    const interval = 2500;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        const res = await fetch(`${this.baseURL}/files/status/${fileId}`);
        const status = await res.text();
        if (status === 'READY') return { success: true };
        if (status === 'ERROR') return { success: false, error: 'Document conversion failed on server' };
        if (status === 'NOT_FOUND') return { success: false, error: 'File not found' };
        // Still CONVERTING — notify caller and wait
        if (onProgress) onProgress(Math.min(90, Math.round(((Date.now() - start) / maxWaitMs) * 90)));
      } catch (e) {
        // Network hiccup — keep polling
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    return { success: false, error: 'Conversion timed out. Please try again.' };
  }

  async downloadFile(fileId) {
    try {
      const res = await fetch(`${this.baseURL}/files/view/${fileId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('File not found. It may have expired or already been downloaded.');
        throw new Error(await res.text());
      }
      let expiryTimestamp = null;
      const secs = res.headers.get('X-Expiry-Seconds');
      if (secs) expiryTimestamp = Date.now() + parseInt(secs, 10) * 1000;
      const blob = await res.blob();
      return { success: true, blob, expiryTimestamp };
    } catch (e) { return { success: false, error: e.message }; }
  }
}

export default new ApiService();
