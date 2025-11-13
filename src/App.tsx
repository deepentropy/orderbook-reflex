// App.tsx - Main application component

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { StatsPanel } from "./components/StatsPanel";
import { OrderBookColumn } from "./components/OrderBookColumn";
import { PriceModel } from "./models/PriceModel";
import { SignalModel } from "./models/SignalModel";
import { QuoteModel } from "./models/QuoteModel";
import { createBullishBreakout, createBearishBreakout, MarketScenario } from "./models/MarketScenario";
import { BreakoutEvent } from "./models/BreakoutNotifier";
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

interface DifficultyLevel {
  name: string;
  baseWindow: number; // Base reaction window in seconds
  xpRequired: number; // XP needed to reach this level
  color: string;
}

interface PriceSnapshot {
  timestamp: number;
  bestBid: number;
  bestAsk: number;
  bestBidExchange: string;
  bestAskExchange: string;
  spread: number;
}

interface MemoryChallenge {
  question: string;
  correctAnswer: string;
  options: string[];
  type: 'price' | 'exchange' | 'spread';
}

const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { name: 'difficulty.novice', baseWindow: 1.5, xpRequired: 0, color: 'rgb(150, 150, 150)' },
  { name: 'difficulty.beginner', baseWindow: 1.0, xpRequired: 50, color: 'rgb(100, 200, 100)' },
  { name: 'difficulty.intermediate', baseWindow: 0.7, xpRequired: 150, color: 'rgb(100, 150, 255)' },
  { name: 'difficulty.advanced', baseWindow: 0.5, xpRequired: 300, color: 'rgb(200, 100, 255)' },
  { name: 'difficulty.expert', baseWindow: 0.3, xpRequired: 500, color: 'rgb(255, 200, 50)' },
  { name: 'difficulty.master', baseWindow: 0.2, xpRequired: 800, color: 'rgb(255, 100, 100)' },
];

