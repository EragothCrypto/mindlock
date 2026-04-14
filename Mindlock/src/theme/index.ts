export { colors, default as Colors } from './colors';
export { typography, fontFamilies, fontSizes, lineHeights, letterSpacing } from './typography';

// Spacing scale
export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
};

// Border radius - minimal for brutalist aesthetic
export const borderRadius = {
    none: 0,
    sm: 2,
    md: 4,
    lg: 8,
};

// Shadow - subtle glow effects
export const shadows = {
    glow: {
        shadowColor: '#00FF41',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    glowStrong: {
        shadowColor: '#00FF41',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 10,
    },
    glowCyan: {
        shadowColor: '#00FFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
    },
};
