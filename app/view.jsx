import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Image, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as ScreenCapture from 'expo-screen-capture';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Video, Audio, ResizeMode } from 'expo-av';
import { WebView } from 'react-native-webview';
import { COLORS, SIZES, RADIUS } from '../src/constants/theme';
import apiService from '../src/services/api';
import { decryptData } from '../src/utils/encryption';

const { height } = Dimensions.get('window');

const getMimeType = (filename) => {
  const ext = (filename || '').split('.').pop().toLowerCase();
  const map = {
    // images
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    // documents
    pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain',
    // video
    mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', webm: 'video/webm', avi: 'video/x-msvideo',
    // audio
    mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
  };
  return map[ext] || 'application/octet-stream';
};

export default function ViewScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  // Resolve params — may come directly or from rawLink
  let resolvedFileId = params.fileId;
  let resolvedKey = params.key;
  let resolvedFilename = params.filename || 'file';

  if (!resolvedFileId && params.rawLink) {
    try {
      const url = new URL(params.rawLink);
      resolvedFileId = url.pathname.split('/').pop();
      const hash = url.hash.substring(1);
      const p = new URLSearchParams(hash);
      resolvedKey = p.get('key') || '';
      resolvedFilename = decodeURIComponent(p.get('filename') || 'file');
    } catch {}
  }

  const [status, setStatus] = useState('ready');
  const [error, setError] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);

  // Audio player state
  const [sound, setSound] = useState(null);
  const [audioStatus, setAudioStatus] = useState({ isPlaying: false, positionMillis: 0, durationMillis: 0 });
  const videoRef = useRef(null);

  useEffect(() => {
    return () => {
      if (fileInfo?.localUri) FileSystem.deleteAsync(fileInfo.localUri, { idempotent: true }).catch(() => {});
      if (sound) sound.unloadAsync().catch(() => {});
    };
  }, [fileInfo, sound]);

  // Prevent screenshots while viewing a file
  useEffect(() => {
    if (status === 'viewing') {
      // Block screenshots and screen recording
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});

      // Listen for screenshot attempts — show warning toast
      const subscription = ScreenCapture.addScreenshotListener(() => {
        Toast.show({
          type: 'error',
          text1: 'Screenshot blocked',
          text2: 'Screenshots are not allowed for secure files',
        });
      });

      return () => {
        // Re-allow screenshots when leaving the view
        ScreenCapture.allowScreenCaptureAsync().catch(() => {});
        subscription.remove();
      };
    }
  }, [status]);

  const startCountdown = (expiryTimestamp) => {
    if (!expiryTimestamp) return;
    const timer = setInterval(() => {
      const remaining = expiryTimestamp - Date.now();
      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft(null);
        setStatus('error');
        setError('Session expired. This secure link has timed out.');
        Toast.show({ type: 'error', text1: 'Session Expired' });
      } else {
        const secs = Math.floor(remaining / 1000);
        const mins = Math.floor(secs / 60);
        const hrs = Math.floor(mins / 60);
        if (hrs > 0) setTimeLeft(`${hrs}h ${mins % 60}m`);
        else if (mins > 0) setTimeLeft(`${mins}m ${secs % 60}s`);
        else setTimeLeft(`${secs}s`);
      }
    }, 1000);
    return () => clearInterval(timer);
  };

  const handleViewFile = async () => {
    if (!resolvedFileId || !resolvedKey) {
      setError('Invalid link. Missing file ID or decryption key.');
      setStatus('error');
      return;
    }
    setStatus('processing');
    setError('');
    try {
      const result = await apiService.downloadFile(resolvedFileId);
      if (!result.success) throw new Error(result.error);

      const blobBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(result.blob);
      });

      const decrypted = await decryptData(blobBuffer, resolvedKey);
      const mimeType = getMimeType(resolvedFilename);
      const ext = resolvedFilename.split('.').pop().toLowerCase();
      const localUri = FileSystem.cacheDirectory + `onetap_${Date.now()}.${ext}`;

      const uint8 = new Uint8Array(decrypted);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      await FileSystem.writeAsStringAsync(localUri, btoa(binary), { encoding: FileSystem.EncodingType.Base64 });

      if (mimeType.startsWith('text/')) {
        const text = await FileSystem.readAsStringAsync(localUri);
        setTextContent(text);
      }

      setFileInfo({ localUri, mimeType, filename: resolvedFilename, expiryTimestamp: result.expiryTimestamp });
      setStatus('viewing');
      if (result.expiryTimestamp) startCountdown(result.expiryTimestamp);
    } catch (err) {
      setError(err.message || 'Decryption failed. The key may be incorrect.');
      setStatus('error');
    }
  };

  const handleShare = async () => {
    if (!fileInfo?.localUri) return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(fileInfo.localUri, { mimeType: fileInfo.mimeType });
    else Toast.show({ type: 'error', text1: 'Sharing not available on this device' });
  };

  // Audio controls
  const handleAudioPlayPause = async () => {
    if (!fileInfo?.localUri) return;
    if (!sound) {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: fileInfo.localUri },
        { shouldPlay: true },
        (s) => setAudioStatus(s)
      );
      setSound(newSound);
    } else {
      if (audioStatus.isPlaying) await sound.pauseAsync();
      else await sound.playAsync();
    }
  };

  const handleAudioSeek = async (millis) => {
    if (sound) await sound.setPositionAsync(millis);
  };

  const formatTime = (millis) => {
    if (!millis) return '0:00';
    const secs = Math.floor(millis / 1000);
    const mins = Math.floor(secs / 60);
    return `${mins}:${String(secs % 60).padStart(2, '0')}`;
  };

  const renderPreview = () => {
    if (!fileInfo) return null;
    const { mimeType, localUri } = fileInfo;

    // Image
    if (mimeType.startsWith('image/')) {
      return (
        <Image
          source={{ uri: localUri }}
          style={styles.previewImage}
          resizeMode="contain"
        />
      );
    }

    // Text
    if (mimeType.startsWith('text/')) {
      return (
        <ScrollView style={styles.textPreview}>
          <Text style={styles.textContent}>{textContent}</Text>
        </ScrollView>
      );
    }

    // Video
    if (mimeType.startsWith('video/')) {
      return (
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: localUri }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay={false}
            isLooping={false}
          />
          <View style={styles.securityBadge}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.teal} />
            <Text style={styles.securityBadgeText}>Secure playback — recording blocked</Text>
          </View>
        </View>
      );
    }

    // Audio
    if (mimeType.startsWith('audio/')) {
      const progress = audioStatus.durationMillis
        ? audioStatus.positionMillis / audioStatus.durationMillis
        : 0;
      return (
        <View style={styles.audioContainer}>
          <LinearGradient
            colors={['rgba(124,58,237,0.2)', 'rgba(139,92,246,0.05)']}
            style={styles.audioCard}
          >
            <View style={styles.audioIconBg}>
              <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} style={styles.audioIconGrad}>
                <Ionicons name="musical-notes" size={40} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={styles.audioFilename} numberOfLines={2}>{fileInfo.filename}</Text>

            {/* Progress bar */}
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.audioTimeRow}>
              <Text style={styles.audioTime}>{formatTime(audioStatus.positionMillis)}</Text>
              <Text style={styles.audioTime}>{formatTime(audioStatus.durationMillis)}</Text>
            </View>

            {/* Play/Pause */}
            <TouchableOpacity onPress={handleAudioPlayPause} style={styles.audioPlayBtn} activeOpacity={0.8}>
              <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} style={styles.audioPlayGrad}>
                <Ionicons
                  name={audioStatus.isPlaying ? 'pause' : 'play'}
                  size={32}
                  color="#fff"
                />
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.securityBadge}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.teal} />
              <Text style={styles.securityBadgeText}>Secure playback — recording blocked</Text>
            </View>
          </LinearGradient>
        </View>
      );
    }

    // PDF
    if (mimeType === 'application/pdf') {
      // Render PDF via WebView using base64 data URI
      const pdfHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { background: #0F0A1E; width: 100%; height: 100vh; overflow: hidden; }
              embed { width: 100%; height: 100vh; }
            </style>
          </head>
          <body>
            <embed src="${localUri}" type="application/pdf" width="100%" height="100%" />
          </body>
        </html>
      `;
      return (
        <View style={styles.pdfContainer}>
          <WebView
            source={{ uri: localUri }}
            style={styles.pdfWebView}
            originWhitelist={['*']}
            allowFileAccess={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            onLongPress={() => {}}
            contextMenuHidden={true}
            allowsLinkPreview={false}
          />
          <View style={styles.securityBadge}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.teal} />
            <Text style={styles.securityBadgeText}>Secure view — download blocked</Text>
          </View>
        </View>
      );
    }

    // Unsupported
    return (
      <View style={styles.unsupportedPreview}>
        <Ionicons name="document" size={64} color={COLORS.lavender} />
        <Text style={styles.unsupportedTitle}>{fileInfo.filename}</Text>
        <Text style={styles.unsupportedSub}>Preview not available for this file type</Text>
        <View style={styles.warningBadge}>
          <Ionicons name="shield-checkmark" size={16} color={COLORS.teal} />
          <Text style={styles.warningBadgeText}>File is secured — download disabled</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {status === 'viewing' ? fileInfo?.filename : 'Secure File'}
        </Text>
        {/* No share/download button — secure files cannot be saved */}
        <View style={{ width: 36 }} />
      </View>

      {timeLeft && (
        <View style={styles.timerBanner}>
          <Ionicons name="timer" size={16} color={COLORS.yellow} />
          <Text style={styles.timerText}>Session expires in: {timeLeft}</Text>
        </View>
      )}

      <View style={styles.content}>
        {status === 'ready' && (
          <View style={styles.readyContainer}>
            <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(139,92,246,0.05)']} style={styles.readyCard}>
              <View style={styles.readyIconBg}>
                <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} style={styles.readyIconGrad}>
                  <Ionicons name="lock-closed" size={36} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.readyTitle}>Secure File Access</Text>
              <Text style={styles.readySub}>This is a one-time access link. The file will be decrypted and shown on your device.</Text>
              <View style={styles.readyInfo}>
                <Ionicons name="document" size={16} color={COLORS.lavender} />
                <Text style={styles.readyFileName} numberOfLines={1}>{resolvedFilename}</Text>
              </View>
              <TouchableOpacity onPress={handleViewFile} activeOpacity={0.85} style={styles.viewBtnWrapper}>
                <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.viewBtn}>
                  <Ionicons name="eye" size={20} color="#fff" />
                  <Text style={styles.viewBtnText}>View File</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}

        {status === 'processing' && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color={COLORS.lavender} />
            <Text style={styles.processingText}>Decrypting file...</Text>
            <Text style={styles.processingSub}>This may take a moment</Text>
          </View>
        )}

        {status === 'viewing' && (
          <View style={styles.viewingContainer}>{renderPreview()}</View>
        )}

        {status === 'error' && (
          <View style={styles.errorContainer}>
            <Ionicons name="close-circle" size={56} color={COLORS.red} />
            <Text style={styles.errorTitle}>Access Failed</Text>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
              <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.backHomeBtn}>
                <Ionicons name="home" size={18} color="#fff" />
                <Text style={styles.backHomeBtnText}>Back to Home</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { flex: 1, color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700' },
  shareIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },
  timerBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(245,158,11,0.2)', paddingHorizontal: 16, paddingVertical: 8 },
  timerText: { color: COLORS.yellow, fontSize: SIZES.sm, fontWeight: '600' },
  content: { flex: 1 },
  readyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  readyCard: { width: '100%', borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, padding: 32, alignItems: 'center' },
  readyIconBg: { marginBottom: 24, shadowColor: COLORS.purple, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  readyIconGrad: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  readyTitle: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '800', marginBottom: 12 },
  readySub: { color: COLORS.textSecondary, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  readyInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(167,139,250,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, marginBottom: 28, maxWidth: '100%' },
  readyFileName: { color: COLORS.lavender, fontSize: SIZES.sm, fontWeight: '600', flex: 1 },
  viewBtnWrapper: { width: '100%', borderRadius: RADIUS.lg, overflow: 'hidden', marginBottom: 12 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: RADIUS.lg },
  viewBtnText: { color: '#fff', fontSize: SIZES.base, fontWeight: '700' },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  cancelText: { color: COLORS.textMuted, fontSize: SIZES.base },
  processingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  processingText: { color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '600' },
  processingSub: { color: COLORS.textMuted, fontSize: SIZES.sm },
  viewingContainer: { flex: 1 },
  previewImage: { width: '100%', height: height * 0.7 },
  textPreview: { flex: 1, padding: 16 },
  textContent: { color: COLORS.textSecondary, fontSize: SIZES.sm, lineHeight: 22 },
  // Video
  videoContainer: { flex: 1, backgroundColor: '#000' },
  video: { width: '100%', height: height * 0.45 },
  // Audio
  audioContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  audioCard: { width: '100%', borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, padding: 32, alignItems: 'center', gap: 16 },
  audioIconBg: { shadowColor: COLORS.purple, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  audioIconGrad: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  audioFilename: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700', textAlign: 'center' },
  progressBarBg: { width: '100%', height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
  progressBarFill: { height: 4, backgroundColor: COLORS.purple, borderRadius: 2 },
  audioTimeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  audioTime: { color: COLORS.textMuted, fontSize: SIZES.xs },
  audioPlayBtn: { borderRadius: 40, overflow: 'hidden' },
  audioPlayGrad: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  // PDF
  pdfContainer: { flex: 1 },
  pdfWebView: { flex: 1, backgroundColor: '#0F0A1E' },
  // Security badge
  securityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(20,184,166,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)', margin: 8 },
  securityBadgeText: { color: COLORS.teal, fontSize: SIZES.xs, fontWeight: '600' },
  unsupportedPreview: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  unsupportedTitle: { color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '700', textAlign: 'center' },
  unsupportedSub: { color: COLORS.textMuted, fontSize: SIZES.sm, textAlign: 'center' },
  warningBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(20,184,166,0.12)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(20,184,166,0.3)', marginTop: 8 },
  warningBadgeText: { color: COLORS.teal, fontSize: SIZES.sm, fontWeight: '600' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  errorTitle: { color: COLORS.red, fontSize: SIZES.xxl, fontWeight: '800' },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: RADIUS.md, padding: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', width: '100%' },
  errorText: { color: '#FCA5A5', fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },
  backHomeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 28, borderRadius: RADIUS.lg },
  backHomeBtnText: { color: '#fff', fontSize: SIZES.base, fontWeight: '700' },
});
