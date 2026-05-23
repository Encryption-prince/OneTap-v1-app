import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS, SIZES, RADIUS } from '../../src/constants/theme';
import { resolveShortUrl, isShortUrl } from '../../src/utils/urlShortener';

export default function OpenLinkScreen() {
  const insets = useSafeAreaInsets();
  const [linkInput, setLinkInput] = useState('');
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const isValidLink = (val) => {
    const trimmed = val.trim();
    return isShortUrl(trimmed) || trimmed.startsWith('https://one-tap-ten.vercel.app');
  };

  const isValid = isValidLink(linkInput);
  const hasInput = linkInput.trim().length > 0;

  // Glow in when valid, glow out when not
  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: isValid ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isValid]);

  const shakeInput = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.border || 'rgba(255,255,255,0.12)', '#14B8A6'],
  });

  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const handleOpenLink = async () => {
    const trimmed = linkInput.trim();
    if (!trimmed) { shakeInput(); return; }

    // Resolve short URL first
    let url = trimmed;
    if (isShortUrl(trimmed)) {
      const resolved = await resolveShortUrl(trimmed);
      if (!resolved) {
        shakeInput();
        return;
      }
      url = resolved;
    }

    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/');
      const fileId = pathParts[pathParts.length - 1];
      const hash = parsed.hash.substring(1);
      const params = new URLSearchParams(hash);
      const key = params.get('key') || '';
      const filename = decodeURIComponent(params.get('filename') || 'file');
      router.push({ pathname: '/view', params: { fileId, key, filename } });
    } catch {
      router.push({ pathname: '/view', params: { rawLink: url } });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Open Secure Link</Text>
      </View>

      <View style={styles.content}>
        {/* Icon */}
        <LinearGradient
          colors={['rgba(124,58,237,0.2)', 'rgba(139,92,246,0.05)']}
          style={styles.card}
        >
          <View style={styles.iconWrap}>
            <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} style={styles.iconGrad}>
              <Ionicons name="link" size={36} color="#fff" />
            </LinearGradient>
          </View>

          <Text style={styles.cardTitle}>View a Shared File</Text>
          <Text style={styles.cardSub}>
            Paste the secure link you received. The file will be decrypted and shown only on your device.
          </Text>

          {/* Input */}
          <Animated.View style={[
            styles.inputRow,
            { borderColor, transform: [{ translateX: shakeAnim }] },
            isValid && { shadowColor: '#14B8A6', shadowOffset: { width: 0, height: 0 }, shadowRadius: 8, shadowOpacity, elevation: 4 },
          ]}>
            <Ionicons
              name={isValid ? 'checkmark-circle' : 'link-outline'}
              size={18}
              color={isValid ? COLORS.teal : COLORS.textMuted}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.input}
              placeholder="https://one-tap-ten.vercel.app/view/..."
              placeholderTextColor={COLORS.textMuted}
              value={linkInput}
              onChangeText={setLinkInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {linkInput.length > 0 && (
              <TouchableOpacity onPress={() => setLinkInput('')} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Open button */}
          <TouchableOpacity
            onPress={handleOpenLink}
            activeOpacity={0.85}
            style={[styles.openBtnWrap, !linkInput.trim() && { opacity: 0.5 }]}
          >
            <LinearGradient
              colors={[COLORS.purple, COLORS.purpleLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.openBtn}
            >
              <Ionicons name="eye" size={20} color="#fff" />
              <Text style={styles.openBtnText}>Open File</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>

        {/* Info note */}
        <View style={styles.noteBox}>
          <Ionicons name="shield-checkmark" size={16} color={COLORS.teal} />
          <Text style={styles.noteText}>
            The decryption key is embedded in the link — it never leaves your device and the server cannot read your file.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '800' },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  card: { borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, padding: 28, alignItems: 'center', marginBottom: 16 },
  iconWrap: { marginBottom: 20, shadowColor: COLORS.purple, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  iconGrad: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '800', marginBottom: 10 },
  cardSub: { color: COLORS.textSecondary, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, marginBottom: 20, width: '100%' },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: SIZES.sm, paddingVertical: 14 },
  openBtnWrap: { width: '100%', borderRadius: RADIUS.lg, overflow: 'hidden' },
  openBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: RADIUS.lg },
  openBtnText: { color: '#fff', fontSize: SIZES.base, fontWeight: '700' },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(20,184,166,0.08)', borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)' },
  noteText: { color: COLORS.textSecondary, fontSize: SIZES.xs, flex: 1, lineHeight: 18 },
});
