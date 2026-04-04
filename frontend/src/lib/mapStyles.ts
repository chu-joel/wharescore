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

  // Google Maps-style POI icons: white symbol on colored circle
  addPoiIcons(map);
}

// ---------------------------------------------------------------------------
// Google Maps-style POI icons — white symbol on colored circle
// ---------------------------------------------------------------------------

interface PoiIconDef {
  name: string;
  bg: string;
  drawSymbol: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;
}

/** Draw a white outlined symbol for each POI category */
function drawWhiteSymbol(ctx: CanvasRenderingContext2D, fn: (ctx: CanvasRenderingContext2D) => void) {
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  fn(ctx);
}

const POI_ICON_DEFS: PoiIconDef[] = [
  {
    name: 'poi-hospital',
    bg: '#DC2626',
    drawSymbol(ctx, cx, cy) {
      // White cross
      drawWhiteSymbol(ctx, (c) => {
        c.fillRect(cx - 2, cy - 7, 4, 14);
        c.fillRect(cx - 7, cy - 2, 14, 4);
      });
    },
  },
  {
    name: 'poi-doctors',
    bg: '#DC2626',
    drawSymbol(ctx, cx, cy) {
      // White cross (same as hospital)
      drawWhiteSymbol(ctx, (c) => {
        c.fillRect(cx - 2, cy - 6, 4, 12);
        c.fillRect(cx - 6, cy - 2, 12, 4);
      });
    },
  },
  {
    name: 'poi-pharmacy',
    bg: '#E11D48',
    drawSymbol(ctx, cx, cy) {
      // Pill shape
      drawWhiteSymbol(ctx, (c) => {
        c.beginPath();
        c.ellipse(cx, cy, 7, 4, Math.PI / 4, 0, Math.PI * 2);
        c.fill();
        // Dividing line
        c.strokeStyle = '#E11D48';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(cx - 3, cy + 3);
        c.lineTo(cx + 3, cy - 3);
        c.stroke();
      });
    },
  },
  {
    name: 'poi-park',
    bg: '#16A34A',
    drawSymbol(ctx, cx, cy) {
      // Tree shape
      drawWhiteSymbol(ctx, (c) => {
        // Trunk
        c.fillRect(cx - 1.5, cy + 2, 3, 5);
        // Crown (triangle)
        c.beginPath();
        c.moveTo(cx, cy - 8);
        c.lineTo(cx + 7, cy + 3);
        c.lineTo(cx - 7, cy + 3);
        c.closePath();
        c.fill();
      });
    },
  },
  {
    name: 'poi-playground',
    bg: '#16A34A',
    drawSymbol(ctx, cx, cy) {
      // Swing set
      drawWhiteSymbol(ctx, (c) => {
        c.lineWidth = 2;
        // A-frame
        c.beginPath();
        c.moveTo(cx - 7, cy + 7);
        c.lineTo(cx, cy - 7);
        c.lineTo(cx + 7, cy + 7);
        c.stroke();
        // Crossbar
        c.beginPath();
        c.moveTo(cx - 5, cy - 2);
        c.lineTo(cx + 5, cy - 2);
        c.stroke();
        // Swing
        c.beginPath();
        c.moveTo(cx, cy - 2);
        c.lineTo(cx, cy + 4);
        c.stroke();
      });
    },
  },
  {
    name: 'poi-school',
    bg: '#7C3AED',
    drawSymbol(ctx, cx, cy) {
      // Building with flag
      drawWhiteSymbol(ctx, (c) => {
        // Building
        c.fillRect(cx - 7, cy - 3, 14, 10);
        // Door
        c.fillStyle = '#7C3AED';
        c.fillRect(cx - 2, cy + 1, 4, 6);
        // Roof triangle
        c.fillStyle = '#FFFFFF';
        c.beginPath();
        c.moveTo(cx, cy - 8);
        c.lineTo(cx + 8, cy - 3);
        c.lineTo(cx - 8, cy - 3);
        c.closePath();
        c.fill();
      });
    },
  },
  {
    name: 'poi-university',
    bg: '#7C3AED',
    drawSymbol(ctx, cx, cy) {
      // Graduation cap
      drawWhiteSymbol(ctx, (c) => {
        // Cap base (diamond)
        c.beginPath();
        c.moveTo(cx, cy - 5);
        c.lineTo(cx + 9, cy);
        c.lineTo(cx, cy + 3);
        c.lineTo(cx - 9, cy);
        c.closePath();
        c.fill();
        // Tassel line
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(cx + 6, cy + 1);
        c.lineTo(cx + 6, cy + 6);
        c.stroke();
      });
    },
  },
  {
    name: 'poi-supermarket',
    bg: '#2563EB',
    drawSymbol(ctx, cx, cy) {
      // Shopping cart
      drawWhiteSymbol(ctx, (c) => {
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cx - 7, cy - 6);
        c.lineTo(cx - 4, cy - 6);
        c.lineTo(cx - 1, cy + 3);
        c.lineTo(cx + 6, cy + 3);
        c.lineTo(cx + 7, cy - 3);
        c.lineTo(cx - 3, cy - 3);
        c.stroke();
        // Wheels
        c.beginPath();
        c.arc(cx, cy + 6, 1.5, 0, Math.PI * 2);
        c.arc(cx + 5, cy + 6, 1.5, 0, Math.PI * 2);
        c.fill();
      });
    },
  },
  {
    name: 'poi-library',
    bg: '#2563EB',
    drawSymbol(ctx, cx, cy) {
      // Book
      drawWhiteSymbol(ctx, (c) => {
        c.lineWidth = 2;
        // Open book
        c.beginPath();
        c.moveTo(cx - 8, cy - 5);
        c.lineTo(cx, cy - 3);
        c.lineTo(cx + 8, cy - 5);
        c.stroke();
        c.beginPath();
        c.moveTo(cx - 8, cy + 5);
        c.lineTo(cx, cy + 3);
        c.lineTo(cx + 8, cy + 5);
        c.stroke();
        // Spine
        c.beginPath();
        c.moveTo(cx, cy - 3);
        c.lineTo(cx, cy + 3);
        c.stroke();
        // Side edges
        c.beginPath();
        c.moveTo(cx - 8, cy - 5);
        c.lineTo(cx - 8, cy + 5);
        c.moveTo(cx + 8, cy - 5);
        c.lineTo(cx + 8, cy + 5);
        c.stroke();
      });
    },
  },
  {
    name: 'poi-cafe',
    bg: '#D97706',
    drawSymbol(ctx, cx, cy) {
      // Coffee cup
      drawWhiteSymbol(ctx, (c) => {
        c.lineWidth = 2;
        // Cup body
        c.beginPath();
        c.moveTo(cx - 5, cy - 3);
        c.lineTo(cx - 4, cy + 5);
        c.lineTo(cx + 4, cy + 5);
        c.lineTo(cx + 5, cy - 3);
        c.closePath();
        c.stroke();
        // Handle
        c.beginPath();
        c.arc(cx + 6, cy + 1, 3, -Math.PI / 2, Math.PI / 2, false);
        c.stroke();
        // Steam
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(cx - 2, cy - 5);
        c.quadraticCurveTo(cx - 1, cy - 7, cx, cy - 5);
        c.moveTo(cx + 2, cy - 5);
        c.quadraticCurveTo(cx + 3, cy - 8, cx + 4, cy - 5);
        c.stroke();
      });
    },
  },
  {
    name: 'poi-restaurant',
    bg: '#D97706',
    drawSymbol(ctx, cx, cy) {
      // Fork and knife
      drawWhiteSymbol(ctx, (c) => {
        c.lineWidth = 1.5;
        // Fork (left)
        c.beginPath();
        c.moveTo(cx - 4, cy - 7);
        c.lineTo(cx - 4, cy - 1);
        c.moveTo(cx - 6, cy - 7);
        c.lineTo(cx - 6, cy - 1);
        c.moveTo(cx - 2, cy - 7);
        c.lineTo(cx - 2, cy - 1);
        c.stroke();
        c.beginPath();
        c.moveTo(cx - 6, cy - 1);
        c.lineTo(cx - 2, cy - 1);
        c.stroke();
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(cx - 4, cy - 1);
        c.lineTo(cx - 4, cy + 7);
        c.stroke();
        // Knife (right)
        c.beginPath();
        c.moveTo(cx + 4, cy - 7);
        c.lineTo(cx + 4, cy + 7);
        c.stroke();
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(cx + 4, cy - 7);
        c.quadraticCurveTo(cx + 7, cy - 4, cx + 4, cy);
        c.stroke();
      });
    },
  },
  {
    name: 'poi-museum',
    bg: '#9333EA',
    drawSymbol(ctx, cx, cy) {
      // Temple columns
      drawWhiteSymbol(ctx, (c) => {
        c.fillRect(cx - 7, cy + 4, 14, 3);
        c.fillRect(cx - 7, cy - 4, 14, 2);
        // Columns
        c.fillRect(cx - 5, cy - 2, 2, 6);
        c.fillRect(cx - 1, cy - 2, 2, 6);
        c.fillRect(cx + 3, cy - 2, 2, 6);
        // Roof
        c.beginPath();
        c.moveTo(cx, cy - 8);
        c.lineTo(cx + 8, cy - 4);
        c.lineTo(cx - 8, cy - 4);
        c.closePath();
        c.fill();
      });
    },
  },
  {
    name: 'poi-sports',
    bg: '#0D9488',
    drawSymbol(ctx, cx, cy) {
      // Running person
      drawWhiteSymbol(ctx, (c) => {
        c.lineWidth = 2;
        // Head
        c.beginPath();
        c.arc(cx + 1, cy - 6, 2.5, 0, Math.PI * 2);
        c.fill();
        // Body
        c.beginPath();
        c.moveTo(cx, cy - 3);
        c.lineTo(cx - 2, cy + 3);
        c.stroke();
        // Legs
        c.beginPath();
        c.moveTo(cx - 2, cy + 3);
        c.lineTo(cx - 5, cy + 7);
        c.moveTo(cx - 2, cy + 3);
        c.lineTo(cx + 3, cy + 7);
        c.stroke();
        // Arms
        c.beginPath();
        c.moveTo(cx + 4, cy - 2);
        c.lineTo(cx - 1, cy);
        c.lineTo(cx - 5, cy - 2);
        c.stroke();
      });
    },
  },
  {
    name: 'poi-charging',
    bg: '#0891B2',
    drawSymbol(ctx, cx, cy) {
      // Lightning bolt
      drawWhiteSymbol(ctx, (c) => {
        c.beginPath();
        c.moveTo(cx + 2, cy - 8);
        c.lineTo(cx - 4, cy + 1);
        c.lineTo(cx, cy + 1);
        c.lineTo(cx - 2, cy + 8);
        c.lineTo(cx + 4, cy - 1);
        c.lineTo(cx, cy - 1);
        c.closePath();
        c.fill();
      });
    },
  },
  {
    name: 'poi-default',
    bg: '#64748B',
    drawSymbol(ctx, cx, cy) {
      // Simple map pin dot
      drawWhiteSymbol(ctx, (c) => {
        c.beginPath();
        c.arc(cx, cy, 3, 0, Math.PI * 2);
        c.fill();
      });
    },
  },
];

