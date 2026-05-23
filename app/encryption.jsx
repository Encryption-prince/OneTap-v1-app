import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS, SIZES, RADIUS } from '../src/constants/theme';

const STEPS = [
  {
    icon: 'phone-portrait',
    color: '#7C3AED',
    title: 'Everything starts on your phone',
    body: "When you pick a file to share, nothing is sent to the internet yet. Your phone first creates a secret key — a long random password that only exists on your device at that moment.",
  },
  {
    icon: 'lock-closed',
    color: '#EC4899',
    title: 'The file is locked with that key',
    body: "Your phone scrambles the file using that secret key. Think of it like putting your file in a safe and locking it. Even if someone intercepts the locked file, it looks like complete gibberish without the key.",
  },
  {
    icon: 'cloud-upload',
    color: '#06B6D4',
    title: 'Only the locked file goes to the server',
    body: "The scrambled (encrypted) file is uploaded to our server. The secret key is never sent to the server — ever. So even we cannot open your file. The server is just a temporary locker.",
  },
  {
    icon: 'link',
    color: '#10B981',
    title: 'The key travels inside the link',
    body: "A shareable link is created. The secret key is hidden inside the link itself — specifically in the part after the # symbol (called the hash). Browsers and apps never send the # part to any server, so the key stays private.",
  },
  {
    icon: 'eye',
    color: '#F97316',
    title: 'The recipient unlocks it on their device',
    body: "When someone opens the link, their device reads the key from the link, downloads the scrambled file, and unlocks it locally. The file is decrypted on their phone — not on any server.",
  },
  {
    icon: 'trash',
    color: '#EF4444',
    title: 'The file disappears after one view',
    body: "Once the link is opened (or the timer runs out), the file is permanently deleted from the server. There is no copy left anywhere. Not on our server, not in any database.",
  },
];

const MYTHS = [
  {
    myth: '"The app can read my files"',
    truth: 'No. Files are encrypted before they leave your phone. We only ever see scrambled data.',
  },
  {
    myth: '"The link can be intercepted"',
    truth: 'The key is in the # part of the URL, which is never sent over the network — only your device sees it.',
  },
  {
    myth: '"Someone can download the file from the server"',
    truth: 'Even if they could, they would only get the scrambled version. Without the key (which is only in the link), it is useless.',
  },
];

