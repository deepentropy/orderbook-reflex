// BreakoutNotifier.ts - Event system for breakout notifications and reaction time tracking

import { BreakoutType } from './MarketScenario';

/**
 * Types of breakout events that can be emitted
 */
export type BreakoutEventType = 'warning' | 'start' | 'progress' | 'completion';

/**
 * Breakout event data
 */
export interface BreakoutEvent {
  type: BreakoutEventType;
  breakoutType: BreakoutType;
  timeToBreakout?: number;     // Seconds until breakout (for warnings)
  currentPrice?: number;        // Current price when event fired
  targetPrice?: number;         // Target price for the breakout
  magnitude?: number;           // Price change magnitude in %
  expectedDuration?: number;    // Expected duration of breakout in seconds
  progress?: number;            // 0-1, progress toward target (for progress events)
  timestamp: number;            // performance.now() timestamp when event occurred
}

/**
 * Event listener callback type
 */
type EventCallback = (event: BreakoutEvent) => void;

/**
 * BreakoutNotifier manages breakout events and notifications
 * Emits events for: warnings, breakout start, progress updates, and completion
 */
export class BreakoutNotifier {
  private listeners: Map<BreakoutEventType, EventCallback[]> = new Map();
  private warningTimeout: number | null = null;
  private lastWarningTime: number = 0;
  private lastProgressTime: number = 0;
  private breakoutInProgress: boolean = false;
  private breakoutStartPrice: number = 0;

  /**
   * Register an event listener for a specific event type
   */
  on(eventType: BreakoutEventType, callback: EventCallback): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * Register a listener for all breakout events
   */
  onAny(callback: EventCallback): void {
    const types: BreakoutEventType[] = ['warning', 'start', 'progress', 'completion'];
    types.forEach(type => this.on(type, callback));
  }

  /**
   * Remove an event listener
   */
  off(eventType: BreakoutEventType, callback: EventCallback): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event to all registered listeners
   */
  private emit(event: BreakoutEvent): void {
    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in breakout event listener:', error);
        }
      });
    }
  }

  /**
   * Schedule a warning to be emitted before breakout
   * @param breakoutTime - Time when breakout will start (seconds from scenario start)
   * @param currentTime - Current elapsed time (seconds)
   * @param warningLead - How many seconds before breakout to warn
   * @param breakoutType - Type of breakout
   * @param magnitude - Price change magnitude
   */
  scheduleWarning(
    breakoutTime: number,
    currentTime: number,
    warningLead: number,
    breakoutType: BreakoutType,
    magnitude: number
  ): void {
    const timeToBreakout = breakoutTime - currentTime;

    // Only schedule if breakout is in the future and we haven't warned yet
    if (timeToBreakout > 0 && timeToBreakout <= warningLead) {
      const now = performance.now() / 1000;

      // Throttle warnings to avoid duplicates (only emit once per second)
      if (now - this.lastWarningTime < 1.0) {
        return;
      }

      this.lastWarningTime = now;

      this.emit({
        type: 'warning',
        breakoutType,
        timeToBreakout,
        magnitude,
        timestamp: now,
      });
    }
  }

  /**
   * Notify that a breakout has started
   */
  notifyBreakoutStart(
    breakoutType: BreakoutType,
    currentPrice: number,
    targetPrice: number,
    magnitude: number,
    expectedDuration: number
  ): void {
    if (this.breakoutInProgress) {
      return; // Avoid duplicate start notifications
    }

    this.breakoutInProgress = true;
    this.breakoutStartPrice = currentPrice;

    this.emit({
      type: 'start',
      breakoutType,
      currentPrice,
      targetPrice,
      magnitude,
      expectedDuration,
      timestamp: performance.now() / 1000,
    });
  }

  /**
   * Notify progress during a breakout
   * @param currentPrice - Current price
   * @param targetPrice - Target price
   * @param throttleSeconds - Minimum seconds between progress updates (default 1.0)
   */
  notifyProgress(
    breakoutType: BreakoutType,
    currentPrice: number,
    targetPrice: number,
    throttleSeconds: number = 1.0
  ): void {
    if (!this.breakoutInProgress) {
      return;
    }

    const now = performance.now() / 1000;

    // Throttle progress updates
    if (now - this.lastProgressTime < throttleSeconds) {
      return;
    }

    this.lastProgressTime = now;

    // Calculate progress (0-1)
    const totalMove = targetPrice - this.breakoutStartPrice;
    const currentMove = currentPrice - this.breakoutStartPrice;
    const progress = totalMove !== 0 ? Math.max(0, Math.min(1, currentMove / totalMove)) : 0;

    this.emit({
      type: 'progress',
      breakoutType,
      currentPrice,
      targetPrice,
      progress,
      timestamp: now,
    });
  }

  /**
   * Notify that a breakout has completed (target reached)
   */
  notifyBreakoutCompletion(
    breakoutType: BreakoutType,
    currentPrice: number,
    targetPrice: number,
    magnitude: number
  ): void {
    if (!this.breakoutInProgress) {
      return;
    }

    this.breakoutInProgress = false;

    this.emit({
      type: 'completion',
      breakoutType,
      currentPrice,
      targetPrice,
      magnitude,
      progress: 1.0,
      timestamp: performance.now() / 1000,
    });
  }

  /**
   * Check if a breakout is currently in progress
   */
  isBreakoutInProgress(): boolean {
    return this.breakoutInProgress;
  }

  /**
   * Reset the notifier state
   */
  reset(): void {
    if (this.warningTimeout !== null) {
      clearTimeout(this.warningTimeout);
      this.warningTimeout = null;
    }
    this.lastWarningTime = 0;
    this.lastProgressTime = 0;
    this.breakoutInProgress = false;
    this.breakoutStartPrice = 0;
  }

  /**
   * Clear all event listeners
   */
  clearListeners(): void {
    this.listeners.clear();
  }
}