/** Maps notable_places 'kind' field to a POI icon name */
export const POI_KIND_TO_ICON: Record<string, string> = {
  hospital: 'poi-hospital',
  doctors: 'poi-doctors',
  pharmacy: 'poi-pharmacy',
  park: 'poi-park',
  playground: 'poi-playground',
  zoo: 'poi-park',
  school: 'poi-school',
  university: 'poi-university',
  supermarket: 'poi-supermarket',
  library: 'poi-library',
  cafe: 'poi-cafe',
  restaurant: 'poi-restaurant',
  museum: 'poi-museum',
  gallery: 'poi-museum',
  cinema: 'poi-museum',
  theatre: 'poi-museum',
  sports_centre: 'poi-sports',
  swimming_pool: 'poi-sports',
  fitness_centre: 'poi-sports',
  community_centre: 'poi-default',
  charging_station: 'poi-charging',
  fuel: 'poi-default',
  bank: 'poi-default',
};

function addPoiIcons(map: maplibregl.Map) {
  const SIZE = 32; // Slightly larger for readability
  const R = SIZE / 2;
  const PIXEL_RATIO = 2; // Retina

  for (const def of POI_ICON_DEFS) {
    if (map.hasImage(def.name)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE * PIXEL_RATIO;
    canvas.height = SIZE * PIXEL_RATIO;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

    // Colored circle with white border
    ctx.fillStyle = def.bg;
    ctx.beginPath();
    ctx.arc(R, R, R - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // White symbol centered
    def.drawSymbol(ctx, R, R, R);

    const { data } = ctx.getImageData(0, 0, SIZE * PIXEL_RATIO, SIZE * PIXEL_RATIO);
    map.addImage(def.name, {
      width: SIZE * PIXEL_RATIO,
      height: SIZE * PIXEL_RATIO,
      data: new Uint8Array(data.buffer),
    }, { pixelRatio: PIXEL_RATIO });
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
