import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated,
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
import { shortenUrl, resolveShortUrl, isShortUrl } from '../../src/utils/urlShortener';

const EXPIRY_UNITS = ['minutes', 'hours', 'days'];

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const base64ToUint8Array = (base64) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
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

const OFFICE_EXTENSIONS = new Set(['docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls']);

const needsConversion = (filename) => {
  const ext = (filename || '').split('.').pop().toLowerCase();
  return OFFICE_EXTENSIONS.has(ext);
};
const PROGRESS_STAGES = [
  { label: 'Reading file...', pct: 10 },
  { label: 'Encrypting file...', pct: 40 },
  { label: 'Preparing upload...', pct: 55 },
  { label: 'Uploading...', pct: 75 },
  { label: 'Converting document...', pct: 90 },
  { label: 'Finalizing...', pct: 100 },
];

export default function UploadScreen() {
  const insets = useSafeAreaInsets();
  const [selectedFile, setSelectedFile] = useState(null);
  const [expiryValue, setExpiryValue] = useState('1');
  const [expiryUnit, setExpiryUnit] = useState('days');
  const [isUploading, setIsUploading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [shortLink, setShortLink] = useState(null);
  const [showShort, setShowShort] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedShort, setCopiedShort] = useState(false);
  const [isShorteningUrl, setIsShorteningUrl] = useState(false);

  // Animated progress bar value 0–1
  const progressAnim = useRef(new Animated.Value(0)).current;
  // Copy button scale for bounce feedback
  const copyScale = useRef(new Animated.Value(1)).current;
  const copyShortScale = useRef(new Animated.Value(1)).current;

  const animateProgressTo = (pct) => {
    Animated.timing(progressAnim, {
      toValue: pct / 100,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const advanceStage = (index) => {
    setStageIndex(index);
    animateProgressTo(PROGRESS_STAGES[index].pct);
  };

  const bounceCopy = (scaleRef, setCopiedFn) => {
    setCopiedFn(true);
    Animated.sequence([
      Animated.spring(scaleRef, { toValue: 0.88, useNativeDriver: true, speed: 50 }),
      Animated.spring(scaleRef, { toValue: 1.08, useNativeDriver: true, speed: 30 }),
      Animated.spring(scaleRef, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    setTimeout(() => setCopiedFn(false), 2500);
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/*',
          'application/pdf',
          'text/*',
          'video/*',
          'audio/*',
          // Word
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          // PowerPoint
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.ms-powerpoint',
          // Excel
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      let asset = result.assets?.[0] || (result.uri ? { uri: result.uri, name: result.name, size: result.size, mimeType: result.mimeType } : null);
      if (!asset?.uri) { Toast.show({ type: 'error', text1: 'Could not read file' }); return; }
      if (asset.size && asset.size > 100 * 1024 * 1024) { Toast.show({ type: 'error', text1: 'File too large', text2: 'Max size is 100MB' }); return; }
      setSelectedFile(asset);
      setGeneratedLink(null);
      setShortLink(null);
      setShowShort(false);
      setCopied(false);
      progressAnim.setValue(0);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not pick file', text2: err.message });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile?.uri) { Toast.show({ type: 'error', text1: 'No file selected' }); return; }
    const expVal = parseInt(expiryValue, 10);
    if (!expVal || expVal <= 0) { Toast.show({ type: 'error', text1: 'Invalid expiry' }); return; }

    setIsUploading(true);
    setGeneratedLink(null);
    setShortLink(null);
    setShowShort(false);
    progressAnim.setValue(0);
    let encryptedUri = null;

    try {
      advanceStage(0); // Reading file
      const base64Data = await FileSystem.readAsStringAsync(selectedFile.uri, { encoding: 'base64' });
      if (!base64Data) throw new Error('Failed to read file');

      advanceStage(1); // Encrypting
      const fileBytes = base64ToUint8Array(base64Data);
      const arrayBuffer = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength);
      const { encryptedBuffer, base64Key } = await encryptData(arrayBuffer);

      advanceStage(2); // Preparing
      const encryptedBytes = new Uint8Array(encryptedBuffer);
      const CHUNK = 8192;
      let encBase64 = '';
      for (let i = 0; i < encryptedBytes.length; i += CHUNK) {
        encBase64 += String.fromCharCode(...encryptedBytes.subarray(i, i + CHUNK));
      }
      encBase64 = btoa(encBase64);
      encryptedUri = FileSystem.cacheDirectory + 'onetap_enc_' + Date.now();
      await FileSystem.writeAsStringAsync(encryptedUri, encBase64, { encoding: 'base64' });

      advanceStage(3); // Uploading
      const fileName = selectedFile.name || 'file';
      const mimeType = selectedFile.mimeType || 'application/octet-stream';
      const result = await apiService.uploadFile(encryptedUri, fileName, mimeType, expVal, expiryUnit);
      if (!result.success) throw new Error(result.error || 'Upload failed');

      // If Office file, poll until backend conversion is done
      if (needsConversion(fileName)) {
        advanceStage(4); // Converting document
        const convResult = await apiService.waitForConversion(result.fileId, (pct) => {
          animateProgressTo(75 + Math.round(pct * 0.15)); // 75–90%
        });
        if (!convResult.success) throw new Error(convResult.error);
      }

      advanceStage(needsConversion(selectedFile.name || '') ? 5 : 4); // Finalizing
      const displayName = needsConversion(fileName)
        ? fileName.replace(/\.(docx|doc|pptx|ppt|xlsx|xls)$/i, '.pdf')
        : fileName;
      const encodedFilename = encodeURIComponent(displayName);
      const frontendUrl = `https://one-tap-ten.vercel.app/view/${result.fileId}#key=${base64Key}&filename=${encodedFilename}`;

      // Small delay so user sees 100%
      await new Promise((r) => setTimeout(r, 500));

      setGeneratedLink({ url: frontendUrl, fileName: displayName });
      setSelectedFile(null);
      Toast.show({ type: 'success', text1: 'Link ready!', text2: 'Your secure link is generated' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: err.message });
      progressAnim.setValue(0);
    } finally {
      if (encryptedUri) FileSystem.deleteAsync(encryptedUri, { idempotent: true }).catch(() => {});
      setIsUploading(false);
      setStageIndex(0);
    }
  };

  const copyLink = async (url, scaleRef, setCopiedFn) => {
    if (!url) return;
    await Clipboard.setStringAsync(url);
    bounceCopy(scaleRef, setCopiedFn);
    Toast.show({ type: 'success', text1: 'Copied!', text2: 'Link copied to clipboard' });
  };

  const handleShortenUrl = async () => {
    if (!generatedLink?.url) return;
    setIsShorteningUrl(true);
    try {
      const short = await shortenUrl(generatedLink.url);
      setShortLink(short);
      setShowShort(true);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not shorten URL' });
    } finally {
      setIsShorteningUrl(false);
    }
  };

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const currentStage = PROGRESS_STAGES[stageIndex] || PROGRESS_STAGES[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upload & Share</Text>
          <View style={styles.shieldBadge}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.teal} />
          </View>
        </View>
        <Text style={styles.headerSub}>Files are encrypted end-to-end on your device</Text>

        {/* Drop Zone */}
        <TouchableOpacity onPress={pickFile} activeOpacity={0.85} style={styles.dropZoneWrapper} disabled={isUploading}>
          <LinearGradient colors={['rgba(124,58,237,0.12)', 'rgba(139,92,246,0.04)']} style={styles.dropZone}>
            <View style={styles.uploadIconBg}>
              <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} style={styles.uploadIconGrad}>
                <Ionicons name="cloud-upload" size={32} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.dropTitle}>{selectedFile ? selectedFile.name : 'Tap to select a file'}</Text>
            <Text style={styles.dropSub}>{selectedFile ? formatFileSize(selectedFile.size) : 'Images, PDF, video, audio, DOCX, PPTX, XLSX · Max 100MB'}</Text>
            {selectedFile && (
              <View style={styles.fileSelectedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
                <Text style={styles.fileSelectedText}>File selected</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* File card */}
        {selectedFile && !isUploading && (
          <View style={styles.fileCard}>
            <View style={styles.fileCardIcon}><Ionicons name="document" size={22} color={COLORS.lavender} /></View>
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
        {selectedFile && !isUploading && (
          <View style={styles.expirySection}>
            <View style={styles.expirySectionHeader}>
              <Ionicons name="time" size={18} color={COLORS.lavender} />
              <Text style={styles.expirySectionTitle}>Link Expires In</Text>
            </View>
            <View style={styles.expiryRow}>
              <TextInput style={styles.expiryInput} value={expiryValue} onChangeText={setExpiryValue} keyboardType="numeric" placeholderTextColor={COLORS.textMuted} maxLength={4} />
              <View style={styles.unitSelector}>
                {EXPIRY_UNITS.map((unit) => (
                  <TouchableOpacity key={unit} style={[styles.unitBtn, expiryUnit === unit && styles.unitBtnActive]} onPress={() => setExpiryUnit(unit)}>
                    <Text style={[styles.unitText, expiryUnit === unit && styles.unitTextActive]}>{unit.charAt(0).toUpperCase() + unit.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Upload button */}
        {selectedFile && !isUploading && (
          <TouchableOpacity onPress={handleUpload} activeOpacity={0.85} style={styles.uploadBtnWrapper}>
            <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.uploadBtn}>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={styles.uploadBtnText}>Generate Secure Link</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Progress bar while uploading */}
        {isUploading && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{currentStage.label}</Text>
              <Animated.Text style={styles.progressPct}>
                {currentStage.pct}%
              </Animated.Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>
            <Text style={styles.progressSub}>Please keep the app open</Text>
          </View>
        )}

        {/* Generated link */}
        {generatedLink && (
          <View style={styles.linkSection}>
            <View style={styles.linkHeader}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.green} />
              <Text style={styles.linkHeaderText}>Secure Link Generated</Text>
            </View>
            <Text style={styles.linkFileName} numberOfLines={1}>{generatedLink.fileName}</Text>

            {/* Toggle full / short */}
            <View style={styles.linkToggleRow}>
              <TouchableOpacity style={[styles.linkToggleBtn, !showShort && styles.linkToggleBtnActive]} onPress={() => setShowShort(false)}>
                <Text style={[styles.linkToggleText, !showShort && styles.linkToggleTextActive]}>Full URL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.linkToggleBtn, showShort && styles.linkToggleBtnActive]} onPress={() => { if (!shortLink) handleShortenUrl(); else setShowShort(true); }}>
                {isShorteningUrl
                  ? <Text style={styles.linkToggleText}>Shortening...</Text>
                  : <Text style={[styles.linkToggleText, showShort && styles.linkToggleTextActive]}>Short URL</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.linkBox}>
              <Text style={styles.linkUrl} numberOfLines={showShort ? 1 : 3} selectable>
                {showShort && shortLink ? shortLink : generatedLink.url}
              </Text>
            </View>

            {/* Copy button with bounce */}
            <Animated.View style={[styles.copyBtnWrapper, { transform: [{ scale: showShort ? copyShortScale : copyScale }] }]}>
              <TouchableOpacity
                onPress={() => showShort
                  ? copyLink(shortLink, copyShortScale, setCopiedShort)
                  : copyLink(generatedLink.url, copyScale, setCopied)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={(showShort ? copiedShort : copied) ? [COLORS.green, '#059669'] : [COLORS.purple, COLORS.purpleLight]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.copyBtn}
                >
                  <Ionicons name={(showShort ? copiedShort : copied) ? 'checkmark-circle' : 'copy'} size={18} color="#fff" />
                  <Text style={styles.copyBtnText}>{(showShort ? copiedShort : copied) ? 'Copied!' : 'Copy Link'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {showShort && shortLink && (
              <View style={styles.shortNoteBox}>
                <Ionicons name="information-circle" size={15} color={COLORS.lavender} />
                <Text style={styles.shortNoteText}>Short URLs only work on devices where this app is installed. Share the full URL for recipients without the app.</Text>
              </View>
            )}

            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color={COLORS.yellow} />
              <Text style={styles.warningText}>Keep this link safe — it contains the decryption key. Without it, the file cannot be recovered.</Text>
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
              <View style={styles.howIconBg}><Ionicons name={item.icon} size={16} color={COLORS.lavender} /></View>
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
  uploadBtn: { paddingVertical: 16, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  uploadBtnText: { color: '#fff', fontSize: SIZES.base, fontWeight: '700' },
  // Progress
  progressSection: { backgroundColor: 'rgba(124,58,237,0.1)', borderRadius: RADIUS.xl, padding: 20, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', marginBottom: 24 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressLabel: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '600' },
  progressPct: { color: COLORS.lavender, fontSize: SIZES.sm, fontWeight: '800' },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: 8, borderRadius: 4 },
  progressSub: { color: COLORS.textMuted, fontSize: SIZES.xs, textAlign: 'center' },
  // Link section
  linkSection: { backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: RADIUS.xl, padding: 20, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', marginBottom: 24 },
  linkHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  linkHeaderText: { color: COLORS.green, fontSize: SIZES.base, fontWeight: '700' },
  linkFileName: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginBottom: 14 },
  linkToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  linkToggleBtn: { flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  linkToggleBtnActive: { backgroundColor: 'rgba(124,58,237,0.25)', borderColor: COLORS.purple },
  linkToggleText: { color: COLORS.textMuted, fontSize: SIZES.xs, fontWeight: '600' },
  linkToggleTextActive: { color: COLORS.lavender },
  linkBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.md, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  linkUrl: { color: COLORS.textSecondary, fontSize: SIZES.xs, lineHeight: 18 },
  copyBtnWrapper: { marginBottom: 12 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.md },
  copyBtnText: { color: '#fff', fontSize: SIZES.base, fontWeight: '700' },
  shortNoteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: RADIUS.md, padding: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', marginBottom: 12 },
  shortNoteText: { color: COLORS.textMuted, fontSize: SIZES.xs, flex: 1, lineHeight: 17 },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  warningText: { color: COLORS.yellow, fontSize: SIZES.xs, flex: 1, lineHeight: 18 },
  howItWorks: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  howTitle: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700', marginBottom: 14 },
  howRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  howIconBg: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  howText: { color: COLORS.textSecondary, fontSize: SIZES.sm, flex: 1, lineHeight: 20 },
});
