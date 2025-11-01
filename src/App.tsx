// App.tsx - Main application component

import { useState, useEffect, useRef, useCallback } from "react";
import { StatsPanel } from "./components/StatsPanel";
import { OrderBookColumn } from "./components/OrderBookColumn";
import { PriceModel } from "./models/PriceModel";
import { SignalModel } from "./models/SignalModel";
import { QuoteModel } from "./models/QuoteModel";
import { REFRESH_RATE, ENTRY_KEY, EXIT_KEY } from "./constants";
import "./App.css";

interface HistoryEntry {
  dir: string;
  sigPrice: number;
  userPrice: number;
  rt: number;
  ok: boolean;
}

interface HotkeyConfig {
  entry: string;
  exit: string;
  pause: string;
}

interface FeedbackState {
  message: string;
  type: 'perfect' | 'good' | 'slow' | 'wrong' | null;
  visible: boolean;
}

interface AllTimeStats {
  totalTrades: number;
  successfulTrades: number;
  bestStreak: number;
  fastestReactionTime: number | null;
  totalSessions: number;
  allReactionTimes: number[];
}

interface SessionStats {
  trades: number;
  successful: number;
  startTime: number;
}

function App() {
  const [priceModel, setPriceModel] = useState<PriceModel | null>(null);
  const [signalModel] = useState<SignalModel>(() => new SignalModel());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastRt, setLastRt] = useState<number | null>(null);
  const [, setUpdateTrigger] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showHotkeyConfig, setShowHotkeyConfig] = useState(false);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(() => {
    const saved = localStorage.getItem("hotkeys");
    return saved ? JSON.parse(saved) : { entry: ENTRY_KEY, exit: EXIT_KEY, pause: " " };
  });
  const [recordingKey, setRecordingKey] = useState<'entry' | 'exit' | 'pause' | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({ message: '', type: null, visible: false });
  const [flashEffect, setFlashEffect] = useState<'success' | 'error' | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats>(() => {
    const saved = localStorage.getItem("allTimeStats");
    return saved ? JSON.parse(saved) : {
      totalTrades: 0,
      successfulTrades: 0,
      bestStreak: 0,
      fastestReactionTime: null,
      totalSessions: 0,
      allReactionTimes: []
    };
  });
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    trades: 0,
    successful: 0,
    startTime: Date.now()
  });

  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);
  const feedbackTimerRef = useRef<number>();

  // Load model on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        // Try to load the model JSON using relative path
        // This works with base: './' in vite.config.ts for GitHub Pages
        const response = await fetch("./models/model.json");
        if (response.ok) {
          const modelData = await response.json();
          const quoteModel = new QuoteModel(modelData);
          const pm = new PriceModel(quoteModel);
          setPriceModel(pm);
        } else {
          // Model not found, use empty model (will generate minimal data)
          console.warn("Model not found, using empty model");
          const quoteModel = new QuoteModel();
          const pm = new PriceModel(quoteModel);
          setPriceModel(pm);
        }
      } catch (error) {
        console.error("Error loading model:", error);
        // Fallback to empty model
        const quoteModel = new QuoteModel();
        const pm = new PriceModel(quoteModel);
        setPriceModel(pm);
      }
    };

    loadModel();
  }, []);

  // Save hotkeys to localStorage
  useEffect(() => {
    localStorage.setItem("hotkeys", JSON.stringify(hotkeys));
  }, [hotkeys]);

  // Save all-time stats to localStorage
  useEffect(() => {
    localStorage.setItem("allTimeStats", JSON.stringify(allTimeStats));
  }, [allTimeStats]);

  // Increment session count on mount
  useEffect(() => {
    setAllTimeStats(prev => ({
      ...prev,
      totalSessions: prev.totalSessions + 1
    }));
  }, []);

  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Show feedback helper
  const showFeedback = useCallback((message: string, type: FeedbackState['type']) => {
    // Clear existing timer
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    // Show feedback
    setFeedback({ message, type, visible: true });
    setFlashEffect(type === 'wrong' || type === 'slow' ? 'error' : 'success');

    // Hide feedback after delay
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback({ message: '', type: null, visible: false });
      setFlashEffect(null);
    }, 1000);
  }, []);

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Handle hotkey recording mode
      if (recordingKey !== null) {
        event.preventDefault();
        const key = event.key === " " ? " " : event.key;
        setHotkeys((prev) => ({ ...prev, [recordingKey]: key }));
        setRecordingKey(null);
        return;
      }

      // Handle pause key
      if (event.key === hotkeys.pause) {
        event.preventDefault();
        togglePause();
        return;
      }

      if (!priceModel || isPaused) return;

      const now = performance.now() / 1000;
      const dirActive = signalModel.currentSignal;

      // Check if there's an active signal to respond to
      if (!dirActive || signalModel.signalTimestamp === null) return;

      let sigPrice: number = 0;
      let userPrice: number = 0;

      if (dirActive === "ENTRY") {
        sigPrice = priceModel.pivotBid;
        userPrice = priceModel.bestBid;
      } else {
        sigPrice = priceModel.pivotAsk;
        userPrice = priceModel.bestAsk;
      }

      const rt = now - signalModel.signalTimestamp;
      const correctKey = (dirActive === "ENTRY" && event.key === hotkeys.entry) ||
                         (dirActive === "EXIT" && event.key === hotkeys.exit);

      // Determine feedback type
      if (!correctKey) {
        showFeedback('WRONG KEY!', 'wrong');
        return; // Don't record wrong key presses
      }

      const ok = signalModel.recordReactionWithKey(event.key, now, hotkeys.entry, hotkeys.exit);

      // Show feedback based on reaction time
      if (rt <= signalModel.reactionWindow * 0.5) {
        showFeedback('PERFECT!', 'perfect');
      } else if (rt <= signalModel.reactionWindow) {
        showFeedback('GOOD!', 'good');
      } else {
        showFeedback('TOO SLOW!', 'slow');
      }

      const newEntry: HistoryEntry = {
        dir: dirActive,
        sigPrice,
        userPrice,
        rt,
        ok,
      };

      setHistory((prev) => [...prev.slice(-49), newEntry]);
      setLastRt(rt);

      // Update streak
      if (ok) {
        setCurrentStreak(prev => prev + 1);
      } else {
        setCurrentStreak(0);
      }

      // Update session stats
      setSessionStats(prev => ({
        ...prev,
        trades: prev.trades + 1,
        successful: prev.successful + (ok ? 1 : 0)
      }));

      // Update all-time stats
      setAllTimeStats(prev => {
        const newStreak = ok ? currentStreak + 1 : 0;
        const newReactionTimes = [...prev.allReactionTimes, rt].slice(-1000); // Keep last 1000

        return {
          ...prev,
          totalTrades: prev.totalTrades + 1,
          successfulTrades: prev.successfulTrades + (ok ? 1 : 0),
          bestStreak: Math.max(prev.bestStreak, newStreak),
          fastestReactionTime: prev.fastestReactionTime === null
            ? rt
            : Math.min(prev.fastestReactionTime, rt),
          allReactionTimes: newReactionTimes
        };
      });
    },
    [priceModel, signalModel, hotkeys, isPaused, togglePause, recordingKey, showFeedback, currentStreak]
  );

  // Setup keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Game loop
  useEffect(() => {
    if (!priceModel) return;

    const updateInterval = 1000 / REFRESH_RATE;

    const gameLoop = (timestamp: number) => {
      if (!isPaused && timestamp - lastUpdateRef.current >= updateInterval) {
        const now = performance.now() / 1000;

        // Update price model
        priceModel.update();

        // Trigger signal when pivot appears
        const pivot = priceModel.pivot;
        if (pivot && signalModel.currentSignal === null) {
          const sig = pivot === "PL" ? "ENTRY" : "EXIT";
          signalModel.trigger(sig, now);
        }

        setUpdateTrigger((prev) => prev + 1);
        lastUpdateRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [priceModel, signalModel, isPaused]);

  if (!priceModel) {
    return (
      <div className="loading">
        <h2>Loading OrderBook Reflex Trainer...</h2>
      </div>
    );
  }

  // Calculate comprehensive stats
  const calculateStats = () => {
    if (history.length === 0) {
      return {
        avgReactionTime: 0,
        successRate: 0,
        avgPriceDiff: 0,
        totalTrades: 0,
        successfulTrades: 0,
      };
    }

    const totalTrades = history.length;
    const successfulTrades = history.filter((h) => h.ok).length;
    const successRate = (successfulTrades / totalTrades) * 100;
    const avgReactionTime = history.reduce((sum, h) => sum + h.rt, 0) / totalTrades;
    const avgPriceDiff = history.reduce((sum, h) => sum + Math.abs(h.userPrice - h.sigPrice), 0) / totalTrades;

    return {
      avgReactionTime,
      successRate,
      avgPriceDiff,
      totalTrades,
      successfulTrades,
    };
  };

  const stats = calculateStats();

  return (
    <div className="app">
      <div className="header">
        <h1 className="title">OrderBook Reflex Trainer</h1>
        <div className="controls">
          <button className="control-btn" onClick={togglePause}>
            {isPaused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button className="control-btn" onClick={() => setShowHotkeyConfig(!showHotkeyConfig)}>
            ⚙ Hotkeys
          </button>
        </div>
      </div>

      {showHotkeyConfig && (
        <div className="hotkey-config">
          <div className="config-header">Configure Hotkeys</div>
          <div className="config-instruction">Click a button and press a key</div>
          <div className="config-row">
            <label>Entry Signal:</label>
            <button
              className={`hotkey-record-btn ${recordingKey === 'entry' ? 'recording' : ''}`}
              onClick={() => setRecordingKey('entry')}
            >
              {recordingKey === 'entry' ? 'Press any key...' : hotkeys.entry === ' ' ? 'Space' : hotkeys.entry}
            </button>
          </div>
          <div className="config-row">
            <label>Exit Signal:</label>
            <button
              className={`hotkey-record-btn ${recordingKey === 'exit' ? 'recording' : ''}`}
              onClick={() => setRecordingKey('exit')}
            >
              {recordingKey === 'exit' ? 'Press any key...' : hotkeys.exit === ' ' ? 'Space' : hotkeys.exit}
            </button>
          </div>
          <div className="config-row">
            <label>Pause/Resume:</label>
            <button
              className={`hotkey-record-btn ${recordingKey === 'pause' ? 'recording' : ''}`}
              onClick={() => setRecordingKey('pause')}
            >
              {recordingKey === 'pause' ? 'Press any key...' : hotkeys.pause === ' ' ? 'Space' : hotkeys.pause}
            </button>
          </div>
          <button className="config-close" onClick={() => { setShowHotkeyConfig(false); setRecordingKey(null); }}>
            Close
          </button>
        </div>
      )}

      <div className={`main-content ${flashEffect ? `flash-${flashEffect}` : ''}`}>
        <StatsPanel
          reactionWindow={signalModel.reactionWindow}
          lastRt={lastRt}
          history={history}
          maxHistoryRows={10}
          stats={stats}
          currentStreak={currentStreak}
          allTimeStats={allTimeStats}
          sessionStats={sessionStats}
        />

        <OrderBookColumn
          quotes={priceModel.lastExchangeQuotes}
          side="bid"
          highlighted={signalModel.currentSignal === "ENTRY"}
        />

        <OrderBookColumn
          quotes={priceModel.lastExchangeQuotes}
          side="ask"
          highlighted={signalModel.currentSignal === "EXIT"}
        />

        {/* Feedback overlay */}
        {feedback.visible && (
          <div className={`feedback-overlay feedback-${feedback.type}`}>
            <div className="feedback-message">{feedback.message}</div>
            {feedback.type === 'perfect' && <div className="feedback-subtitle">Outstanding reflexes!</div>}
            {feedback.type === 'good' && <div className="feedback-subtitle">Within window</div>}
            {feedback.type === 'slow' && <div className="feedback-subtitle">Try to be faster</div>}
            {feedback.type === 'wrong' && <div className="feedback-subtitle">Wrong signal key</div>}
          </div>
        )}
      </div>

      <div className="footer">
        <div className="help-text">
          {isPaused ? (
            <span className="paused-text">PAUSED - Press {hotkeys.pause === " " ? "Space" : hotkeys.pause} to resume</span>
          ) : (
            <>Press {hotkeys.entry} on PL (Entry) / {hotkeys.exit} on PH (Exit) | {hotkeys.pause === " " ? "Space" : hotkeys.pause} to pause</>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
