// Mindlock Neon-Noir Color Palette
export const colors = {
  // Primary - Neon Green
  primary: '#00FF41',
  primaryBright: '#39FF14',
  primaryDim: '#00CC33',

  // Background - Near-black with faint cool tint (not pure #000)
  background: '#020408',
  surface: '#0D1117',
  surfaceElevated: '#161B22',
  surfaceHighlight: '#21262D',
  surfaceActive: '#0D2A1A', // selected state with green tint

  // Accent - Electric Cyan
  accent: '#00FFFF',
  accentDim: '#00CCCC',

  // Gradient pairs (green → cyan) — use only on titles, CTAs, high-value numbers
  gradientStart: '#00FF41',
  gradientEnd: '#00FFFF',
  gradientMid: '#00E5A0',

  // Glow colors — use only on active elements / CTAs / key stats
  glowGreen: 'rgba(0, 255, 65, 0.35)',
  glowCyan: 'rgba(0, 255, 255, 0.30)',
  glowAmber: 'rgba(255, 184, 0, 0.35)',
  glowPurple: 'rgba(139, 92, 246, 0.30)',

  // Status Colors
  success: '#00FF41',
  warning: '#FFB800',
  error: '#FF0040',
  errorDim: '#CC0033',

  // Text - High Contrast
  textPrimary: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#484F58',
  textOnPrimary: '#000000',

  // Borders
  border: '#30363D',
  borderActive: '#00FF41',

  // Overlay
  overlay: 'rgba(2, 4, 8, 0.88)',
  glassMorphism: 'rgba(13, 17, 23, 0.72)',
};

export type ColorKeys = keyof typeof colors;

export default colors;
