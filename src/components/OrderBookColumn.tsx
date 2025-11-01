// OrderBookColumn.tsx

import React from "react";
import { Quote } from "../models/ExchangeBookGenerator";
import {
  COL_BG_COLOR,
  TEXT_COLOR,
  ROW_COLORS,
  DEFAULT_ROW_COLOR,
  MAX_ROWS,
  ROW_HEIGHT,
} from "../constants";

interface OrderBookColumnProps {
  quotes: Quote[];
  side: "bid" | "ask";
  highlighted: boolean;
  spread?: number;
}

export const OrderBookColumn: React.FC<OrderBookColumnProps> = ({
  quotes,
  side,
  highlighted,
  spread = 0,
}) => {
  // Sort quotes
  const sortedQuotes =
    side === "bid"
      ? [...quotes].sort((a, b) => b.priceBid - a.priceBid)
      : [...quotes].sort((a, b) => a.priceAsk - b.priceAsk);

  // Calculate ranks by price
  const ranks = new Map<number, number>();
  let rank = 0;
  let lastPrice: number | null = null;

  for (const q of sortedQuotes.slice(0, MAX_ROWS)) {
    const price = side === "bid" ? q.priceBid : q.priceAsk;
    if (price !== lastPrice) {
      ranks.set(price, rank);
      rank++;
      lastPrice = price;
    }
  }

  // Find NBBO (best price)
  const bestPrice = sortedQuotes.length > 0
    ? (side === "bid" ? sortedQuotes[0].priceBid : sortedQuotes[0].priceAsk)
    : 0;

  // Calculate max size for visualization
  const maxSize = Math.max(...sortedQuotes.slice(0, MAX_ROWS).map(q =>
    side === "bid" ? q.sizeBid : q.sizeAsk
  ));

  return (
    <div
      className="orderbook-column"
      style={{
        backgroundColor: COL_BG_COLOR,
        border: highlighted ? `3px solid rgb(0, 200, 0)` : "none",
      }}
    >
      {/* Spread indicator - only show on bid side */}
      {side === "bid" && spread > 0 && (
        <div className="spread-indicator">
          Spread: ${spread.toFixed(3)}
        </div>
      )}

      <div
        className="column-header"
        style={{
          color: TEXT_COLOR,
          height: `${ROW_HEIGHT}px`,
          padding: "2px 5px",
        }}
      >
        {side.toUpperCase()}
      </div>

      {sortedQuotes.slice(0, MAX_ROWS).map((quote, idx) => {
        const price = side === "bid" ? quote.priceBid : quote.priceAsk;
        const size = side === "bid" ? quote.sizeBid : quote.sizeAsk;
        const r = ranks.get(price) || 0;
        const bgColor = r < ROW_COLORS.length ? ROW_COLORS[r] : DEFAULT_ROW_COLOR;
        const isNBBO = price === bestPrice;
        const sizePercentage = (size / maxSize) * 100;

        return (
          <div
            key={idx}
            className="orderbook-row"
            style={{
              backgroundColor: bgColor,
              height: `${ROW_HEIGHT}px`,
              display: "flex",
              alignItems: "center",
              padding: "0 5px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Size visualization bar */}
            <div
              className="size-bar"
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: `${sizePercentage}%`,
                background: "rgba(0, 0, 0, 0.1)",
                zIndex: 0,
              }}
            />

            <span
              className="exchange"
              style={{
                color: TEXT_COLOR,
                fontSize: "11px",
                fontWeight: "bold",
                width: "50px",
                position: "relative",
                zIndex: 1,
              }}
            >
              {isNBBO && "★"}{quote.exchange.substring(0, 4)}
            </span>
            <span
              className="price"
              style={{
                color: TEXT_COLOR,
                fontSize: "11px",
                fontWeight: "bold",
                width: "65px",
                textAlign: "right",
                position: "relative",
                zIndex: 1,
              }}
            >
              {price.toFixed(2)}
            </span>
            <span
              className="size"
              style={{
                color: TEXT_COLOR,
                fontSize: "11px",
                fontWeight: "bold",
                width: "70px",
                textAlign: "right",
                position: "relative",
                zIndex: 1,
              }}
            >
              {size}
            </span>
          </div>
        );
      })}
    </div>
  );
};
