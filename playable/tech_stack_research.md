# Tech Stack Research: Playwright + Next.js App Router

> Research Date: 2026-06-05
> Stack: Next.js (App Router) + Playwright + OpenAI SDK

---

## 1. Playwright in Next.js Route Handlers

### Can `chromium.launch()` Run Inside a Route Handler?

**Yes, but with major caveats.** It works in local development with `npm run dev`, but is **not viable for serverless deployments** (Vercel, Netlify, etc.).

#### Known Issues

| Issue | Details |
|-------|---------|
| **Cold Start Times** | Launching a headless Chromium instance adds 3–10 seconds of latency per request. |
| **Memory Limits** | Chromium requires ~200–500MB of RAM per instance. |
| **Chromium Binary Size** | Full Playwright + Chromium is ~300MB+. Vercel's limit is 50MB compressed. |
| **Timeout Configurations** | Default serverless timeouts (10–60s) are often insufficient. |

### Recommended: Use `playwright-core` (not `playwright`)

For programmatic use, `playwright-core` is lightweight (no test runner, no auto-download).

---

## 2. Local Development Setup

### Installing Playwright Chromium on Windows

```powershell
npx playwright install chromium
```

Binary goes to: `C:\Users\<username>\AppData\Local\ms-playwright\chromium-<version>\`

### Preventing Browser Instance Leaks During Hot Reload

Use a **Global Singleton Pattern** to survive HMR:

```typescript
// lib/browser.ts
import { chromium, Browser } from 'playwright-core';

const globalForBrowser = global as unknown as {
  _browser: Browser | null;
  _browserPromise: Promise<Browser> | null;
};

export async function getBrowser(): Promise<Browser> {
  if (globalForBrowser._browser?.isConnected()) {
    return globalForBrowser._browser;
  }
  if (!globalForBrowser._browserPromise) {
    globalForBrowser._browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }).then((browser) => {
      globalForBrowser._browser = browser;
      globalForBrowser._browserPromise = null;
      browser.on('disconnected', () => { globalForBrowser._browser = null; });
      return browser;
    }).catch((err) => {
      globalForBrowser._browserPromise = null;
      throw err;
    });
  }
  return globalForBrowser._browserPromise;
}
```

---

## 3. Deployment Options

| Platform | Playwright Support | Verdict |
|----------|-------------------|---------|
| **Vercel** | ❌ 50MB limit | **Not recommended** |
| **Railway** | ✅ Docker | **Good option** |
| **Render** | ✅ Docker | **Good option** |
| **Local only** | ✅ Full support | **Best for MVP/demo** |

### Recommended: Local-First MVP

```bash
npm install
npx playwright install chromium
npm run dev
```

When ready for deployment → Docker + Railway/Render.

---

## 4. Next.js App Router Configuration

```typescript
// Route handler configuration
export const maxDuration = 60; // Extend timeout
export const runtime = 'nodejs'; // NOT Edge — Edge can't run Playwright
```

---

## 5. OpenAI SDK in Next.js

✅ **Fully compatible.** Works in Route Handlers, Server Components, and Server Actions.

- Store API key in `.env.local` as `OPENAI_API_KEY` (never `NEXT_PUBLIC_`)
- Use `runtime = 'nodejs'` for longer operations
- The raw `openai` package works perfectly

---

## 6. Recommended `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ['playwright-core'],
  experimental: {
    webpackMemoryOptimizations: true,
  },
};
```