function App() {
  const { t, i18n } = useTranslation();
  const [priceModel, setPriceModel] = useState<PriceModel | null>(null);
  const [signalModel] = useState<SignalModel>(() => new SignalModel());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastRt, setLastRt] = useState<number | null>(null);
  const [, setUpdateTrigger] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
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
  const [xp, setXp] = useState(() => {
    const saved = localStorage.getItem("playerXP");
    return saved ? parseInt(saved) : 0;
  });
  const [priceSnapshots, setPriceSnapshots] = useState<PriceSnapshot[]>([]);
  const [memoryChallenge, setMemoryChallenge] = useState<MemoryChallenge | null>(null);
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengesEnabled, setChallengesEnabled] = useState(() => {
    const saved = localStorage.getItem("challengesEnabled");
    return saved ? JSON.parse(saved) : true;
  });
  const [showWelcome, setShowWelcome] = useState(() => {
    const hasVisited = localStorage.getItem("hasVisited");
    return !hasVisited;
  });
  const [isMobile] = useState(() => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);
  const feedbackTimerRef = useRef<number>();

  // Create scenario based on current level
  const createScenarioForLevel = useCallback((level: number): MarketScenario => {
    // Alternate between bullish and bearish breakouts
    const isBullish = Math.random() > 0.5;

    // Adjust difficulty based on level
    const magnitude = Math.max(0.3, 1.5 - level * 0.1); // Smaller breakouts at higher levels
    const timeWindow: [number, number] = [15, 45 - Math.min(level * 2, 20)]; // Tighter window at higher levels

    if (isBullish) {
      return createBullishBreakout({
        breakout: {
          type: 'bullish',
          timeWindow,
          magnitude,
          speed: 'gradual',
          notification: false, // No UI notifications - rely on pivot detection for signals
        },
        duration: 60,
      });
    } else {
      return createBearishBreakout({
        breakout: {
          type: 'bearish',
          timeWindow,
          magnitude,
          speed: 'gradual',
          notification: false, // No UI notifications - rely on pivot detection for signals
        },
        duration: 60,
      });
    }
  }, []);

  // Load model on mount
  useEffect(() => {
    const loadModel = async () => {
      // Calculate level based on current XP
      const level = DIFFICULTY_LEVELS.findIndex(l => xp < l.xpRequired) - 1;
      const currentLevelIndex = Math.max(0, level === -2 ? DIFFICULTY_LEVELS.length - 1 : level);

      try {
        // Try to load the model JSON using relative path
        // This works with base: './' in vite.config.ts for GitHub Pages
        const response = await fetch("./models/model.json");
        if (response.ok) {
          const modelData = await response.json();
          const quoteModel = new QuoteModel(modelData);
          const scenario = createScenarioForLevel(currentLevelIndex + 1);
          const pm = new PriceModel(quoteModel, scenario);

          // Subscribe to breakout start events to trigger immediate signals
          pm.getNotifier().on('start', (event: BreakoutEvent) => {
            if (signalModel.currentSignal === null) {
              const now = performance.now() / 1000;
              // Map breakout type to signal: bullish → ENTRY, bearish → EXIT
              const signal = event.breakoutType === 'bullish' ? 'ENTRY' : 'EXIT';
              signalModel.trigger(signal, now);
            }
          });

          setPriceModel(pm);
        } else {
          // Model not found, use empty model (will generate minimal data)
          console.warn("Model not found, using empty model");
          const quoteModel = new QuoteModel();
          const scenario = createScenarioForLevel(currentLevelIndex + 1);
          const pm = new PriceModel(quoteModel, scenario);

          // Subscribe to breakout start events to trigger immediate signals
          pm.getNotifier().on('start', (event: BreakoutEvent) => {
            if (signalModel.currentSignal === null) {
              const now = performance.now() / 1000;
              // Map breakout type to signal: bullish → ENTRY, bearish → EXIT
              const signal = event.breakoutType === 'bullish' ? 'ENTRY' : 'EXIT';
              signalModel.trigger(signal, now);
            }
          });

          setPriceModel(pm);
        }
      } catch (error) {
        console.error("Error loading model:", error);
        // Fallback to empty model
        const quoteModel = new QuoteModel();
        const scenario = createScenarioForLevel(currentLevelIndex + 1);
        const pm = new PriceModel(quoteModel, scenario);

        // Subscribe to breakout start events to trigger immediate signals
        pm.getNotifier().on('start', (event: BreakoutEvent) => {
          if (signalModel.currentSignal === null) {
            const now = performance.now() / 1000;
            // Map breakout type to signal: bullish → ENTRY, bearish → EXIT
            const signal = event.breakoutType === 'bullish' ? 'ENTRY' : 'EXIT';
            signalModel.trigger(signal, now);
          }
        });

        setPriceModel(pm);
      }
    };

    loadModel();
  }, [createScenarioForLevel, xp, signalModel]); // xp determines the level

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

  // Save XP to localStorage
  useEffect(() => {
    localStorage.setItem("playerXP", xp.toString());
  }, [xp]);

  // Save challenges setting
  useEffect(() => {
    localStorage.setItem("challengesEnabled", JSON.stringify(challengesEnabled));
  }, [challengesEnabled]);

  // Calculate current difficulty level
  const getCurrentLevel = useCallback(() => {
    for (let i = DIFFICULTY_LEVELS.length - 1; i >= 0; i--) {
      if (xp >= DIFFICULTY_LEVELS[i].xpRequired) {
        return DIFFICULTY_LEVELS[i];
      }
    }
    return DIFFICULTY_LEVELS[0];
  }, [xp]);

  const currentLevel = getCurrentLevel();

  // Get next level info for progress bar
  const getNextLevelInfo = useCallback(() => {
    const currentIndex = DIFFICULTY_LEVELS.findIndex(l => l.name === currentLevel.name);
    if (currentIndex === DIFFICULTY_LEVELS.length - 1) {
      return { nextLevel: null, progress: 100 };
    }
    const nextLevel = DIFFICULTY_LEVELS[currentIndex + 1];
    const xpIntoCurrentLevel = xp - currentLevel.xpRequired;
    const xpNeededForNext = nextLevel.xpRequired - currentLevel.xpRequired;
    const progress = (xpIntoCurrentLevel / xpNeededForNext) * 100;
    return { nextLevel, progress };
  }, [currentLevel, xp]);

  // Create memory challenge
  const createMemoryChallenge = useCallback(() => {
    if (priceSnapshots.length < 3) return null;

    const recentSnapshot = priceSnapshots[priceSnapshots.length - 1];
    const challengeTypes = ['bestBid', 'bestAsk', 'bestBidExchange', 'bestAskExchange', 'spread'];
    const randomType = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];

    const exchanges = ['NSDQ', 'ARCA', 'NYSE', 'BATS', 'EDGE', 'BYX'];

    switch (randomType) {
      case 'bestBid':
        return {
          question: 'What was the best bid price?',
          correctAnswer: recentSnapshot.bestBid.toFixed(2),
          options: [
            recentSnapshot.bestBid.toFixed(2),
            (recentSnapshot.bestBid - 0.01).toFixed(2),
            (recentSnapshot.bestBid + 0.01).toFixed(2),
            (recentSnapshot.bestBid - 0.02).toFixed(2),
          ].sort(() => Math.random() - 0.5),
          type: 'price' as const
        };

      case 'bestAsk':
        return {
          question: 'What was the best ask price?',
          correctAnswer: recentSnapshot.bestAsk.toFixed(2),
          options: [
            recentSnapshot.bestAsk.toFixed(2),
            (recentSnapshot.bestAsk - 0.01).toFixed(2),
            (recentSnapshot.bestAsk + 0.01).toFixed(2),
            (recentSnapshot.bestAsk + 0.02).toFixed(2),
          ].sort(() => Math.random() - 0.5),
          type: 'price' as const
        };

      case 'bestBidExchange':
        return {
          question: 'Which exchange had the best bid?',
          correctAnswer: recentSnapshot.bestBidExchange,
          options: [
            recentSnapshot.bestBidExchange,
            ...exchanges.filter(e => e !== recentSnapshot.bestBidExchange).slice(0, 3)
          ].sort(() => Math.random() - 0.5),
          type: 'exchange' as const
        };

      case 'bestAskExchange':
        return {
          question: 'Which exchange had the best ask?',
          correctAnswer: recentSnapshot.bestAskExchange,
          options: [
            recentSnapshot.bestAskExchange,
            ...exchanges.filter(e => e !== recentSnapshot.bestAskExchange).slice(0, 3)
          ].sort(() => Math.random() - 0.5),
          type: 'exchange' as const
        };

      case 'spread':
        return {
          question: 'What was the bid-ask spread?',
          correctAnswer: recentSnapshot.spread.toFixed(2),
          options: [
            recentSnapshot.spread.toFixed(2),
            (recentSnapshot.spread + 0.01).toFixed(2),
            (recentSnapshot.spread - 0.01).toFixed(2),
            (recentSnapshot.spread + 0.02).toFixed(2),
          ].sort(() => Math.random() - 0.5),
          type: 'spread' as const
        };

      default:
        return null;
    }
  }, [priceSnapshots]);

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

  // Process signal response (used by both keyboard and touch)
  const processSignalResponse = useCallback(
    (signalType: "ENTRY" | "EXIT") => {
      if (!priceModel || isPaused) return;

      const now = performance.now() / 1000;
      const dirActive = signalModel.currentSignal;

      // Check if there's an active signal to respond to
      if (!dirActive || signalModel.signalTimestamp === null) return;

      // Verify the correct signal type
      if (dirActive !== signalType) {
        showFeedback(t('feedback.wrongKey'), 'wrong');
        return;
      }

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

      // For touch, we simulate the key press
      const simulatedKey = signalType === "ENTRY" ? hotkeys.entry : hotkeys.exit;
      const ok = signalModel.recordReactionWithKey(simulatedKey, now, hotkeys.entry, hotkeys.exit);

      // Show feedback based on reaction time
      if (rt <= signalModel.reactionWindow * 0.5) {
        showFeedback(t('feedback.perfect'), 'perfect');
      } else if (rt <= signalModel.reactionWindow) {
        showFeedback(t('feedback.good'), 'good');
      } else {
        showFeedback(t('feedback.tooSlow'), 'slow');
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

      // Award XP based on performance
      let earnedXP = 0;
      if (ok) {
        if (rt <= signalModel.reactionWindow * 0.5) {
          earnedXP = 5; // Perfect
        } else if (rt <= signalModel.reactionWindow * 0.75) {
          earnedXP = 3; // Good
        } else {
          earnedXP = 1; // Within window
        }
        setXp(prev => prev + earnedXP);
      }

      // Trigger memory challenge every 10 trades
      if (challengesEnabled && sessionStats.trades > 0 && (sessionStats.trades + 1) % 10 === 0) {
        const challenge = createMemoryChallenge();
        if (challenge) {
          setMemoryChallenge(challenge);
          setShowChallenge(true);
          setIsPaused(true);
        }
      }
    },
    [priceModel, signalModel, hotkeys, isPaused, showFeedback, currentStreak, sessionStats.trades, challengesEnabled, createMemoryChallenge, t]
  );

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

      const dirActive = signalModel.currentSignal;

      // Check if there's an active signal to respond to
      if (!dirActive || signalModel.signalTimestamp === null) return;

      const correctKey = (dirActive === "ENTRY" && event.key === hotkeys.entry) ||
                         (dirActive === "EXIT" && event.key === hotkeys.exit);

      // Determine feedback type
      if (!correctKey) {
        showFeedback(t('feedback.wrongKey'), 'wrong');
        return; // Don't record wrong key presses
      }

      // Process the signal using the shared function
      processSignalResponse(dirActive);
    },
    [priceModel, signalModel, hotkeys, isPaused, togglePause, recordingKey, showFeedback, processSignalResponse, t]
  );

  // Setup keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Override reaction window based on difficulty level
  useEffect(() => {
    if (signalModel) {
      signalModel.reactionWindow = currentLevel.baseWindow;
    }
  }, [signalModel, currentLevel]);

  // Game loop
  useEffect(() => {
    if (!priceModel) return;

    const updateInterval = 1000 / REFRESH_RATE;

    const gameLoop = (timestamp: number) => {
      if (!isPaused && timestamp - lastUpdateRef.current >= updateInterval) {
        const now = performance.now() / 1000;

        // Update price model
        priceModel.update();

        // Capture price snapshot for memory challenges
        if (priceModel.lastExchangeQuotes.length > 0) {
          const bestBidQuote = priceModel.lastExchangeQuotes.reduce((best, q) =>
            q.priceBid > best.priceBid ? q : best
          );
          const bestAskQuote = priceModel.lastExchangeQuotes.reduce((best, q) =>
            q.priceAsk < best.priceAsk ? q : best
          );

          const snapshot: PriceSnapshot = {
            timestamp: now,
            bestBid: bestBidQuote.priceBid,
            bestAsk: bestAskQuote.priceAsk,
            bestBidExchange: bestBidQuote.exchange,
            bestAskExchange: bestAskQuote.exchange,
            spread: bestAskQuote.priceAsk - bestBidQuote.priceBid
          };

          setPriceSnapshots(prev => [...prev.slice(-20), snapshot]);
        }

        // Signals now triggered directly by breakout events (0-lag)
        // Old pivot-based triggering disabled to avoid 30s delay
        // const pivot = priceModel.pivot;
        // if (pivot && signalModel.currentSignal === null) {
        //   const sig = pivot === "PL" ? "ENTRY" : "EXIT";
        //   signalModel.trigger(sig, now);
        // }

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

  // Handle memory challenge answer
  const handleChallengeAnswer = useCallback((answer: string) => {
    if (!memoryChallenge) return;

    const correct = answer === memoryChallenge.correctAnswer;

    if (correct) {
      setXp(prev => prev + 10); // Bonus XP for correct answer
      showFeedback('CORRECT! +10 XP', 'perfect');
    } else {
      showFeedback(`WRONG! Answer: ${memoryChallenge.correctAnswer}`, 'wrong');
    }

    setShowChallenge(false);
    setMemoryChallenge(null);
    setIsPaused(false);
  }, [memoryChallenge, showFeedback]);

  // Handle welcome close
  const handleWelcomeClose = useCallback(() => {
    localStorage.setItem("hasVisited", "true");
    setShowWelcome(false);
  }, []);

  // Handle reset stats
  const handleResetStats = useCallback(() => {
    // Clear all localStorage data
    localStorage.removeItem("allTimeStats");
    localStorage.removeItem("playerXP");
    localStorage.removeItem("hotkeys");
    localStorage.removeItem("challengesEnabled");

    // Reset all state to initial values
    setAllTimeStats({
      totalTrades: 0,
      successfulTrades: 0,
      bestStreak: 0,
      fastestReactionTime: null,
      totalSessions: 0,
      allReactionTimes: []
    });
    setXp(0);
    setCurrentStreak(0);
    setHistory([]);
    setSessionStats({
      trades: 0,
      successful: 0,
      startTime: Date.now()
    });
    setHotkeys({ entry: ENTRY_KEY, exit: EXIT_KEY, pause: " " });
    setChallengesEnabled(true);

    // Close the confirmation dialog
    setShowResetConfirm(false);
    setShowSettings(false);
  }, []);

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
  const { nextLevel, progress } = getNextLevelInfo();

  // Calculate spread
  const spread = priceModel.lastExchangeQuotes.length > 0
    ? priceModel.bestAsk - priceModel.bestBid
    : 0;

  return (
    <div className="app">
      <div className="header">
        <h1 className="title">{t('app.title')}</h1>
        <div className="controls">
          <button className="control-btn" onClick={togglePause}>
            {isPaused ? `▶ ${t('app.resume')}` : `⏸ ${t('app.pause')}`}
          </button>
          <button className="control-btn" onClick={() => setShowSettings(!showSettings)}>
            ⚙ {t('app.settings')}
          </button>
          <button className="control-btn" onClick={() => setChallengesEnabled(!challengesEnabled)}>
            {challengesEnabled ? `${t('app.memoryChallenge')} On` : `${t('app.memoryChallenge')} Off`}
          </button>
          <select
            className="language-selector"
            value={i18n.language.split('-')[0]}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          >
            <option value="en">🇺🇸 EN</option>
            <option value="es">🇪🇸 ES</option>
            <option value="fr">🇫🇷 FR</option>
          </select>
        </div>
      </div>

      {/* Difficulty Level Bar */}
      <div className="difficulty-bar">
        <div className="difficulty-info">
          <span className="level-name" style={{ color: currentLevel.color }}>
            {t(currentLevel.name)}
          </span>
          <span className="level-xp">
            {xp} XP {nextLevel && `/ ${nextLevel.xpRequired} XP`}
          </span>
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{
              width: `${Math.min(progress, 100)}%`,
              background: `linear-gradient(90deg, ${currentLevel.color}, ${nextLevel?.color || currentLevel.color})`
            }}
          />
        </div>
        {nextLevel && (
          <div className="next-level-text">
            Next: {nextLevel.name}
          </div>
        )}
      </div>

      {showSettings && (
        <div className="settings-panel">
          <div className="config-header">{t('settings.title')}</div>

          <div className="settings-section">
            <div className="settings-section-title">{t('settings.hotkeys')}</div>
            <div className="config-instruction">Click a button and press a key</div>
            <div className="config-row">
              <label>{t('settings.entrySignal')}</label>
              <button
                className={`hotkey-record-btn ${recordingKey === 'entry' ? 'recording' : ''}`}
                onClick={() => setRecordingKey('entry')}
              >
                {recordingKey === 'entry' ? 'Press any key...' : hotkeys.entry === ' ' ? 'Space' : hotkeys.entry}
              </button>
            </div>
            <div className="config-row">
              <label>{t('settings.exitSignal')}</label>
              <button
                className={`hotkey-record-btn ${recordingKey === 'exit' ? 'recording' : ''}`}
                onClick={() => setRecordingKey('exit')}
              >
                {recordingKey === 'exit' ? 'Press any key...' : hotkeys.exit === ' ' ? 'Space' : hotkeys.exit}
              </button>
            </div>
            <div className="config-row">
              <label>{t('settings.pauseResume')}</label>
              <button
                className={`hotkey-record-btn ${recordingKey === 'pause' ? 'recording' : ''}`}
                onClick={() => setRecordingKey('pause')}
              >
                {recordingKey === 'pause' ? 'Press any key...' : hotkeys.pause === ' ' ? 'Space' : hotkeys.pause}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section-title">{t('settings.dataManagement')}</div>
            <button className="reset-btn" onClick={() => setShowResetConfirm(true)}>
              🗑️ {t('settings.resetAllStats')}
            </button>
            <div className="reset-warning-text">
              This will reset all progress, XP, and statistics
            </div>
          </div>

          <button className="config-close" onClick={() => { setShowSettings(false); setRecordingKey(null); }}>
            {t('settings.close')}
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

        <div className="orderbook-container">
          {/* Shared spread row above both columns */}
          <div className="spread-row">
            <span className="spread-label">Spread:</span>
            <span className="spread-value">${spread.toFixed(3)}</span>
          </div>

          <div className="orderbook-columns">
            <OrderBookColumn
              quotes={priceModel.lastExchangeQuotes}
              side="bid"
              highlighted={signalModel.currentSignal === "ENTRY"}
              onTap={() => processSignalResponse("ENTRY")}
            />

            <OrderBookColumn
              quotes={priceModel.lastExchangeQuotes}
              side="ask"
              highlighted={signalModel.currentSignal === "EXIT"}
              onTap={() => processSignalResponse("EXIT")}
            />
          </div>
        </div>

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

        {/* Memory Challenge Modal */}
        {showChallenge && memoryChallenge && (
          <div className="challenge-modal">
            <div className="challenge-content">
              <h3 className="challenge-title">🧠 Price Memory Challenge</h3>
              <p className="challenge-question">{memoryChallenge.question}</p>
              <div className="challenge-options">
                {memoryChallenge.options.map((option, idx) => (
                  <button
                    key={idx}
                    className="challenge-option"
                    onClick={() => handleChallengeAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <p className="challenge-hint">+10 XP for correct answer</p>
            </div>
          </div>
        )}

        {/* Welcome Modal */}
        {showWelcome && (
          <div className="welcome-modal">
            <div className="welcome-content">
              <h2 className="welcome-title">🎯 {t('welcome.title')}</h2>
              <div className="welcome-text">
                <div className="welcome-section">
                  <h3>{t('welcome.howItWorks')}</h3>
                  <ul>
                    {isMobile ? (
                      <>
                        <li><strong>{t('orderBook.bid')}</strong> → Tap when highlighted ({t('welcome.entryBuySignal')})</li>
                        <li><strong>{t('orderBook.ask')}</strong> → Tap when highlighted ({t('welcome.exitSellSignal')})</li>
                      </>
                    ) : (
                      <>
                        <li><strong>{t('orderBook.bid')}</strong> → Press <kbd>{hotkeys.entry}</kbd> ({t('welcome.entryBuySignal')})</li>
                        <li><strong>{t('orderBook.ask')}</strong> → Press <kbd>{hotkeys.exit}</kbd> ({t('welcome.exitSellSignal')})</li>
                      </>
                    )}
                    <li>{t('welcome.earnXP')}</li>
                    <li>{t('welcome.testMemory')}</li>
                  </ul>
                </div>

                <div className="welcome-section">
                  <h3>{t('welcome.quickTips')}</h3>
                  <ul>
                    <li>{t('welcome.trackStats')}</li>
                    <li>{t('welcome.customizeControls')}</li>
                  </ul>
                </div>
              </div>

              <button className="welcome-button" onClick={handleWelcomeClose}>
                {t('welcome.startButton')}
              </button>
            </div>
          </div>
        )}

        {/* Reset Confirmation Modal */}
        {showResetConfirm && (
          <div className="reset-confirm-modal">
            <div className="reset-confirm-content">
              <h2 className="reset-confirm-title">⚠️ {t('resetModal.title')}</h2>
              <div className="reset-confirm-text">
                <p><strong>{t('resetModal.message')}</strong></p>
                <p>You will lose:</p>
                <ul>
                  <li>All XP and level progress ({xp} XP)</li>
                  <li>All-time statistics ({allTimeStats.totalTrades} total trades)</li>
                  <li>Current streak ({currentStreak})</li>
                  <li>Best streak ({allTimeStats.bestStreak})</li>
                  <li>Session history</li>
                  <li>Custom hotkeys</li>
                </ul>
              </div>
              <div className="reset-confirm-buttons">
                <button className="reset-confirm-cancel" onClick={() => setShowResetConfirm(false)}>
                  {t('resetModal.cancel')}
                </button>
                <button className="reset-confirm-proceed" onClick={handleResetStats}>
                  {t('resetModal.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="footer">
        <div className="help-text">
          {isPaused ? (
            <span className="paused-text">{t('footer.paused', { key: hotkeys.pause === " " ? "Space" : hotkeys.pause })}</span>
          ) : isMobile ? (
            <>Tap highlighted orderbook side when it appears{!isPaused && <> | Press {hotkeys.pause === " " ? "Space" : hotkeys.pause} to pause</>}</>
          ) : (
            <>Press {hotkeys.entry} on PL (Entry) / {hotkeys.exit} on PH (Exit) | {hotkeys.pause === " " ? "Space" : hotkeys.pause} to pause</>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