export default function EncryptionScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How Encryption Works</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <LinearGradient
          colors={['#5B21B6', '#7C3AED', '#9D5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroIconBg}>
            <Ionicons name="shield-checkmark" size={40} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Your files are private.{'\n'}Really.</Text>
          <Text style={styles.heroSub}>
            Here's exactly how OneTap keeps your files safe — explained simply, no tech degree needed.
          </Text>
          <View style={styles.heroCircle1} />
          <View style={styles.heroCircle2} />
        </LinearGradient>

        {/* Simple analogy */}
        <View style={styles.analogyBox}>
          <Text style={styles.analogyEmoji}>🔐</Text>
          <Text style={styles.analogyText}>
            Think of it like a magic safe. You lock your file on your phone, send the locked safe to a storage room, and hide the key inside the link you share. Only the person with the link can open the safe — and even the storage room owner can't.
          </Text>
        </View>

        {/* Step by step */}
        <Text style={styles.sectionTitle}>Step by Step</Text>
        {STEPS.map((step, i) => (
          <View key={i} style={styles.stepCard}>
            <View style={styles.stepLeft}>
              <View style={[styles.stepIconBg, { backgroundColor: step.color + '20' }]}>
                <Ionicons name={step.icon} size={22} color={step.color} />
              </View>
              {i < STEPS.length - 1 && <View style={[styles.stepLine, { backgroundColor: step.color + '30' }]} />}
            </View>
            <View style={styles.stepRight}>
              <View style={[styles.stepNumBadge, { backgroundColor: step.color + '20', borderColor: step.color + '50' }]}>
                <Text style={[styles.stepNum, { color: step.color }]}>{i + 1}</Text>
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          </View>
        ))}

        {/* Tech note */}
        <View style={styles.techBox}>
          <View style={styles.techHeader}>
            <Ionicons name="code-slash" size={18} color={COLORS.lavender} />
            <Text style={styles.techTitle}>The tech behind it (optional reading)</Text>
          </View>
          <Text style={styles.techText}>
            OneTap uses <Text style={styles.techHighlight}>AES-256-GCM</Text> — the same encryption standard used by banks, governments, and messaging apps like Signal. The "256" means the key is 256 bits long — there are more possible keys than atoms in the observable universe. Brute-forcing it is not possible.{'\n\n'}
            The key is derived using <Text style={styles.techHighlight}>PBKDF2</Text> and the encryption happens entirely in JavaScript on your device using the Web Crypto API — no native code, no black box.
          </Text>
        </View>

        {/* Myth busting */}
        <Text style={styles.sectionTitle}>Common Questions</Text>
        {MYTHS.map((item, i) => (
          <View key={i} style={styles.mythCard}>
            <View style={styles.mythRow}>
              <Ionicons name="close-circle" size={18} color="#EF4444" />
              <Text style={styles.mythText}>{item.myth}</Text>
            </View>
            <View style={styles.truthRow}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.teal} />
              <Text style={styles.truthText}>{item.truth}</Text>
            </View>
          </View>
        ))}

        {/* Bottom CTA */}
        <LinearGradient
          colors={['rgba(124,58,237,0.2)', 'rgba(139,92,246,0.05)']}
          style={styles.ctaBox}
        >
          <Ionicons name="shield-checkmark" size={28} color={COLORS.lavender} />
          <Text style={styles.ctaTitle}>Zero knowledge. Zero trust required.</Text>
          <Text style={styles.ctaSub}>
            You don't have to trust us. The math makes it safe regardless.
          </Text>
        </LinearGradient>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '700', textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  hero: { borderRadius: RADIUS.xxl, padding: 28, alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
  heroIconBg: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { color: '#fff', fontSize: SIZES.xxl, fontWeight: '800', textAlign: 'center', marginBottom: 10, lineHeight: 32 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: SIZES.sm, textAlign: 'center', lineHeight: 22 },
  heroCircle1: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', right: -40, top: -40 },
  heroCircle2: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.05)', left: -20, bottom: -20 },

  analogyBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', marginBottom: 28 },
  analogyEmoji: { fontSize: 28 },
  analogyText: { color: COLORS.textSecondary, fontSize: SIZES.sm, lineHeight: 22, flex: 1 },

  sectionTitle: { color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '700', marginBottom: 16 },

  stepCard: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  stepLeft: { alignItems: 'center', width: 44 },
  stepIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepLine: { width: 2, flex: 1, marginTop: 6, marginBottom: 0, minHeight: 20 },
  stepRight: { flex: 1, paddingBottom: 20 },
  stepNumBadge: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 6 },
  stepNum: { fontSize: SIZES.xs, fontWeight: '800' },
  stepTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: 6 },
  stepBody: { color: COLORS.textSecondary, fontSize: SIZES.sm, lineHeight: 22 },

  techBox: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.lg, padding: 18, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', marginBottom: 28 },
  techHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  techTitle: { color: COLORS.lavender, fontSize: SIZES.sm, fontWeight: '700' },
  techText: { color: COLORS.textSecondary, fontSize: SIZES.sm, lineHeight: 22 },
  techHighlight: { color: COLORS.lavender, fontWeight: '700' },

  mythCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginBottom: 12, gap: 10 },
  mythRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  mythText: { color: '#FCA5A5', fontSize: SIZES.sm, fontWeight: '600', flex: 1 },
  truthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  truthText: { color: COLORS.textSecondary, fontSize: SIZES.sm, lineHeight: 20, flex: 1 },

  ctaBox: { borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, padding: 28, alignItems: 'center', gap: 10, marginTop: 8 },
  ctaTitle: { color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '800', textAlign: 'center' },
  ctaSub: { color: COLORS.textSecondary, fontSize: SIZES.sm, textAlign: 'center', lineHeight: 20 },
});
