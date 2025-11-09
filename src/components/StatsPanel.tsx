// StatsPanel.tsx

import React from "react";
import { useTranslation } from "react-i18next";
import { SIGNAL_COLOR, ERROR_COLOR } from "../constants";

interface HistoryEntry {
  dir: string;
  sigPrice: number;
  userPrice: number;
  rt: number;
  ok: boolean;
}

interface Stats {
  avgReactionTime: number;
  successRate: number;
  avgPriceDiff: number;
  totalTrades: number;
  successfulTrades: number;
}

interface AllTimeStats {
  totalTrades: number;
  successfulTrades: number;
  bestStreak: number;
  fastestReactionTime: number | null;
  totalSessions: number;
}

interface SessionStats {
  trades: number;
  successful: number;
  startTime: number;
}

interface StatsPanelProps {
  reactionWindow: number;
  lastRt: number | null;
  history: HistoryEntry[];
  maxHistoryRows?: number; // Not used anymore but kept for compatibility
  stats: Stats;
  currentStreak: number;
  allTimeStats: AllTimeStats;
  sessionStats: SessionStats;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  reactionWindow,
  lastRt,
  history,
  stats,
  currentStreak,
  allTimeStats,
  sessionStats,
}) => {
  const { t } = useTranslation();
  // Prepare data for graph - last 20 entries
  const graphData = history.slice(-20);
  const maxDisplayTime = Math.max(reactionWindow * 1.5, 0.5); // Show at least 500ms

  // Graph dimensions
  const graphWidth = 180;
  const graphHeight = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };
  const plotWidth = graphWidth - padding.left - padding.right;
  const plotHeight = graphHeight - padding.top - padding.bottom;

  // Calculate moving average for trend line (simple moving average of 5)
  const calculateTrendLine = () => {
    if (graphData.length < 2) return [];

    const windowSize = Math.min(5, Math.floor(graphData.length / 2));
    const trendPoints: { x: number; y: number }[] = [];

    for (let i = 0; i < graphData.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(graphData.length, i + Math.ceil(windowSize / 2));
      const slice = graphData.slice(start, end);
      const avg = slice.reduce((sum, entry) => sum + entry.rt, 0) / slice.length;

      const x = padding.left + (i / Math.max(graphData.length - 1, 1)) * (plotWidth - Math.max(plotWidth / Math.max(graphData.length, 20) - 1, 3));
      const normalizedAvg = Math.min(avg, maxDisplayTime);
      const y = padding.top + plotHeight - (normalizedAvg / maxDisplayTime) * plotHeight;

      trendPoints.push({ x, y });
    }

    return trendPoints;
  };

  const trendLine = calculateTrendLine();

  return (
    <div className="stats-panel">
      <div className="stats-section">
        <div className="stat-item">
          <span className="stat-label">{t('stats.window')}</span>
          <span style={{ color: SIGNAL_COLOR }}>
            {(reactionWindow * 1000).toFixed(0)}ms
          </span>
        </div>

        {lastRt !== null && (
          <div className="stat-item">
            <span className="stat-label">{t('stats.lastRT')}</span>
            <span
              style={{
                color: lastRt <= reactionWindow ? SIGNAL_COLOR : ERROR_COLOR,
              }}
            >
              {(lastRt * 1000).toFixed(0)}ms
            </span>
          </div>
        )}

        <div className="stat-item">
          <span className="stat-label">{t('stats.avgRT')}</span>
          <span style={{ color: SIGNAL_COLOR }}>
            {(stats.avgReactionTime * 1000).toFixed(0)}ms
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.success')}</span>
          <span
            style={{
              color: stats.successRate >= 80 ? SIGNAL_COLOR : stats.successRate >= 50 ? "rgb(255, 200, 0)" : ERROR_COLOR,
            }}
          >
            {stats.successRate.toFixed(1)}%
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.trades')}</span>
          <span style={{ color: "rgb(255, 255, 255)" }}>
            {stats.successfulTrades}/{stats.totalTrades}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.avgDiff')}</span>
          <span style={{ color: "rgb(255, 255, 255)" }}>
            ${stats.avgPriceDiff.toFixed(3)}
          </span>
        </div>

        {/* Streak Counter */}
        {currentStreak > 0 && (
          <div className="stat-item streak-item">
            <span className="stat-label">{t('stats.streak')}</span>
            <span className="streak-value">
              🔥 {currentStreak}
            </span>
          </div>
        )}

        {/* Session vs All-Time */}
        <div className="stats-divider">{t('stats.sessionVsAllTime')}</div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.session')}</span>
          <span style={{ color: "rgb(200, 200, 200)", fontSize: "10px" }}>
            {sessionStats.successful}/{sessionStats.trades}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.allTime')}</span>
          <span style={{ color: "rgb(200, 200, 200)", fontSize: "10px" }}>
            {allTimeStats.successfulTrades}/{allTimeStats.totalTrades}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.bestStreak')}</span>
          <span style={{ color: "rgb(255, 200, 0)", fontSize: "10px" }}>
            {allTimeStats.bestStreak}
          </span>
        </div>

        {allTimeStats.fastestReactionTime !== null && (
          <div className="stat-item">
            <span className="stat-label">{t('stats.fastest')}</span>
            <span style={{ color: "rgb(87, 254, 1)", fontSize: "10px" }}>
              {(allTimeStats.fastestReactionTime * 1000).toFixed(0)}ms
            </span>
          </div>
        )}
      </div>

      <div className="graph-section">
        <div className="graph-header">{t('stats.reactionTimeHistory')}</div>
        <svg className="rt-graph" width={graphWidth} height={graphHeight}>
          {/* Y-axis labels */}
          <text x={5} y={padding.top + 5} fontSize={9} fill="rgb(180, 180, 180)">
            {(maxDisplayTime * 1000).toFixed(0)}
          </text>
          <text x={5} y={graphHeight - padding.bottom - 5} fontSize={9} fill="rgb(180, 180, 180)">
            0
          </text>

          {/* Plot area background */}
          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={plotHeight}
            fill="rgb(35, 35, 35)"
            stroke="rgb(80, 80, 80)"
            strokeWidth={1}
          />

          {/* Window threshold line */}
          {(() => {
            const windowY = padding.top + plotHeight - (reactionWindow / maxDisplayTime) * plotHeight;
            return (
              <>
                <line
                  x1={padding.left}
                  y1={windowY}
                  x2={padding.left + plotWidth}
                  y2={windowY}
                  stroke="rgb(255, 200, 0)"
                  strokeWidth={1.5}
                  strokeDasharray="3,3"
                />
                <text
                  x={padding.left + plotWidth - 25}
                  y={windowY - 3}
                  fontSize={8}
                  fill="rgb(255, 200, 0)"
                >
                  {(reactionWindow * 1000).toFixed(0)}
                </text>
              </>
            );
          })()}

          {/* Reaction time bars */}
          {graphData.map((entry, idx) => {
            const barWidth = Math.max(plotWidth / Math.max(graphData.length, 20) - 1, 3);
            const x = padding.left + (idx / Math.max(graphData.length - 1, 1)) * (plotWidth - barWidth);
            const normalizedRt = Math.min(entry.rt, maxDisplayTime);
            const barHeight = (normalizedRt / maxDisplayTime) * plotHeight;
            const y = padding.top + plotHeight - barHeight;
            const color = entry.ok ? SIGNAL_COLOR : ERROR_COLOR;

            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                fill={color}
                opacity={0.8}
              />
            );
          })}

          {/* Trend line - moving average */}
          {trendLine.length > 1 && (
            <polyline
              points={trendLine.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke="rgb(3, 254, 249)"
              strokeWidth={2}
              opacity={0.9}
            />
          )}

          {/* X-axis label */}
          <text
            x={graphWidth / 2}
            y={graphHeight - 2}
            fontSize={9}
            fill="rgb(180, 180, 180)"
            textAnchor="middle"
          >
            {t('stats.lastNTrades', { count: graphData.length })}
          </text>
        </svg>
      </div>
    </div>
  );
};
