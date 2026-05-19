export const COLORS = {
  primary:       '#208AEF',
  primaryMid:    '#90C5F7',
  primaryLight:  '#E6F4FE',
  onPrimary:     '#FFFFFF',
  background:    '#F5F7FA',
  surface:       '#F0F4F8',
  white:         '#FFFFFF',
  border:        '#E2E8F0',
  textPrimary:   '#1A202C',
  textSecondary: '#4A5568',
  textMuted:     '#A0AEC0',
  given:         '#1D9E75',
  givenLight:    '#E1F5EE',
  missed:        '#E24B4A',
  missedLight:   '#FCEBEB',
  due:           '#BA7517',
  dueLight:      '#FAEEDA',
  upcoming:      '#534AB7',
  upcomingLight: '#EEEDFE',
  card1:         '#E6F4FE',
  card2:         '#E1F5EE',
  card3:         '#FAEEDA',
  card4:         '#EEEDFE',
};

export const RADIUS = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  full: 9999,
};

// ─── Shared Header Constants ──────────────────────────────────────────────────
// Single source of truth for every screen's hero header.
// Usage: import { HEADER } from '@/lib/theme'

export const HEADER = {
  // Spacing
  paddingTop:              52,
  paddingBottom:           12,
  paddingHorizontal:       20,

  // Rounded hero shape
  borderBottomLeftRadius:  28,
  borderBottomRightRadius: 28,

  // Top bar row
  topBarMarginBottom:      10,
  titleFontSize:           18,

  // Icon circle + refresh button (same size)
  iconCircleSize:          30,
  iconCircleRadius:        15,

  // Child/context strip
  stripPaddingHorizontal:  12,
  stripPaddingVertical:    7,
  stripGap:                8,
  stripAvatarSize:         26,
  stripAvatarRadius:       13,

  // Shadow — spread with ...HEADER.shadow on the header View
  shadow: {
    shadowColor:   '#208AEF',
    shadowOffset:  { width: 0, height: 6 } as const,
    shadowOpacity: 0.25,
    shadowRadius:  12,
    elevation:     8,
  },

  // Decorative overlay circles (position: absolute inside header)
  decorCircle1: {
    position:    'absolute' as const,
    width:       180,
    height:      180,
    borderRadius: 90,
    borderWidth:  36,
    borderColor:  'rgba(255,255,255,0.07)',
    top:  -55,
    right: -55,
  },
  decorCircle2: {
    position:    'absolute' as const,
    width:       100,
    height:      100,
    borderRadius: 50,
    borderWidth:  20,
    borderColor:  'rgba(255,255,255,0.06)',
    bottom: -35,
    left:    40,
  },
} as const;