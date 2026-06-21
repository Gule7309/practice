import { chromium, type Browser } from "playwright-core";

const globalForBrowser = global as unknown as {
  _browser: Browser | null;
  _browserPromise: Promise<Browser> | null;
};

export async function getBrowser(): Promise<Browser> {
  if (globalForBrowser._browser?.isConnected()) {
    return globalForBrowser._browser;
  }

  if (!globalForBrowser._browserPromise) {
    globalForBrowser._browserPromise = chromium
      .launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      })
      .then((browser) => {
        globalForBrowser._browser = browser;
        globalForBrowser._browserPromise = null;

        browser.on("disconnected", () => {
          globalForBrowser._browser = null;
        });

        return browser;
      })
      .catch((err) => {
        globalForBrowser._browserPromise = null;
        throw err;
      });
  }

  return globalForBrowser._browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (globalForBrowser._browser) {
    await globalForBrowser._browser.close().catch(console.error);
    globalForBrowser._browser = null;
  }
}
