# Privacy Policy — Daily Calculus Drill

**Effective Date:** November 9, 2026  
**Developer:** Hasintha Hewage (Independent Developer)  
**Application:** Daily Calculus Drill (`com.hasinthahewage.dailycalculusdrill`)

## 1. Overview & Zero-Data-Collection Guarantee
**Daily Calculus Drill** is a 100% local-first, offline-capable educational mathematics application. We **do not collect, transmit, store, share, or sell any personal data, usage analytics, or device identifiers** on any external server.

## 2. On-Device Data Storage
All application data—including your current calculus level, daily streak, problem history, AI skill rating, topic mastery profile, and notification schedule—is stored **exclusively on your device** in a local SQLite database (`daily_calculus_drill.db`).
- You can reset or permanently delete all local progress at any time via **Settings → Reset All Progress to Level 1**.
- You can manually export your progress as a JSON backup using **Settings → Export / Backup SQLite Data (JSON)** via your device's native share sheet.

## 3. Permissions Used
- **Notifications (`POST_NOTIFICATIONS` / `RECEIVE_BOOT_COMPLETED`):** Used solely to schedule your local daily calculus reminder on your device at your chosen time (default `07:00 AM`). No remote push notification tokens are transmitted to any server.

## 4. Third-Party Services
Daily Calculus Drill contains **no third-party advertising SDKs, no analytics trackers, and no cloud user accounts**. When your device is online, mathematical equations may load open-source KaTeX typography stylesheets (`cdn.jsdelivr.net`), with an automatic built-in Unicode renderer when offline.

## 5. Contact
If you have any questions regarding this Privacy Policy, please contact the developer:
- **Developer:** Hasintha Hewage (Independent Developer)
