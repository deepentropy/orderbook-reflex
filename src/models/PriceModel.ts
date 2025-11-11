// PriceModel.ts - Converted from price_model.py

import { QuoteModel, QuoteGenerator } from "./QuoteModel";
import { ExchangeBookGenerator, Quote } from "./ExchangeBookGenerator";
import { MarketScenario, createRangingScenario } from "./MarketScenario";
import { RegimeScheduler } from "./RegimeScheduler";
import { BreakoutNotifier } from "./BreakoutNotifier";

interface BufferEntry {
  bid: number;
  ask: number;
  mid: number;
}

export class PriceModel {
  private generator: QuoteGenerator;
  private exchangeGen: ExchangeBookGenerator;
  private window: number;
  private buffer: BufferEntry[];
  private maxBufferSize: number;
  private scenario: MarketScenario;
  private scheduler: RegimeScheduler;
  private notifier: BreakoutNotifier;
  private startTime: number;
  private elapsedTime: number;
  private hasNotifiedBreakoutStart: boolean;

  public lastExchangeQuotes: Quote[];
  public pivot: "PL" | "PH" | null;
  public pivotBid: number;
  public pivotAsk: number;
  public bestBid: number;
  public bestAsk: number;

  constructor(
    quoteModel: QuoteModel,
    scenario?: MarketScenario,
    _tickSize: number = 0.01,
    windowSeconds: number = 30
  ) {
    // Use provided scenario or create default ranging scenario
    this.scenario = scenario || createRangingScenario();

    const baseBid = this.scenario.startPrice;
    const baseAsk = baseBid + this.scenario.spread.base;

    this.generator = new QuoteGenerator(quoteModel, baseBid, baseAsk);
    this.exchangeGen = new ExchangeBookGenerator(undefined, undefined, 42);
    this.lastExchangeQuotes = [];

    this.window = windowSeconds;

    // Initialize buffer
    this.maxBufferSize = 2 * windowSeconds + 1;
    this.buffer = [];
    for (let i = 0; i < this.maxBufferSize; i++) {
      this.buffer.push({
        bid: baseBid,
        ask: baseAsk,
        mid: (baseBid + baseAsk) / 2,
      });
    }

    this.pivot = null;
    this.pivotBid = baseBid;
    this.pivotAsk = baseAsk;
    this.bestBid = baseBid;
    this.bestAsk = baseAsk;

    // Initialize scheduler and notifier
    this.scheduler = new RegimeScheduler();
    this.scheduler.schedule(this.scenario);

    this.notifier = new BreakoutNotifier();

    this.startTime = performance.now() / 1000;
    this.elapsedTime = 0;
    this.hasNotifiedBreakoutStart = false;
  }

  update(): void {
    const nowDt = new Date();
    const now = performance.now() / 1000;

    // Update elapsed time
    this.elapsedTime = now - this.startTime;

    // Get current regime from scheduler
    const { regime, sign, targetPrice } = this.scheduler.getCurrentRegime(this.elapsedTime);

    // Handle breakout notifications
    this.handleBreakoutNotifications();

    // Generate tick with current regime and optional target price
    const ticks = this.generator.stepSecond(nowDt, regime, sign, targetPrice);

    let bid: number;
    let ask: number;
    let mid: number;

    if (ticks.length > 0) {
      const last = ticks[ticks.length - 1];
      this.lastExchangeQuotes = this.exchangeGen.generate(last);
      bid = last.priceBid;
      ask = last.priceAsk;

      // Use volume-weighted mid price for better accuracy
      const totalBidSize = last.sizeBid;
      const totalAskSize = last.sizeAsk;
      mid = this.generator.getVolumeWeightedMid(totalBidSize, totalAskSize);

      this.bestBid = bid;
      this.bestAsk = ask;
    } else {
      // No variation, reuse last price
      const lastEntry = this.buffer[this.buffer.length - 1];
      bid = lastEntry.bid;
      ask = lastEntry.ask;
      mid = lastEntry.mid;
    }

    // Update buffer (append to end, remove from beginning)
    this.buffer.push({ bid, ask, mid });
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Detect pivot at window position in the past
    if (this.buffer.length === this.maxBufferSize) {
      const centre = this.buffer[this.window];
      const mids = this.buffer.map((e) => e.mid);

      const maxMid = Math.max(...mids);
      const minMid = Math.min(...mids);

      if (centre.mid === maxMid) {
        this.pivot = "PH"; // Pivot High
      } else if (centre.mid === minMid) {
        this.pivot = "PL"; // Pivot Low
      } else {
        this.pivot = null;
      }

      this.pivotBid = centre.bid;
      this.pivotAsk = centre.ask;
    }
  }

