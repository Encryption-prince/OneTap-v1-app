import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SIZES, RADIUS } from '../../src/constants/theme';

const TEAM = [
  {
    name: 'Subham Maity',
    profession: 'Student',
    background: "B.Tech IT'26",
    college: 'Techno Main Salt Lake',
    initials: 'SM',
    color: '#7C3AED',
    photo: require('../../assets/subham.jpeg'),
    socials: {
      github: 'https://github.com/Encryption-prince',
      linkedin: 'https://linkedin.com/in/subham-maity-6196aa248',
    },
  },
  {
    name: 'Supratim Das',
    profession: 'Student',
    background: "B.Tech IT'26",
    college: 'Techno Main Salt Lake',
    initials: 'SD',
    color: '#EC4899',
    photo: require('../../assets/supratim.jpg'),
    socials: {
      github: 'https://github.com/writ2003',
      linkedin: 'https://www.linkedin.com/in/supratim-das-31754a221',
      twitter: 'https://twitter.com/Suprati44206541',
    },
  },
];

const FEATURES = [
  { icon: 'cloud-upload', title: 'Easy Upload', desc: 'Tap to select files from your device', color: '#7C3AED' },
  { icon: 'timer', title: 'Custom Expiry', desc: 'Set expiry from 1 minute to 30 days', color: '#EC4899' },
  { icon: 'shield-checkmark', title: 'One-Time Access', desc: 'Each link can only be accessed once', color: '#06B6D4' },
  { icon: 'lock-closed', title: 'End-to-End Encrypted', desc: 'AES-256-GCM encryption on your device', color: '#10B981' },
  { icon: 'flash', title: 'Lightning Fast', desc: 'Files processed and ready in seconds', color: '#F97316' },
  { icon: 'document', title: 'Multiple Formats', desc: 'Images, PDFs, text files and more', color: '#F59E0B' },
];

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const [activeProfile, setActiveProfile] = useState(0);
  const profile = TEAM[activeProfile];

  const openLink = (url) => { if (url) Linking.openURL(url).catch(() => {}); };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>About OneTap</Text>
        </View>

        {/* App description */}
        <LinearGradient colors={['rgba(124,58,237,0.2)', 'rgba(139,92,246,0.05)']} style={styles.descCard}>
          <View style={styles.appLogoRow}>
            <LinearGradient colors={[COLORS.purple, COLORS.purpleLight]} style={styles.appLogo}>
              <Ionicons name="flash" size={28} color="#fff" />
            </LinearGradient>
            <View>
              <Text style={styles.appLogoTitle}>OneTap</Text>
              <Text style={styles.appLogoVersion}>v1.0.0 · Secure File Sharing</Text>
            </View>
          </View>
          <Text style={styles.appDesc}>
            OneTap lets you share files securely with end-to-end encryption and one-time access links.
            Files are encrypted on your device — only the recipient with the link can decrypt them.
          </Text>
        </LinearGradient>

        {/* Features */}
        <Text style={styles.sectionTitle}>Features</Text>
        <View style={styles.featuresGrid}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: f.color + '20' }]}>
                <Ionicons name={f.icon} size={20} color={f.color} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Team selector */}
        <Text style={styles.sectionTitle}>Meet Our Crew</Text>
        <View style={styles.profileCards}>
          {TEAM.map((p, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setActiveProfile(i)}
              activeOpacity={0.85}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={activeProfile === i
                  ? ['rgba(124,58,237,0.3)', 'rgba(139,92,246,0.1)']
                  : ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)']}
                style={[styles.profileCard, activeProfile === i && styles.profileCardActive]}
              >
                <Image
                  source={p.photo}
                  style={[styles.profilePhoto, { borderColor: activeProfile === i ? p.color : 'rgba(255,255,255,0.15)' }]}
                />
                <Text style={styles.profileName}>{p.name}</Text>
                <Text style={styles.profileRole}>{p.background}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Profile detail */}
        <LinearGradient colors={['rgba(124,58,237,0.15)', 'rgba(139,92,246,0.05)']} style={styles.detailCard}>
          <Image
            source={profile.photo}
            style={[styles.detailPhoto, { borderColor: profile.color + '80' }]}
          />
          <Text style={styles.detailName}>{profile.name}</Text>
          <Text style={styles.detailRole}>{profile.profession} · {profile.background}</Text>
          <Text style={styles.detailCollege}>{profile.college}</Text>
          <View style={styles.socialsRow}>
            {profile.socials.github && (
              <TouchableOpacity style={styles.socialBtn} onPress={() => openLink(profile.socials.github)}>
                <Ionicons name="logo-github" size={20} color={COLORS.textPrimary} />
              </TouchableOpacity>
            )}
            {profile.socials.linkedin && (
              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: 'rgba(10,102,194,0.2)' }]} onPress={() => openLink(profile.socials.linkedin)}>
                <Ionicons name="logo-linkedin" size={20} color="#0A66C2" />
              </TouchableOpacity>
            )}
            {profile.socials.twitter && (
              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: 'rgba(29,161,242,0.2)' }]} onPress={() => openLink(profile.socials.twitter)}>
                <Ionicons name="logo-twitter" size={20} color="#1DA1F2" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with ❤️ by the OneTap Team</Text>
          <Text style={styles.footerSub}>Techno Main Salt Lake · B.Tech IT'26</Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },
  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  header: { marginTop: 16, marginBottom: 20 },
  headerTitle: { color: COLORS.textPrimary, fontSize: SIZES.xxl, fontWeight: '800' },
  descCard: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, padding: 20, marginBottom: 28 },
  appLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  appLogo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  appLogoTitle: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '800' },
  appLogoVersion: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  appDesc: { color: COLORS.textSecondary, fontSize: SIZES.sm, lineHeight: 22 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: SIZES.lg, fontWeight: '700', marginBottom: 16 },
  featuresGrid: { gap: 10, marginBottom: 28 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  featureIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureTitle: { color: COLORS.textPrimary, fontSize: SIZES.md, fontWeight: '600' },
  featureDesc: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2 },
  profileCards: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  profileCard: { borderRadius: RADIUS.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, alignItems: 'center' },
  profileCardActive: { borderColor: COLORS.border },
  profilePhoto: { width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, marginBottom: 10, backgroundColor: '#1A0F3C' },
  profileName: { color: COLORS.textPrimary, fontSize: SIZES.sm, fontWeight: '700', textAlign: 'center' },
  profileRole: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 2, textAlign: 'center' },
  detailCard: { borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, padding: 24, alignItems: 'center', marginBottom: 28 },
  detailPhoto: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, marginBottom: 14, backgroundColor: '#1A0F3C' },
  detailName: { color: COLORS.textPrimary, fontSize: SIZES.xl, fontWeight: '800', marginBottom: 4 },
  detailRole: { color: COLORS.lavender, fontSize: SIZES.sm, fontWeight: '600', marginBottom: 4 },
  detailCollege: { color: COLORS.textMuted, fontSize: SIZES.xs, marginBottom: 20 },
  socialsRow: { flexDirection: 'row', gap: 12 },
  socialBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', paddingVertical: 8 },
  footerText: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontWeight: '600' },
  footerSub: { color: COLORS.textMuted, fontSize: SIZES.xs, marginTop: 4 },
});
