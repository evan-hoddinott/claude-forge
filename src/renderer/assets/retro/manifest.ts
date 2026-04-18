/**
 * Retro asset manifest — GIFs and CSS pixel art for the Caboo theme.
 *
 * All GIFs are tiny (under 20 KB) GeoCities-era animated images.
 * CSS pixel art is generated inline for decorative accents.
 */

// --- GIF imports (bundled by Vite) ---
import fire from './gifs/flame.gif';
import cauldron from './gifs/cauldron.gif';
import sparkle from './gifs/sparkle.gif';
import star from './gifs/star.gif';
import starTiny from './gifs/star-tiny.gif';
import globe from './gifs/globe.gif';
import tree from './gifs/tree.gif';
import mushroom from './gifs/mushroom.gif';
import flowerTiny from './gifs/flower-tiny.gif';
import sunflowers from './gifs/sunflowers.gif';
import construction from './gifs/construction.gif';
import newBlink from './gifs/new-blink.gif';

export const retroAssets = {
  /** Animated flame — sidebar logo, loading states (41×93, 5 KB) */
  fire,
  /** Bubbling cauldron — build-room metaphor (63×77, 14 KB) */
  cauldron,
  /** Twinkling sparkle — success states, celebrations (32×32, 1.3 KB) */
  sparkle,
  /** Animated star — badges, highlights (36×36, 1.2 KB) */
  star,
  /** Tiny star — inline decorations (12×11, 1.1 KB) */
  starTiny,
  /** Spinning globe — classic web decoration (50×50, 13 KB) */
  globe,
  /** Pixel tree — nature decoration, sidebar (30×35, 1.5 KB) */
  tree,
  /** Pixel mushroom — nature decoration (32×32, 271 B) */
  mushroom,
  /** Tiny flower — inline nature accent (15×18, 174 B) */
  flowerTiny,
  /** Sunflowers — decorative nature element (43×65, 849 B) */
  sunflowers,
  /** Under construction badge (88×31, 348 B) */
  construction,
  /** "NEW!" blinker badge (31×7, 150 B) */
  newBlink,
} as const;

// ---------------------------------------------------------------------------
// CSS Pixel Art — box-shadow technique for decorative accents
// ---------------------------------------------------------------------------

const PX = 3; // pixel scale factor

/** Helper: convert a pixel map to a CSS box-shadow string. */
function pixelArt(
  pixels: Array<[x: number, y: number, color: string]>,
  scale = PX,
): string {
  return pixels
    .map(([x, y, c]) => `${x * scale}px ${y * scale}px 0 0 ${c}`)
    .join(',');
}

/**
 * "NEW!" pixel text — CSS box-shadow art.
 * Apply on a 1×1 element with the returned box-shadow value.
 * Pair with animation: caboo-blink 1s step-end infinite;
 */
export const newBadgePixels = pixelArt([
  // N
  [0, 0, '#daa520'], [0, 1, '#daa520'], [0, 2, '#daa520'], [0, 3, '#daa520'],
  [1, 1, '#daa520'], [2, 2, '#daa520'],
  [3, 0, '#daa520'], [3, 1, '#daa520'], [3, 2, '#daa520'], [3, 3, '#daa520'],
  // E
  [5, 0, '#daa520'], [5, 1, '#daa520'], [5, 2, '#daa520'], [5, 3, '#daa520'],
  [6, 0, '#daa520'], [7, 0, '#daa520'],
  [6, 2, '#daa520'],
  [6, 3, '#daa520'], [7, 3, '#daa520'],
  // W
  [9, 0, '#daa520'], [9, 1, '#daa520'], [9, 2, '#daa520'], [9, 3, '#daa520'],
  [10, 2, '#daa520'], [10, 3, '#daa520'],
  [11, 1, '#daa520'],
  [12, 2, '#daa520'], [12, 3, '#daa520'],
  [13, 0, '#daa520'], [13, 1, '#daa520'], [13, 2, '#daa520'], [13, 3, '#daa520'],
  // !
  [15, 0, '#ff6b35'], [15, 1, '#ff6b35'], [15, 2, '#ff6b35'], [15, 3, '#ff6b35'],
]);

/**
 * Under-construction worker — CSS pixel art.
 * A tiny 9×9 pixel figure with a hard hat and shovel.
 */
export const constructionPixels = pixelArt([
  // Hard hat (yellow)
  [3, 0, '#daa520'], [4, 0, '#daa520'], [5, 0, '#daa520'],
  [2, 1, '#daa520'], [3, 1, '#daa520'], [4, 1, '#daa520'], [5, 1, '#daa520'], [6, 1, '#daa520'],
  // Head
  [3, 2, '#d4cba8'], [4, 2, '#d4cba8'], [5, 2, '#d4cba8'],
  // Body (brown overalls)
  [3, 3, '#6b4e2e'], [4, 3, '#6b4e2e'], [5, 3, '#6b4e2e'],
  [3, 4, '#6b4e2e'], [4, 4, '#6b4e2e'], [5, 4, '#6b4e2e'],
  // Arms
  [2, 3, '#d4cba8'], [6, 3, '#d4cba8'],
  // Shovel handle
  [7, 2, '#8b6914'], [7, 3, '#8b6914'], [7, 4, '#8b6914'],
  // Shovel blade
  [7, 5, '#808080'], [8, 5, '#808080'],
  // Legs
  [3, 5, '#6b4e2e'], [5, 5, '#6b4e2e'],
  [3, 6, '#4a3520'], [5, 6, '#4a3520'],
]);

/**
 * Tiny inline SVG data URIs for simple vector decorations.
 */
export const retroSvgs = {
  /** Tiny leaf — 12×12 inline SVG */
  leaf: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">' +
    '<path d="M2 10 Q6 2 10 2 Q10 6 6 8 Q4 9 2 10Z" fill="#5a7a3a" opacity="0.8"/>' +
    '<path d="M2 10 Q6 5 10 2" fill="none" stroke="#7a9f54" stroke-width="0.5"/>' +
    '</svg>',
  )}`,

  /** Tiny anvil — 14×12 inline SVG */
  anvil: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="12" viewBox="0 0 14 12">' +
    '<rect x="1" y="6" width="12" height="2" fill="#6b6450" rx="0"/>' +
    '<rect x="3" y="3" width="8" height="3" fill="#808080" rx="0"/>' +
    '<rect x="0" y="3" width="3" height="2" fill="#808080" rx="0"/>' +
    '<rect x="4" y="8" width="6" height="3" fill="#6b6450" rx="0"/>' +
    '<rect x="3" y="11" width="8" height="1" fill="#4a3520" rx="0"/>' +
    '</svg>',
  )}`,

  /** Tiny hammer — 12×12 inline SVG */
  hammer: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">' +
    '<rect x="5" y="4" width="2" height="7" fill="#8b6914" rx="0"/>' +
    '<rect x="2" y="1" width="8" height="3" fill="#808080" rx="0"/>' +
    '</svg>',
  )}`,
} as const;

export type RetroAssetKey = keyof typeof retroAssets;
export type RetroSvgKey = keyof typeof retroSvgs;
