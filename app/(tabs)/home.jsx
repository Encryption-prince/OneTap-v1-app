import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { COLORS, SIZES, RADIUS } from '../../src/constants/theme';

const { width } = Dimensions.get('window');

// All 4 quick-action tiles now navigate to upload
const QUICK_ACTIONS = [
  { icon: 'image', label: 'Picture', color: '#EC4899', bg: 'rgba(236,72,153,0.15)', desc: 'Share an image' },
  { icon: 'videocam', label: 'Video', color: '#F97316', bg: 'rgba(249,115,22,0.15)', desc: 'Share a video' },
  { icon: 'document-text', label: 'My File', color: '#06B6D4', bg: 'rgba(6,182,212,0.15)', desc: 'Share any file' },
  { icon: 'link', label: 'Open Link', color: '#10B981', bg: 'rgba(16,185,129,0.15)', desc: 'View a shared file' },
];

// How it works steps — replaces fake "recent files"
const HOW_IT_WORKS = [
  { step: '1', icon: 'cloud-upload', title: 'Upload a File', desc: 'Pick any image, PDF or text file from your device. Max 100MB.', color: '#7C3AED' },
  { step: '2', icon: 'lock-closed', title: 'Encrypted on Device', desc: 'AES-256-GCM encryption happens locally before anything leaves your phone.', color: '#EC4899' },
  { step: '3', icon: 'link', title: 'Get a Secure Link', desc: 'A one-time link is generated. The decryption key is embedded in the URL — the server never sees it.', color: '#06B6D4' },
  { step: '4', icon: 'timer', title: 'Link Expires', desc: 'After the first view or when the timer runs out, the file is permanently deleted from the server.', color: '#10B981' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [viewLinkInput, setViewLinkInput] = useState('');
  const [showModal, setShowModal] = useState(false);
  const modalAnim = useRef(new Animated.Value(0)).current;

  const openModal = () => {
    setShowModal(true);
    Animated.spring(modalAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }).start();
  };

  const closeModal = () => {
    Animated.timing(modalAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowModal(false);
      setViewLinkInput('');
    });
  };

  const handleQuickAction = (action) => {
    if (action.label === 'Open Link') {
      openModal();
    } else {
      // Picture, Video, My File — all go to upload
      router.push('/(tabs)/upload');
    }
  };

  const handleOpenLink = () => {
    if (!viewLinkInput.trim()) return;
    try {
      const url = new URL(viewLinkInput.trim());
      const pathParts = url.pathname.split('/');
      const fileId = pathParts[pathParts.length - 1];
      const hash = url.hash.substring(1);
      const params = new URLSearchParams(hash);
      const key = params.get('key') || '';
      const filename = decodeURIComponent(params.get('filename') || 'file');
      closeModal();
      setTimeout(() => router.push({ pathname: '/view', params: { fileId, key, filename } }), 250);
    } catch {
      closeModal();
      setTimeout(() => router.push({ pathname: '/view', params: { rawLink: viewLinkInput.trim() } }), 250);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome to</Text>
            <Text style={styles.appName}>OneTap 🔐</Text>
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={openModal}>
            <Ionicons name="search" size={22} color={COLORS.lavender} />
          </TouchableOpacity>
        </View>

        {/* Hero Banner — replaces "Cloud Storage" */}
        <LinearGradient
          colors={['#5B21B6', '#7C3AED', '#9D5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        >
          <View style={styles.bannerLeft}>
            <View style={styles.bannerIconBg}>
              <Ionicons name="shield-checkmark" size={28} color="#fff" />
            </View>
            <View style={styles.bannerTextBlock}>
              <Text style={styles.bannerTitle}>End-to-End Encrypted</Text>
              <Text style={styles.bannerSub}>Files never leave your device unencrypted</Text>
            </View>
          </View>
          <View style={styles.bannerCircle1} />
          <View style={styles.bannerCircle2} />
        </LinearGradient>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.featureGrid}>
          {QUICK_ACTIONS.map((f) => (
            <TouchableOpacity
              key={f.label}
              style={[styles.featureCard, { backgroundColor: f.bg }]}
              onPress={() => handleQuickAction(f)}
              activeOpacity={0.8}
            >
              <View style={[styles.featureIconBg, { backgroundColor: f.color + '30' }]}>
                <Ionicons name={f.icon} size={24} color={f.color} />
              </View>
              <View style={styles.featureTextBlock}>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Note about recent files */}
        <View style={styles.noteBox}>
          <Ionicons name="information-circle" size={18} color={COLORS.lavender} />
          <Text style={styles.noteText}>
            Recent files aren't shown here — each link is one-time access only. Once shared, the file is gone after first view.
          </Text>
        </View>

        {/* How it works */}
        <Text style={styles.sectionTitle}>How It Works</Text>
        {HOW_IT_WORKS.map((item) => (
          <View key={item.step} style={styles.stepRow}>
            <View style={[styles.stepBadge, { backgroundColor: item.color + '25', borderColor: item.color + '50' }]}>
              <Text style={[styles.stepNum, { color: item.color }]}>{item.step}</Text>
            </View>
            <View style={[styles.stepIconBg, { backgroundColor: item.color + '20' }]}>
              <Ionicons name={item.icon} size={20} color={item.color} />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>{item.title}</Text>
              <Text style={styles.stepDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}

        {/* Open Secure Link CTA */}
        <TouchableOpacity style={styles.viewLinkCta} onPress={openModal} activeOpacity={0.85}>
          <LinearGradient
            colors={['rgba(124,58,237,0.3)', 'rgba(139,92,246,0.1)']}
            style={styles.viewLinkGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="link" size={22} color={COLORS.lavender} />
            <Text style={styles.viewLinkText}>Open a Secure Link</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.lavender} />
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Open Link Modal */}
      {showModal && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={closeModal} />
          <Animated.View
            style={[
              styles.modalSheet,
              {
                transform: [{
                  translateY: modalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  }),
                }],
              },
            ]}
          >
            <LinearGradient colors={['#1A0F3C', '#0F0A1E']} style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Open Secure Link</Text>
                <Ionicons name="link" size={20} color={COLORS.lavender} />
              </View>
              <Text style={styles.modalLabel}>Paste the full secure link you received</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="https://one-tap-ten.vercel.app/view/..."
                  placeholderTextColor={COLORS.textMuted}
                  value={viewLinkInput}
                  onChangeText={setViewLinkInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline={false}
                />
                {viewLinkInput.length > 0 && (
                  <TouchableOpacity onPress={() => setViewLinkInput('')} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleOpenLink} activeOpacity={0.85} style={{ flex: 1 }}>
                  <LinearGradient
                    colors={[COLORS.teal, COLORS.cyan]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.createBtn}
                  >
                    <Text style={styles.createText}>Open File</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 20 },
  greeting: { color: COLORS.textMuted, fontSize: SIZES.sm },
  appName: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '800' },
  searchBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },

  banner: { borderRadius: RADIUS.xl, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 24, overflow: 'hidden', minHeight: 88 },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  bannerIconBg: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  bannerTextBlock: { flex: 1 },
  bannerTitle: { color: '#fff', fontSize: SIZES.base, fontWeight: '700' },
  bannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: SIZES.xs, marginTop: 3, lineHeight: 16 },
  bannerCircle1: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.06)', right: -30, top: -30 },
  bannerCircle2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.06)', right: 40, bottom: -20 },

  sectionTitle: { color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '700', marginBottom: 14 },

  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  featureCard: { width: (width - 52) / 2, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  featureIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  featureTextBlock: {},
  featureLabel: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700' },
  featureDesc: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 3, lineHeight: 16 },

  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', marginBottom: 24 },
  noteText: { color: COLORS.textSecondary, fontSize: SIZES.xs, flex: 1, lineHeight: 18 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  stepBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNum: { fontSize: SIZES.sm, fontWeight: '800' },
  stepIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepText: { flex: 1 },
  stepTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '700', marginBottom: 4 },
  stepDesc: { color: COLORS.textMuted, fontSize: SIZES.xs, lineHeight: 18 },

  viewLinkCta: { marginTop: 8, borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  viewLinkGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18 },
  viewLinkText: { color: COLORS.lavender, fontSize: SIZES.base, fontWeight: '600', flex: 1, marginLeft: 4 },

  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  modalContent: { padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '700' },
  modalLabel: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, marginBottom: 24 },
  modalInput: { flex: 1, color: COLORS.textPrimary, fontSize: SIZES.sm, paddingVertical: 14 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  cancelText: { color: COLORS.textSecondary, fontSize: SIZES.base, fontWeight: '600' },
  createBtn: { borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  createText: { color: '#fff', fontSize: SIZES.base, fontWeight: '700' },
});
