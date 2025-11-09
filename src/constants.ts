// constants.ts - Converted from Python constants.py

// Screen & UI
export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 480;
export const REFRESH_RATE = 3; // Updates per second

// Reaction
export const INITIAL_REACTION_WINDOW = 1.0;
export const MIN_REACTION_WINDOW = 0.12;
export const WINDOW_DECREASE_FACTOR = 0.90;
export const ADAPTIVE_WINDOW_CHECK = 20;
export const SUCCESS_THRESHOLD = 0.80;

// Files
export const MODEL_FILE = "model.json";

// Colors
export const BG_COLOR = "rgb(30, 30, 30)";
export const COL_BG_COLOR = "rgb(193, 193, 193)";
export const PANEL_COLOR = "rgb(45, 45, 45)";
export const SIGNAL_COLOR = "rgb(0, 200, 0)";
export const TEXT_COLOR = "rgb(30, 30, 30)";
export const ERROR_COLOR = "rgb(255, 60, 60)";

// Row colors by rank (green → rose → yellow → blue → grey)
export const ROW_COLORS = [
  "rgb(87, 254, 1)",    // green  – best price
  "rgb(253, 128, 127)", // rose   – 2nd best
  "rgb(251, 254, 1)",   // yellow – 3rd best
  "rgb(3, 254, 249)",   // blue   – 4th best
];
export const DEFAULT_ROW_COLOR = COL_BG_COLOR; // grey (#c1c1c1)

// Key codes for keyboard controls
export const ENTRY_KEY = "b";  // Buy (Entry)
export const EXIT_KEY = "s";  // Sell (Exit)

// OrderBook display settings
export const ROW_HEIGHT = 16;
export const MAX_ROWS = 10;
export const COL_WIDTH = 200;
export const GAP = 10;
