import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, RADIUS } from '../constants/theme';

const ToastBase = ({ text1, text2, iconName, iconColor, borderColor }) => (
  <View style={[styles.container, { borderLeftColor: borderColor }]}>
    <Ionicons name={iconName} size={22} color={iconColor} style={{ marginRight: 12 }} />
    <View style={{ flex: 1 }}>
      {text1 ? <Text style={styles.title}>{text1}</Text> : null}
      {text2 ? <Text style={styles.message}>{text2}</Text> : null}
    </View>
  </View>
);

export const toastConfig = {
  success: ({ text1, text2 }) => <ToastBase text1={text1} text2={text2} iconName="checkmark-circle" iconColor={COLORS.green} borderColor={COLORS.green} />,
  error: ({ text1, text2 }) => <ToastBase text1={text1} text2={text2} iconName="close-circle" iconColor={COLORS.red} borderColor={COLORS.red} />,
  info: ({ text1, text2 }) => <ToastBase text1={text1} text2={text2} iconName="information-circle" iconColor={COLORS.lavender} borderColor={COLORS.lavender} />,
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1A0F3C', borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 12,
    marginHorizontal: 16, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, minWidth: '85%',
  },
  title: { color: COLORS.textPrimary, fontSize: SIZES.base, fontWeight: '600' },
  message: { color: COLORS.textSecondary, fontSize: SIZES.sm, marginTop: 2 },
});
