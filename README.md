# Daily Calculus Drill 📐

A minimalist daily habit tracker and adaptive calculus puzzle app built with **React Native (Expo + TypeScript)**, **SQLite (`expo-sqlite`)**, **Local Notifications (`expo-notifications`)**, **KaTeX (`react-native-webview`)**, and **`mathjs`**.

---

## Project Structure

```text
daily-calculus-drill/
├── App.tsx                                 # Root Navigation & Notification Deep-Link Listener
├── app.json                                # Expo App Config & Plugins
├── package.json                            # Dependencies & Scripts
├── tsconfig.json                           # TypeScript Configuration
└── src/
    ├── types/
    │   └── index.ts                        # Data Models (UserProgress, DrillHistory, CalculusProblem)
    ├── database/
    │   └── db.ts                           # SQLite Schema Migration, Rollover Logic & CRUD Queries
    ├── services/
    │   └── notificationService.ts          # 07:00 AM Daily Local Notification Scheduler
    ├── utils/
    │   ├── problemGenerator.ts             # Tiered Calculus Problem Engine (Levels 1–5, 6–10, 11–20, 20+)
    │   └── mathVerifier.ts                 # mathjs Sanitization & Algebraic Equivalence Verification
    ├── context/
    │   └── DrillContext.tsx                # Global State, Streak & 3-Attempt Progression Engine
    ├── components/
    │   ├── MathRenderer.tsx                # Crisp KaTeX Equation Renderer + Offline Fallback
    │   └── MathKeyboardToolbar.tsx         # Quick-Insert Calculus Symbol Bar (+ C, √, π, e^x, ln, trig)
    └── screens/
        ├── DailyDrillScreen.tsx            # Home Challenge Screen, Shake Animation & Level-Up Modal
        ├── HistoryScreen.tsx               # 14-Day Calendar Strip & Chronological Attempt History
        └── SettingsScreen.tsx              # Notification Time Picker, JSON Backup & Progress Reset
```

---

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the Expo development server:**
   ```bash
   npx expo start
   ```

3. **Run on iOS / Android / Web:**
   - Press `i` to open in iOS Simulator
   - Press `a` to open in Android Emulator
   - Scan the QR code with Expo Go on a physical device
