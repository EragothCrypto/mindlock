import { StyleSheet, Platform } from 'react-native';

// SpaceMono — premium monospace, free Google Font
// Files placed in android/app/src/main/assets/fonts/
export const fontFamilies = {
    mono: Platform.select({
        ios: 'SpaceMono-Regular',
        android: 'SpaceMono-Regular',
        default: 'SpaceMono-Regular',
    }),
    monoMedium: Platform.select({
        ios: 'SpaceMono-Regular',
        android: 'SpaceMono-Regular',
        default: 'SpaceMono-Regular',
    }),
    monoBold: Platform.select({
        ios: 'SpaceMono-Bold',
        android: 'SpaceMono-Bold',
        default: 'SpaceMono-Bold',
    }),
};

// Sharp, angular sizing scale
export const fontSizes = {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    hero: 64,
};

export const lineHeights = {
    tight: 1.1,
    normal: 1.4,
    relaxed: 1.6,
};

export const letterSpacing = {
    tight: -0.5,
    normal: 0,
    wide: 1,
    wider: 2,
    widest: 4,
};

// Pre-built text styles
export const typography = StyleSheet.create({
    // Headings
    heroTitle: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.hero,
        lineHeight: fontSizes.hero * lineHeights.tight,
        letterSpacing: letterSpacing.tight,
        textTransform: 'uppercase' as const,
    },
    h1: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes['3xl'],
        lineHeight: fontSizes['3xl'] * lineHeights.tight,
        letterSpacing: letterSpacing.normal,
        textTransform: 'uppercase' as const,
    },
    h2: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes['2xl'],
        lineHeight: fontSizes['2xl'] * lineHeights.tight,
        letterSpacing: letterSpacing.wide,
    },
    h3: {
        fontFamily: fontFamilies.monoMedium,
        fontSize: fontSizes.xl,
        lineHeight: fontSizes.xl * lineHeights.normal,
        letterSpacing: letterSpacing.wide,
    },
    // Body
    body: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.base,
        lineHeight: fontSizes.base * lineHeights.relaxed,
        letterSpacing: letterSpacing.normal,
    },
    bodyLarge: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.md,
        lineHeight: fontSizes.md * lineHeights.relaxed,
        letterSpacing: letterSpacing.normal,
    },
    // Labels
    label: {
        fontFamily: fontFamilies.monoMedium,
        fontSize: fontSizes.sm,
        lineHeight: fontSizes.sm * lineHeights.normal,
        letterSpacing: letterSpacing.wider,
        textTransform: 'uppercase' as const,
    },
    caption: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.xs,
        lineHeight: fontSizes.xs * lineHeights.normal,
        letterSpacing: letterSpacing.wide,
    },
    // Code/Terminal
    code: {
        fontFamily: fontFamilies.mono,
        fontSize: fontSizes.sm,
        lineHeight: fontSizes.sm * lineHeights.relaxed,
        letterSpacing: letterSpacing.normal,
    },
    // Button
    button: {
        fontFamily: fontFamilies.monoBold,
        fontSize: fontSizes.base,
        letterSpacing: letterSpacing.wider,
        textTransform: 'uppercase' as const,
    },
});

export default typography;
