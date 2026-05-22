import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { COLORS, SIZES, RADIUS } from '../../src/constants/theme';
import apiService from '../../src/services/api';
import { encryptData, arrayBufferToBase64Url } from '../../src/utils/encryption';

const EXPIRY_UNITS = ['minutes', 'hours', 'days'];

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Decode base64 string to Uint8Array without using atob (which can fail on large strings)
const base64ToUint8Array = (base64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  // Remove padding
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor(clean.length * 3 / 4);
  const bytes = new Uint8Array(len);
  let byteIndex = 0;

  for (let i = 0; i < clean.length; i += 4) {
    const a = lookup[clean.charCodeAt(i)];
    const b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)];
    const d = lookup[clean.charCodeAt(i + 3)];
    bytes[byteIndex++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) bytes[byteIndex++] = ((b & 0xf) << 4) | (c >> 2);
    if (i + 3 < clean.length) bytes[byteIndex++] = ((c & 0x3) << 6) | d;
  }
  return bytes.slice(0, byteIndex);
};

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const [selectedFile, setSelectedFile] = useState(null);
  const [expiryValue, setExpiryValue] = useState('1');
  const [expiryUnit, setExpiryUnit] = useState('days');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'text/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      // Handle both old API (result.uri) and new API (result.assets[0])
      let asset = null;
      if (result.assets && result.assets.length > 0) {
        asset = result.assets[0];
      } else if (result.uri) {
        // Legacy format
        asset = { uri: result.uri, name: result.name, size: result.size, mimeType: result.mimeType };
      }

      if (!asset || !asset.uri) {
        Toast.show({ type: 'error', text1: 'Could not read file', text2: 'No file URI found' });
        return;
      }

      if (asset.size && asset.size > 100 * 1024 * 1024) {
        Toast.show({ type: 'error', text1: 'File too large', text2: 'Max size is 100MB' });
        return;
      }

      setSelectedFile(asset);
      setGeneratedLink(null);
      setCopied(false);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not pick file', text2: err.message });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedFile.uri) {
      Toast.show({ type: 'error', text1: 'No file selected', text2: 'Please pick a file first' });
      return;
    }

    const expVal = parseInt(expiryValue, 10);
    if (!expVal || expVal <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid expiry', text2: 'Must be greater than 0' });
      return;
    }

    setIsUploading(true);
    setGeneratedLink(null);
    let encryptedUri = null;

    try {
      // 1. Read file as base64
      setUploadStatus('Reading file...');
      const base64Data = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: 'base64',
      });

      if (!base64Data) throw new Error('Failed to read file — empty data returned');

      // 3. Convert base64 → Uint8Array (safe for large files)
      setUploadStatus('Encrypting file...');
      const fileBytes = base64ToUint8Array(base64Data);
      const arrayBuffer = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength);

      // 4. Encrypt
      const { encryptedBuffer, base64Key } = await encryptData(arrayBuffer);

      // 5. Convert encrypted buffer back to base64 and write to cache
      setUploadStatus('Preparing upload...');
      const encryptedBytes = new Uint8Array(encryptedBuffer);
      // Build base64 in chunks to avoid stack overflow
      const CHUNK = 8192;
      let encBase64 = '';
      for (let i = 0; i < encryptedBytes.length; i += CHUNK) {
        encBase64 += String.fromCharCode(...encryptedBytes.subarray(i, i + CHUNK));
      }
      encBase64 = btoa(encBase64);

      encryptedUri = FileSystem.cacheDirectory + 'onetap_enc_' + Date.now();
      await FileSystem.writeAsStringAsync(encryptedUri, encBase64, {
        encoding: 'base64',
      });

      // 6. Upload
      setUploadStatus('Uploading...');
      const fileName = selectedFile.name || 'file';
      const mimeType = selectedFile.mimeType || 'application/octet-stream';

      const result = await apiService.uploadFile(encryptedUri, fileName, mimeType, expVal, expiryUnit);
      if (!result.success) throw new Error(result.error || 'Upload failed');

      // 7. Build shareable link
      const encodedFilename = encodeURIComponent(fileName);
      const frontendUrl = `https://one-tap-ten.vercel.app/view/${result.fileId}#key=${base64Key}&filename=${encodedFilename}`;

      setGeneratedLink({ url: frontendUrl, fileName });
      setSelectedFile(null);
      Toast.show({ type: 'success', text1: 'Upload successful!', text2: 'Your secure link is ready' });

    } catch (err) {
      console.error('Upload error:', err);
      Toast.show({ type: 'error', text1: 'Upload failed', text2: err.message });
    } finally {
      // Cleanup temp encrypted file
      if (encryptedUri) {
        FileSystem.deleteAsync(encryptedUri, { idempotent: true }).catch(() => {});
      }
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    await Clipboard.setStringAsync(generatedLink.url);
    setCopied(true);
    Toast.show({ type: 'success', text1: 'Copied!', text2: 'Link copied to clipboard' });
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upload & Share</Text>
          <View style={styles.shieldBadge}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.teal} />
          </View>
        </View>
        <Text style={styles.headerSub}>Files are encrypted end-to-end on your device</Text>

        {/* Drop Zone */}
        <TouchableOpacity onPress={pickFile} activeOpacity={0.85} style={styles.dropZoneWrapper}>
          <LinearGradient
            colors={['rgba(124,58,237,0.12)', 'rgba(139,92,246,0.04)']}
            style={styles.dropZone}
          >
            <View style={styles.uploadIconBg}>
              <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} style={styles.uploadIconGrad}>
                <Ionicons name="cloud-upload" size={32} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.dropTitle}>
              {selectedFile ? selectedFile.name : 'Tap to select a file'}
            </Text>
            <Text style={styles.dropSub}>
              {selectedFile
                ? formatFileSize(selectedFile.size)
                : 'Images, PDFs, text files · Max 100MB'}
            </Text>
            {selectedFile && (
              <View style={styles.fileSelectedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
                <Text style={styles.fileSelectedText}>File selected</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Selected file card */}
        {selectedFile && (
          <View style={styles.fileCard}>
            <View style={styles.fileCardIcon}>
              <Ionicons name="document" size={22} color={COLORS.lavender} />
            </View>
            <View style={styles.fileCardInfo}>
              <Text style={styles.fileCardName} numberOfLines={1}>{selectedFile.name}</Text>
              <Text style={styles.fileCardSize}>{formatFileSize(selectedFile.size)}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedFile(null)} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Expiry */}
        {selectedFile && (
          <View style={styles.expirySection}>
            <View style={styles.expirySectionHeader}>
              <Ionicons name="time" size={18} color={COLORS.lavender} />
              <Text style={styles.expirySectionTitle}>Link Expires In</Text>
            </View>
            <View style={styles.expiryRow}>
              <TextInput
                style={styles.expiryInput}
                value={expiryValue}
                onChangeText={setExpiryValue}
                keyboardType="numeric"
                placeholderTextColor={COLORS.textMuted}
                maxLength={4}
              />
              <View style={styles.unitSelector}>
                {EXPIRY_UNITS.map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[styles.unitBtn, expiryUnit === unit && styles.unitBtnActive]}
                    onPress={() => setExpiryUnit(unit)}
                  >
                    <Text style={[styles.unitText, expiryUnit === unit && styles.unitTextActive]}>
                      {unit.charAt(0).toUpperCase() + unit.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Upload button */}
        {selectedFile && (
          <TouchableOpacity
            onPress={handleUpload}
            disabled={isUploading}
            activeOpacity={0.85}
            style={styles.uploadBtnWrapper}
          >
            <LinearGradient
              colors={isUploading ? ['#4B5563', '#374151'] : [COLORS.purple, COLORS.purpleLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.uploadBtn}
            >
              {isUploading ? (
                <View style={styles.row}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.uploadBtnText}>{uploadStatus || 'Processing...'}</Text>
                </View>
              ) : (
                <View style={styles.row}>
                  <Ionicons name="lock-closed" size={18} color="#fff" />
                  <Text style={styles.uploadBtnText}>Generate Secure Link</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Generated link */}
        {generatedLink && (
          <View style={styles.linkSection}>
            <View style={styles.row}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
              <Text style={styles.linkHeaderText}>Secure Link Generated</Text>
            </View>
            <Text style={styles.linkFileName} numberOfLines={1}>{generatedLink.fileName}</Text>
            <View style={styles.linkBox}>
              <Text style={styles.linkUrl} numberOfLines={3}>{generatedLink.url}</Text>
            </View>
            <TouchableOpacity onPress={copyLink} activeOpacity={0.85}>
              <LinearGradient
                colors={copied ? [COLORS.green, '#059669'] : [COLORS.purple, COLORS.purpleLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.copyBtn}
              >
                <Ionicons name={copied ? 'checkmark' : 'copy'} size={18} color="#fff" />
                <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy Link'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color={COLORS.yellow} />
              <Text style={styles.warningText}>
                Keep this link safe! It contains the decryption key. Without it, the file cannot be recovered.
              </Text>
            </View>
          </View>
        )}

        {/* How it works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How it works</Text>
          {[
            { icon: 'lock-closed', text: 'Your file is encrypted on your device before upload' },
            { icon: 'link', text: 'Get a secure, one-time access link with the key' },
            { icon: 'timer', text: 'The link expires after the first view or time limit' },
            { icon: 'trash', text: 'Encrypted files are permanently deleted from servers' },
          ].map((item, i) => (
            <View key={i} style={styles.howRow}>
              <View style={styles.howIconBg}>
                <Ionicons name={item.icon} size={16} color={COLORS.lavender} />
              </View>
              <Text style={styles.howText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 4 },
  headerTitle: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '800' },
  shieldBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(20,184,166,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerSub: { color: COLORS.textMuted, fontSize: SIZES.sm, marginBottom: 24 },
  dropZoneWrapper: { borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: 16 },
  dropZone: { borderRadius: RADIUS.xl, borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', padding: 32, alignItems: 'center' },
  uploadIconBg: { marginBottom: 16, shadowColor: COLORS.purple, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  uploadIconGrad: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dropTitle: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '600', textAlign: 'center' },
  dropSub: { color: COLORS.textMuted, fontSize: SIZES.sm, marginTop: 6, textAlign: 'center' },
  fileSelectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  fileSelectedText: { color: COLORS.green, fontSize: SIZES.sm, fontWeight: '600' },
  fileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  fileCardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  fileCardInfo: { flex: 1 },
  fileCardName: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '600' },
  fileCardSize: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  expirySection: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 16 },
  expirySectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  expirySectionTitle: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '600' },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  expiryInput: { width: 64, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '700', textAlign: 'center', paddingVertical: 10 },
  unitSelector: { flexDirection: 'row', gap: 8, flex: 1 },
  unitBtn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  unitBtnActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  unitText: { color: COLORS.textMuted, fontSize: SIZES.xs, fontWeight: '600' },
  unitTextActive: { color: '#fff' },
  uploadBtnWrapper: { borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 24 },
  uploadBtn: { paddingVertical: 16, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  uploadBtnText: { color: '#fff', fontSize: SIZES.base, fontWeight: '700' },
  linkSection: { backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: RADIUS.xl, padding: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', marginBottom: 24 },
  linkHeaderText: { color: COLORS.green, fontSize: SIZES.base, fontWeight: '700', marginLeft: 8 },
  linkFileName: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginBottom: 12, marginTop: 8 },
  linkBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.md, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  linkUrl: { color: COLORS.textSecondary, fontSize: SIZES.xs, lineHeight: 18 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md, marginBottom: 16 },
  copyBtnText: { color: '#fff', fontSize: SIZES.base, fontWeight: '700' },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  warningText: { color: COLORS.yellow, fontSize: SIZES.xs, flex: 1, lineHeight: 18 },
  howItWorks: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  howTitle: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700', marginBottom: 14 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  howIconBg: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  howText: { color: COLORS.textSecondary, fontSize: SIZES.sm, flex: 1, lineHeight: 20 },
});
