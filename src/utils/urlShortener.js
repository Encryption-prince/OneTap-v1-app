import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@onetap_short_urls';
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;
const SHORT_PREFIX = 'onetap://s/';

// Generate a random 6-char alphanumeric code
const generateCode = () => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
};

// Load the full map from storage
const loadMap = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Save the map back to storage
const saveMap = async (map) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
};

/**
 * Shorten a full OneTap URL.
 * Returns a short string like "onetap://s/aB3xYz"
 */
export const shortenUrl = async (fullUrl) => {
  const map = await loadMap();

  // Check if this URL already has a code
  const existing = Object.entries(map).find(([, v]) => v === fullUrl);
  if (existing) return SHORT_PREFIX + existing[0];

  // Generate a unique code
  let code = generateCode();
  let attempts = 0;
  while (map[code] && attempts < 20) {
    code = generateCode();
    attempts++;
  }

  map[code] = fullUrl;
  await saveMap(map);
  return SHORT_PREFIX + code;
};

/**
 * Resolve a short URL back to the full URL.
 * Returns null if not found.
 */
export const resolveShortUrl = async (shortUrl) => {
  if (!shortUrl.startsWith(SHORT_PREFIX)) return null;
  const code = shortUrl.slice(SHORT_PREFIX.length);
  const map = await loadMap();
  return map[code] || null;
};

/**
 * Check if a string is a short URL
 */
export const isShortUrl = (url) => {
  return typeof url === 'string' && url.startsWith(SHORT_PREFIX);
};

/**
 * Remove expired/old entries (optional cleanup, keeps last 100)
 */
export const pruneOldUrls = async () => {
  const map = await loadMap();
  const keys = Object.keys(map);
  if (keys.length > 100) {
    const toDelete = keys.slice(0, keys.length - 100);
    toDelete.forEach((k) => delete map[k]);
    await saveMap(map);
  }
};