  /**
   * Handle breakout notifications (warnings, start, progress, completion)
   */
  private handleBreakoutNotifications(): void {
    const breakoutEvent = this.scheduler.getBreakoutEvent();
    if (!breakoutEvent || this.scenario.breakout.type === 'none') {
      return;
    }

    const { startTime, targetPrice, type } = breakoutEvent;
    const currentPrice = this.bestBid;

    // Check for warning (if enabled)
    if (this.scenario.breakout.notification && this.scenario.breakout.preWarning) {
      this.notifier.scheduleWarning(
        startTime,
        this.elapsedTime,
        this.scenario.breakout.preWarning,
        type,
        this.scenario.breakout.magnitude
      );
    }

    // Check if breakout has started
    const isInBreakout = this.scheduler.isInBreakout(this.elapsedTime);

    if (isInBreakout && !this.hasNotifiedBreakoutStart) {
      const expectedDuration = breakoutEvent.endTime - breakoutEvent.startTime;
      this.notifier.notifyBreakoutStart(
        type,
        currentPrice,
        targetPrice,
        this.scenario.breakout.magnitude,
        expectedDuration
      );
      this.hasNotifiedBreakoutStart = true;
    }

    // Check progress during breakout
    if (isInBreakout && this.hasNotifiedBreakoutStart) {
      this.notifier.notifyProgress(type, currentPrice, targetPrice);

      // Check if target reached (within 0.2%)
      const distanceToTarget = Math.abs(targetPrice - currentPrice);
      const threshold = Math.abs(targetPrice) * 0.002;

      if (distanceToTarget < threshold) {
        this.notifier.notifyBreakoutCompletion(
          type,
          currentPrice,
          targetPrice,
          this.scenario.breakout.magnitude
        );
      }
    }

    // Reset notification flag if we've exited breakout period
    if (!isInBreakout && this.hasNotifiedBreakoutStart) {
      // Check if breakout completed successfully
      const distanceToTarget = Math.abs(targetPrice - currentPrice);
      const threshold = Math.abs(targetPrice) * 0.005; // 0.5%

      if (distanceToTarget < threshold) {
        this.notifier.notifyBreakoutCompletion(
          type,
          currentPrice,
          targetPrice,
          this.scenario.breakout.magnitude
        );
      }

      // Allow for future breakouts (if scenario has multiple)
      this.hasNotifiedBreakoutStart = false;
    }
  }

  /**
   * Get the breakout notifier to register event listeners
   */
  getNotifier(): BreakoutNotifier {
    return this.notifier;
  }

  /**
   * Get the current scenario
   */
  getScenario(): MarketScenario {
    return this.scenario;
  }

  /**
   * Get elapsed time since scenario start
   */
  getElapsedTime(): number {
    return this.elapsedTime;
  }

  /**
   * Check if currently in a breakout
   */
  isInBreakout(): boolean {
    return this.scheduler.isInBreakout(this.elapsedTime);
  }

  /**
   * Get time until next breakout (or null if none scheduled)
   */
  getTimeUntilBreakout(): number | null {
    return this.scheduler.getTimeUntilBreakout(this.elapsedTime);
  }

  /**
   * Reset the model with a new scenario
   */
  resetWithScenario(scenario: MarketScenario): void {
    this.scenario = scenario;

    // Reset scheduler
    this.scheduler.reset();
    this.scheduler.schedule(scenario);

    // Reset notifier
    this.notifier.reset();

    // Reset prices
    const baseBid = scenario.startPrice;
    const baseAsk = baseBid + scenario.spread.base;

    this.generator = new QuoteGenerator(
      (this.generator as any).model,
      baseBid,
      baseAsk
    );

    // Reset buffer
    this.buffer = [];
    for (let i = 0; i < this.maxBufferSize; i++) {
      this.buffer.push({
        bid: baseBid,
        ask: baseAsk,
        mid: (baseBid + baseAsk) / 2,
      });
    }

    this.bestBid = baseBid;
    this.bestAsk = baseAsk;
    this.pivot = null;
    this.pivotBid = baseBid;
    this.pivotAsk = baseAsk;

    // Reset timing
    this.startTime = performance.now() / 1000;
    this.elapsedTime = 0;
    this.hasNotifiedBreakoutStart = false;
  }
}
