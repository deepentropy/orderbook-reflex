// RegimeScheduler.ts - Orchestrates regime transitions to achieve target price movements

import { MarketScenario, BreakoutType, BreakoutSpeed } from './MarketScenario';

/**
 * Regime tuple: [Momentum, Breakout]
 * Examples: ["N", "O"] = Normal momentum, Outside breakout
 */
export type Regime = [string, string];

/**
 * Price direction: Up, Down, or Flat
 */
export type Sign = "U" | "D" | "F";

/**
 * A scheduled regime segment with time bounds and target
 */
interface RegimeSegment {
  startTime: number;   // Seconds from scenario start
  endTime: number;     // Seconds from scenario start
  regime: Regime;      // Regime tuple
  sign: Sign;          // Price direction
  targetPrice?: number; // Target price to achieve (if breakout)
  description: string; // Human-readable description
}

/**
 * Breakout event information for scheduling
 */
export interface BreakoutEvent {
  startTime: number;
  endTime: number;
  type: BreakoutType;
  targetPrice: number;
  speed: BreakoutSpeed;
}

/**
 * RegimeScheduler orchestrates market regime transitions over time
 * to achieve controlled breakouts within specified time windows
 */
export class RegimeScheduler {
  private timeline: RegimeSegment[] = [];
  private scenario: MarketScenario | null = null;
  private breakoutEvent: BreakoutEvent | null = null;

  /**
   * Schedule regime transitions based on market scenario
   */
  schedule(scenario: MarketScenario): void {
    this.scenario = scenario;
    this.timeline = [];

    const { startPrice, duration, breakout, advanced } = scenario;

    // Phase 1: Initial ranging period (before any action)
    let currentTime = 0;

    // Calculate when main breakout should occur (random within window)
    let breakoutStartTime: number | null = null;
    let breakoutEndTime: number | null = null;

    if (breakout.type !== 'none') {
      const [minTime, maxTime] = breakout.timeWindow;
      breakoutStartTime = minTime + Math.random() * (maxTime - minTime);

      // Calculate breakout duration based on speed
      const breakoutDuration = this.calculateBreakoutDuration(
        breakout.speed,
        Math.abs(breakout.magnitude)
      );
      breakoutEndTime = Math.min(breakoutStartTime + breakoutDuration, duration);

      // Calculate target price
      const targetPrice = startPrice * (1 + breakout.magnitude / 100);
      this.breakoutEvent = {
        startTime: breakoutStartTime,
        endTime: breakoutEndTime,
        type: breakout.type,
        targetPrice,
        speed: breakout.speed,
      };
    }

    // Phase 2: Handle fake breakouts (if any)
    const fakeBreakouts = advanced?.fakeBreakouts || [];
    const allEvents: Array<{
      type: 'fake' | 'main';
      startTime: number;
      endTime: number;
      targetPrice: number;
      reversalSpeed?: number;
    }> = [];

    // Add fake breakouts
    for (const fake of fakeBreakouts) {
      const [minTime, maxTime] = fake.timeWindow;
      const fakeStartTime = minTime + Math.random() * (maxTime - minTime);
      const fakeDuration = this.calculateBreakoutDuration('gradual', Math.abs(fake.magnitude));
      const fakeEndTime = fakeStartTime + fakeDuration;
      const fakeReversalTime = fakeEndTime + fake.reversalSpeed;

      allEvents.push({
        type: 'fake',
        startTime: fakeStartTime,
        endTime: fakeEndTime,
        targetPrice: startPrice * (1 + fake.magnitude / 100),
        reversalSpeed: fake.reversalSpeed,
      });

      // Add reversal event
      allEvents.push({
        type: 'fake',
        startTime: fakeEndTime,
        endTime: fakeReversalTime,
        targetPrice: startPrice,  // Reverse back to start
      });
    }

    // Add main breakout
    if (breakoutStartTime !== null && breakoutEndTime !== null && this.breakoutEvent) {
      allEvents.push({
        type: 'main',
        startTime: breakoutStartTime,
        endTime: breakoutEndTime,
        targetPrice: this.breakoutEvent.targetPrice,
      });
    }

    // Sort all events by start time
    allEvents.sort((a, b) => a.startTime - b.startTime);

    // Build timeline segments
    currentTime = 0;

    for (let i = 0; i < allEvents.length; i++) {
      const event = allEvents[i];

      // Add ranging period before this event
      if (currentTime < event.startTime) {
        this.timeline.push({
          startTime: currentTime,
          endTime: event.startTime,
          regime: ["N", "O"],  // Normal momentum, Outside (ranging)
          sign: "F",
          description: "Ranging period",
        });
      }

      // Add the event (breakout or reversal)
      const direction = event.targetPrice > startPrice ? "U" : "D";
      const isMain = event.type === 'main';

      this.timeline.push({
        startTime: event.startTime,
        endTime: event.endTime,
        regime: ["N", "B"],  // Breakout regime
        sign: direction,
        targetPrice: event.targetPrice,
        description: isMain ? `Main ${direction === "U" ? "bullish" : "bearish"} breakout` : "Fake breakout",
      });

      currentTime = event.endTime;
    }

    // Add final ranging period if time remaining
    if (currentTime < duration) {
      this.timeline.push({
        startTime: currentTime,
        endTime: duration,
        regime: ["N", "O"],
        sign: "F",
        description: "Post-breakout ranging",
      });
    }
  }

