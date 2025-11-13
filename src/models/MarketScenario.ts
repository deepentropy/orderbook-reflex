// MarketScenario.ts - Configuration system for synthetic market scenarios

/**
 * Breakout types that can occur in the market
 */
export type BreakoutType = 'bullish' | 'bearish' | 'fake' | 'none';

/**
 * Speed at which a breakout occurs
 */
export type BreakoutSpeed = 'instant' | 'gradual' | 'accelerating';

/**
 * Configuration for a fake breakout (reverses after peaking)
 */
export interface FakeBreakoutConfig {
  timeWindow: [number, number];  // [min, max] seconds when fake breakout occurs
  magnitude: number;              // Price change in % (e.g., 0.5 = 0.5%)
  reversalSpeed: number;          // Seconds to reverse back to original price
}

/**
 * Configuration for hidden liquidity (iceberg orders)
 */
export interface HiddenLiquidityConfig {
  enabled: boolean;
  icebergRatio: number;   // 0.1 = show only 10% of real size
  refreshRate: number;    // Seconds between iceberg reveals
}

/**
 * Configuration for spoofing (phantom orders that cancel)
 */
export interface SpoofingConfig {
  timeWindow: [number, number];
  side: 'bid' | 'ask';
  size: number;           // Size of phantom orders
  layers: number;         // Number of price levels
  cancelBeforeExecution: boolean;  // Remove when price approaches
}

/**
 * Configuration for momentum persistence (AR model)
 */
export interface MomentumPersistenceConfig {
  enabled: boolean;
  halfLife: number;       // Seconds for momentum to decay by 50%
  meanReversion: number;  // Pull back to mean (0-1, higher = stronger reversion)
}

/**
 * GARCH(1,1) parameters for volatility clustering
 */
export interface VolatilityClusteringConfig {
  enabled: boolean;
  garchParams: {
    omega: number;   // Constant term
    alpha: number;   // Shock coefficient (recent volatility)
    beta: number;    // Persistence coefficient (past volatility)
  };
}

/**
 * Volume profile patterns
 */
export type VolumeProfile = 'uniform' | 'u-shaped' | 'spike-heavy';

/**
 * Order flow characteristics
 */
export interface OrderFlowConfig {
  toxicity: number;        // 0-1, how much informed trading (removes liquidity)
  aggressiveness: number;  // 0-1, ratio of market vs limit orders
}

/**
 * Advanced features configuration (unlocked at higher user levels)
 */
export interface AdvancedFeaturesConfig {
  fakeBreakouts?: FakeBreakoutConfig[];
  hiddenLiquidity?: HiddenLiquidityConfig;
  spoofing?: SpoofingConfig[];
  momentumPersistence?: MomentumPersistenceConfig;
  volatilityClustering?: VolatilityClusteringConfig;
  volumeProfile?: VolumeProfile;
  orderFlow?: OrderFlowConfig;
}

/**
 * Main breakout configuration
 */
export interface BreakoutConfig {
  type: BreakoutType;
  timeWindow: [number, number];  // [min, max] seconds when breakout must occur
  magnitude: number;              // Price change in % (e.g., 0.5 = 0.5%)
  speed: BreakoutSpeed;
  preWarning?: number;            // Seconds before breakout to notify user
  notification: boolean;          // Whether to notify user
}

/**
 * Spread dynamics configuration
 */
export interface SpreadConfig {
  base: number;                   // Base spread in $
  volatilityMultiplier: number;   // Spreads widen during volatility
  minSpread: number;
  maxSpread: number;
}

/**
 * Complete market scenario configuration
 */
export interface MarketScenario {
  // Basic Parameters
  startPrice: number;
  duration: number;  // Total scenario duration in seconds

  // Breakout Configuration
  breakout: BreakoutConfig;

  // Spread Dynamics
  spread: SpreadConfig;

  // Advanced Features (User Level Dependent)
  advanced?: AdvancedFeaturesConfig;

  // Validation & Feedback
  expectedUserAction?: 'buy' | 'sell' | 'none';
  recordReactionTime: boolean;
}

/**
 * Factory function to create a basic bullish breakout scenario
 */
export function createBullishBreakout(options?: Partial<MarketScenario>): MarketScenario {
  return {
    startPrice: 100.0,
    duration: 60,
    breakout: {
      type: 'bullish',
      timeWindow: [20, 40],
      magnitude: 1.0,  // 1%
      speed: 'gradual',
      preWarning: 5,
      notification: true,
    },
    spread: {
      base: 0.02,
      volatilityMultiplier: 1.5,
      minSpread: 0.01,
      maxSpread: 0.10,
    },
    recordReactionTime: true,
    ...options,
  };
}

/**
 * Factory function to create a basic bearish breakout scenario
 */
export function createBearishBreakout(options?: Partial<MarketScenario>): MarketScenario {
  return {
    startPrice: 100.0,
    duration: 60,
    breakout: {
      type: 'bearish',
      timeWindow: [20, 40],
      magnitude: -1.0,  // -1%
      speed: 'gradual',
      preWarning: 5,
      notification: true,
    },
    spread: {
      base: 0.02,
      volatilityMultiplier: 1.5,
      minSpread: 0.01,
      maxSpread: 0.10,
    },
    recordReactionTime: true,
    ...options,
  };
}

/**
 * Factory function to create a scenario with fake breakout
 */
export function createFakeBreakoutScenario(options?: Partial<MarketScenario>): MarketScenario {
  return {
    startPrice: 100.0,
    duration: 90,
    breakout: {
      type: 'bullish',
      timeWindow: [50, 70],
      magnitude: 1.0,
      speed: 'gradual',
      preWarning: 5,
      notification: true,
    },
    spread: {
      base: 0.02,
      volatilityMultiplier: 1.5,
      minSpread: 0.01,
      maxSpread: 0.10,
    },
    advanced: {
      fakeBreakouts: [
        {
          timeWindow: [15, 25],
          magnitude: 0.5,
          reversalSpeed: 5,
        },
      ],
    },
    recordReactionTime: true,
    ...options,
  };
}

/**
 * Factory function to create a flat/ranging scenario (no breakout)
 */
export function createRangingScenario(options?: Partial<MarketScenario>): MarketScenario {
  return {
    startPrice: 100.0,
    duration: 60,
    breakout: {
      type: 'none',
      timeWindow: [0, 0],
      magnitude: 0,
      speed: 'gradual',
      notification: false,
    },
    spread: {
      base: 0.02,
      volatilityMultiplier: 1.0,
      minSpread: 0.01,
      maxSpread: 0.05,
    },
    recordReactionTime: false,
    ...options,
  };
}
