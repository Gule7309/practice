import { getBrowser } from "./browser";
import path from "path";
import fs from "fs";

export type CaptureResult = {
  url: string;
  title: string;
  description: string | null;
  videoFilename: string;
  absoluteVideoPath: string;
  interactionTrace: string[];
};

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "playabl.ai" ||
      parsed.hostname.endsWith(".playabl.ai")
    );
  } catch {
    return false;
  }
}

export async function captureGame(url: string): Promise<CaptureResult> {
  if (!isAllowedUrl(url)) {
    throw new Error("Only public Playabl URLs are allowed in this MVP.");
  }

  // Ensure temp-videos directory exists in public folder
  const tempVideosDir = path.join(process.cwd(), "public", "temp-videos");
  if (!fs.existsSync(tempVideosDir)) {
    fs.mkdirSync(tempVideosDir, { recursive: true });
  }

  const browser = await getBrowser();
  
  // Create browser context with video recording enabled
  const context = await browser.newContext({
    viewport: { width: 854, height: 480 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: tempVideosDir,
      size: { width: 854, height: 480 },
    },
  });

  const page = await context.newPage();
  const trace: string[] = [];

  try {
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(30_000);

    // Navigate and wait for load
    await page.goto(url, {
      waitUntil: "load",
      timeout: 30_000,
    });
    trace.push("Loaded page and waited for load event.");

    // Extract metadata
    const metadata = await page.evaluate(() => {
      const getMeta = (selector: string) =>
        document.querySelector(selector)?.getAttribute("content") ?? null;

      return {
        title:
          getMeta('meta[property="og:title"]') ||
          document.title ||
          "Untitled game",
        description:
          getMeta('meta[property="og:description"]') ||
          getMeta('meta[name="description"]'),
      };
    });

    // 1. Initial wait (capture start screen / loading phase)
    await page.waitForTimeout(1000);
    trace.push("Recorded initial start screen state.");

    // 2. Click center (427, 240) to activate focus and dismiss simple start modals
    await page.mouse.click(427, 240);
    trace.push("Clicked center of viewport to activate canvas.");
    await page.waitForTimeout(300);

    // Double-click center in case the first click was just browser activation
    await page.mouse.click(427, 240);
    trace.push("Clicked center of viewport again to trigger play state.");
    await page.waitForTimeout(500);

    // 3. Perform basic keyboard actions (spacebar and WASD/arrow keys)
    const keys = ["Space", "ArrowUp", "ArrowRight", "KeyA", "KeyD"];
    for (const key of keys) {
      await page.keyboard.press(key);
      trace.push(`Pressed keyboard key: ${key}`);
      await page.waitForTimeout(300);
    }

    // 4. Perform drag/swipe gesture in case it's a swipe-based game
    trace.push("Simulating drag/swipe gesture from bottom-center upwards.");
    await page.mouse.move(427, 360);
    await page.mouse.down();
    await page.mouse.move(427, 200, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // 5. Final wait to capture results/audio feedback in video
    await page.waitForTimeout(1000);
    trace.push("Completed interaction recording.");

    // Get the recorded video path
    const videoFile = page.video();
    if (!videoFile) {
      throw new Error("Failed to record gameplay video.");
    }

    const absoluteVideoPath = await videoFile.path();
    const videoFilename = path.basename(absoluteVideoPath);

    return {
      url,
      title: metadata.title,
      description: metadata.description,
      videoFilename,
      absoluteVideoPath,
      interactionTrace: trace,
    };
  } finally {
    await context.close();
  }
}

