import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SIZES, RADIUS } from '../src/constants/theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const lockAnim = useRef(new Animated.Value(-30)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
      Animated.timing(lockAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={['#2D0A6E', '#5B21B6', '#7C3AED', '#9D5CF6']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.container}
    >
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <Animated.View style={[styles.lockContainer, { transform: [{ translateY: lockAnim }] }]}>
        <View style={styles.lockBg}>
          <Ionicons name="lock-closed" size={28} color={COLORS.cyan} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.content, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      }]}>
        <View style={styles.iconWrapper}>
          <LinearGradient colors={['#EC4899', '#F97316']} style={styles.folderGradient}>
            <Ionicons name="folder" size={64} color="#fff" />
            <View style={styles.plusBadge}>
              <Ionicons name="add" size={18} color="#fff" />
            </View>
          </LinearGradient>
        </View>

        <Text style={styles.title}>Explore Your Files</Text>
        <Text style={styles.subtitle}>With OneTap App</Text>
        <Text style={styles.description}>
          Secure, encrypted file sharing with one-time access links
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(tabs)/home')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[COLORS.teal, COLORS.cyan]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Start Now</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.04)', top: -80, right: -80 },
  circle2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', bottom: 100, left: -60 },
  circle3: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.06)', top: height * 0.3, right: -40 },
  lockContainer: { position: 'absolute', top: height * 0.12, right: width * 0.12 },
  lockBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(6,182,212,0.2)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)', alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 32 },
  iconWrapper: { marginBottom: 32, shadowColor: '#EC4899', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12 },
  folderGradient: { width: 120, height: 120, borderRadius: RADIUS.xxl, alignItems: 'center', justifyContent: 'center' },
  plusBadge: { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: SIZES.xxxl, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 38 },
  subtitle: { fontSize: SIZES.xxxl, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 12 },
  description: { fontSize: SIZES.md, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22, marginBottom: 36, maxWidth: 260 },
  button: { borderRadius: RADIUS.full, overflow: 'hidden', shadowColor: COLORS.teal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  buttonGradient: { paddingHorizontal: 52, paddingVertical: 16, borderRadius: RADIUS.full },
  buttonText: { color: '#fff', fontSize: SIZES.lg, fontWeight: '700', letterSpacing: 0.5 },
});
