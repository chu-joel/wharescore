// lib/animations.ts — shared timing constants

export const TIMING = {
  // Micro-interactions
  BUTTON_PRESS: 100,
  TOOLTIP_APPEAR: 150,
  TOAST_APPEAR: 200,
  TOAST_DISMISS: 150,

  // Layout transitions
  ACCORDION_EXPAND: 250,
  ACCORDION_COLLAPSE: 200,
  MODAL_APPEAR: 250,
  REPORT_SLIDE_IN: 300,

  // Map animations
  MAP_FLY_TO: 1200,
  MAP_LAYER_FADE: 400,

  // Score animations
  SCORE_ARC_FILL: 1000,
  SCORE_BAR_DURATION: 150,
  SCORE_BARS_STAGGER: 80,

  // Skeleton
  SKELETON_SHIMMER: 1500,

  // Post-selection sequence (pin appears mid-fly, popup shortly after landing)
  POST_SELECT_PIN_DELAY: 500,
  POST_SELECT_SHEET_DELAY: 650,
} as const;

export const EASING = {
  DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
  EASE_OUT: 'cubic-bezier(0, 0, 0.2, 1)',
  EASE_IN: 'cubic-bezier(0.4, 0, 1, 1)',
  SCORE_ARC: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  SHEET: 'cubic-bezier(0.32, 0.72, 0, 1)',
} as const;
