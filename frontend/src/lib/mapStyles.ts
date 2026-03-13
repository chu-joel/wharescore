// lib/mapStyles.ts — MapLibre image assets: risk patterns + layer icons

// ---------------------------------------------------------------------------
// Layer icons — canvas-rendered marker images for point layers
// ---------------------------------------------------------------------------

type IconDrawFn = (ctx: CanvasRenderingContext2D, s: number) => void;

const ICON_DEFS: Array<{ name: string; color: string; draw: IconDrawFn }> = [
  {
    name: 'icon-transit',
    color: '#0D7377',
    draw(ctx, s) {
      // Bus body
      ctx.fillStyle = '#0D7377';
      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(3, 3, s - 6, s - 8, 3);
      } else {
        ctx.rect(3, 3, s - 6, s - 8);
      }
      ctx.fill();
      // Windshield
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(5, 5, s - 10, 5);
      // Side windows
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(5, 11, 5, 4);
      ctx.fillRect(s - 10, 11, 5, 4);
      // Wheels
      ctx.fillStyle = '#1a1a2e';
      for (const x of [7, s - 7]) {
        ctx.beginPath();
        ctx.arc(x, s - 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(x, s - 5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a2e';
      }
    },
  },
  {
    name: 'icon-crash',
    color: '#C42D2D',
    draw(ctx, s) {
      // Warning triangle
      ctx.fillStyle = '#C42D2D';
      ctx.beginPath();
      ctx.moveTo(s / 2, 2);
      ctx.lineTo(s - 2, s - 2);
      ctx.lineTo(2, s - 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Exclamation mark
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s / 2 - 1.5, 8, 3, 7);
      ctx.beginPath();
      ctx.arc(s / 2, s - 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    name: 'icon-heritage',
    color: '#7C3AED',
    draw(ctx, s) {
      // Classic temple / columns
      ctx.fillStyle = '#7C3AED';
      // Base
      ctx.fillRect(2, s - 6, s - 4, 4);
      // Top beam
      ctx.fillRect(2, 4, s - 4, 3);
      // Three columns
      for (const x of [4, s / 2 - 1.5, s - 8]) {
        ctx.fillRect(x, 7, 3, s - 13);
      }
      // Roof triangle
      ctx.beginPath();
      ctx.moveTo(s / 2, 1);
      ctx.lineTo(s - 2, 5);
      ctx.lineTo(2, 5);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    name: 'icon-infrastructure',
    color: '#0D6E8A',
    draw(ctx, s) {
      const cx = s / 2, cy = s / 2, r = s / 2 - 2;
      // Outer gear ring
      ctx.fillStyle = '#0D6E8A';
      ctx.beginPath();
      const teeth = 8;
      for (let i = 0; i < teeth; i++) {
        const a1 = (i / teeth) * Math.PI * 2 - Math.PI / teeth;
        const a2 = a1 + Math.PI / teeth;
        const a3 = a2 + Math.PI / (teeth * 2);
        ctx.lineTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
        ctx.lineTo(cx + (r - 3) * Math.cos(a2), cy + (r - 3) * Math.sin(a2));
        ctx.lineTo(cx + r * Math.cos(a3), cy + r * Math.sin(a3));
      }
      ctx.closePath();
      ctx.fill();
      // Inner hole
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    name: 'icon-amenity',
    color: '#D4863B',
    draw(ctx, s) {
      // Map pin teardrop
      ctx.fillStyle = '#D4863B';
      ctx.beginPath();
      ctx.arc(s / 2, s / 2 - 2, s / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(s / 2, s - 2);
      ctx.lineTo(s / 2 - 5, s / 2 + 3);
      ctx.lineTo(s / 2 + 5, s / 2 + 3);
      ctx.closePath();
      ctx.fill();
      // White centre dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s / 2, s / 2 - 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    },
  },
];

export function addLayerIcons(map: maplibregl.Map) {
  const SIZE = 26;
  for (const { name, draw } of ICON_DEFS) {
    if (map.hasImage(name)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    draw(ctx, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
    map.addImage(name, { width: SIZE, height: SIZE, data: new Uint8Array(data.buffer) });
  }
}

// ---------------------------------------------------------------------------
// Risk fill patterns
// ---------------------------------------------------------------------------

export const RISK_PATTERNS = {
  'very-low':  { color: '#0D7377', pattern: 'solid',            textColor: '#FFFFFF' },
  'low':       { color: '#56B4E9', pattern: 'dots',             textColor: '#1A1A1A' },
  'moderate':  { color: '#E69F00', pattern: 'horizontal-lines', textColor: '#1A1A1A' },
  'high':      { color: '#D55E00', pattern: 'wide-diagonal',    textColor: '#FFFFFF' },
  'very-high': { color: '#C42D2D', pattern: 'dense-diagonal',   textColor: '#FFFFFF' },
} as const;

/**
 * Generate risk pattern images and add them to the map.
 * Call this on map load to enable fill-pattern usage in layer styles.
 */
export function addRiskPatterns(map: maplibregl.Map) {
  for (const [key, { color, pattern }] of Object.entries(RISK_PATTERNS)) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    // Semi-transparent base fill
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, 0, 16, 16);

    // Pattern overlay
    ctx.globalAlpha = 0.6;
    if (pattern === 'dots') {
      ctx.beginPath();
      ctx.arc(4, 4, 2, 0, Math.PI * 2);
      ctx.arc(12, 12, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (pattern === 'horizontal-lines') {
      ctx.fillRect(0, 6, 16, 2);
      ctx.fillRect(0, 12, 16, 2);
    }
    if (pattern === 'wide-diagonal') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-4, 16);
      ctx.lineTo(16, -4);
      ctx.stroke();
    }
    if (pattern === 'dense-diagonal') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let i = -16; i < 32; i += 6) {
        ctx.beginPath();
        ctx.moveTo(i, 16);
        ctx.lineTo(i + 16, 0);
        ctx.stroke();
      }
    }

    const imageData = ctx.getImageData(0, 0, 16, 16);
    if (!map.hasImage(`risk-${key}`)) {
      map.addImage(`risk-${key}`, {
        width: 16,
        height: 16,
        data: new Uint8Array(imageData.data.buffer),
      });
    }
  }
}
