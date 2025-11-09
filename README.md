# OrderBook Reflex Trainer

**[Launch App →](https://deepentropy.github.io/orderbook-reflex/)**

A web-based training tool designed to reduce trader reaction time when reading order books and identifying market signals.

## Overview

OrderBook Reflex Trainer simulates a multi-exchange order book environment and trains traders to quickly recognize and react to pivot points (Pivot Lows and Pivot Highs). The application progressively adapts to your skill level, tightening reaction windows as you improve.

### Key Features

- **Multi-exchange order book visualization** - Real-time bid/ask prices from 6 simulated exchanges (NSDQ, ARCA, NYSE, BATS, EDGE, BYX)
- **Pivot point detection** - Automatically identifies Pivot Lows (entry signals) and Pivot Highs (exit signals)
- **Adaptive difficulty system** - 6 difficulty levels that adjust reaction windows based on performance
- **Performance tracking** - Comprehensive statistics including reaction times, success rates, and streaks
- **Memory challenges** - Optional price memory tests to improve market awareness
- **XP and progression system** - Gamified leveling from Novice to Master
- **Customizable hotkeys** - Configure controls to match your workflow

## How It Works

1. **Monitor the order book** - Watch bid prices (left) and ask prices (right) across multiple exchanges
2. **Wait for signals** - A green border highlights the column when a pivot point is detected:
   - **Green border on BID column** = Pivot Low detected (Entry/Buy signal)
   - **Green border on ASK column** = Pivot High detected (Exit/Sell signal)
3. **React quickly** - Press the designated hotkey before the time window expires:
   - Default: **F1** for Entry signals
   - Default: **F12** for Exit signals
4. **Improve over time** - The reaction window shrinks as you level up, from 1500ms at Novice to 200ms at Master

## Visual Cues

Order book rows are color-coded by price level:
- **Green** - Best bid/ask (NBBO - National Best Bid and Offer)
- **Rose** - 2nd best price
- **Yellow** - 3rd best price
- **Blue** - 4th best price
- **Gray** - Other prices

## Statistics & Progression

The app tracks comprehensive metrics to help you measure improvement:

- **Reaction times** - Current, last, and average response times
- **Success rate** - Percentage of signals correctly identified within the time window
- **Streaks** - Current and best consecutive successful trades
- **XP system** - Earn 1-5 XP per successful trade, unlock higher difficulty levels
- **Session stats** - Track performance within the current session
- **All-time stats** - Historical performance across all sessions

## Controls

| Action | Default Key | Customizable |
|--------|-------------|--------------|
| Entry signal (Pivot Low) | F1 | Yes |
| Exit signal (Pivot High) | F12 | Yes |
| Pause/Resume | Space | Yes |

Access the Settings panel (⚙️) to customize hotkeys.

## Running Locally

### Prerequisites

- Node.js 18 or higher
- npm

### Setup

1. Clone the repository:
```bash
git clone https://github.com/houseofai/orderbook-reflex.git
cd orderbook-reflex
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:5173 in your browser

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety and better developer experience
- **Vite** - Fast build tool and development server
- **GitHub Pages** - Static hosting and deployment

## Project Structure

```
.
├── src/
│   ├── components/
│   │   ├── OrderBookColumn.tsx    # Bid/Ask column rendering
│   │   └── StatsPanel.tsx         # Statistics and history display
│   ├── models/
│   │   ├── QuoteModel.ts          # Quote generation engine
│   │   ├── ExchangeBookGenerator.ts # Multi-exchange simulation
│   │   ├── PriceModel.ts          # Price updates and pivot detection
│   │   └── SignalModel.ts         # Signal timing and validation
│   ├── App.tsx                    # Main application component
│   ├── constants.ts               # Configuration constants
│   └── main.tsx                   # Application entry point
├── public/
│   └── models/
│       └── model.json             # Price generation model data
├── .github/workflows/
│   └── deploy.yml                 # GitHub Pages deployment workflow
└── package.json                   # Dependencies and scripts
```

## Deployment

The app automatically deploys to GitHub Pages when changes are pushed to the `main` branch. The workflow:

1. Builds the React app using Vite
2. Uploads the `dist/` directory to GitHub Pages
3. Makes the app available at https://houseofai.github.io/orderbook-reflex/

## Use Cases

- **Day traders** - Improve reflexes for scalping and quick entries/exits
- **Market makers** - Train to spot NBBO changes faster
- **New traders** - Develop muscle memory for reading order books
- **Skill assessment** - Benchmark reaction times against difficulty levels

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