  /**
   * Get the current regime and sign based on elapsed time
   */
  getCurrentRegime(elapsedTime: number): { regime: Regime; sign: Sign; targetPrice?: number } {
    if (this.timeline.length === 0) {
      // Default to flat/ranging if no timeline
      return { regime: ["N", "O"], sign: "F" };
    }

    // Find the segment that contains the current time
    for (const segment of this.timeline) {
      if (elapsedTime >= segment.startTime && elapsedTime < segment.endTime) {
        return {
          regime: segment.regime,
          sign: segment.sign,
          targetPrice: segment.targetPrice,
        };
      }
    }

    // If past all segments, use last segment's regime
    const last = this.timeline[this.timeline.length - 1];
    return {
      regime: last.regime,
      sign: last.sign,
      targetPrice: last.targetPrice,
    };
  }

  /**
   * Get information about the scheduled breakout
   */
  getBreakoutEvent(): BreakoutEvent | null {
    return this.breakoutEvent;
  }

  /**
   * Get the current scenario
   */
  getScenario(): MarketScenario | null {
    return this.scenario;
  }

  /**
   * Get the full timeline (useful for debugging/visualization)
   */
  getTimeline(): RegimeSegment[] {
    return [...this.timeline];
  }

  /**
   * Check if currently in a breakout period
   */
  isInBreakout(elapsedTime: number): boolean {
    const current = this.getCurrentRegime(elapsedTime);
    return current.regime[1] === "B";  // Breakout regime
  }

  /**
   * Get time until next breakout (returns null if no breakout scheduled)
   */
  getTimeUntilBreakout(elapsedTime: number): number | null {
    if (!this.breakoutEvent) return null;

    const timeUntil = this.breakoutEvent.startTime - elapsedTime;
    return timeUntil > 0 ? timeUntil : null;
  }

  /**
   * Calculate breakout duration based on speed and magnitude
   */
  private calculateBreakoutDuration(speed: BreakoutSpeed, magnitudePercent: number): number {
    switch (speed) {
      case 'instant':
        return 2;  // 2 seconds for instant breakout

      case 'gradual':
        // Scale with magnitude: 0.5% = 10s, 1% = 15s, 2% = 20s
        return Math.max(8, Math.min(30, 10 + magnitudePercent * 5));

      case 'accelerating':
        // Slightly longer to allow for acceleration phase
        return Math.max(10, Math.min(40, 15 + magnitudePercent * 8));

      default:
        return 15;
    }
  }

  /**
   * Reset the scheduler
   */
  reset(): void {
    this.timeline = [];
    this.scenario = null;
    this.breakoutEvent = null;
  }
}
