import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "exports");
const W = 3584;
const H = 1536;
const BASE = "http://127.0.0.1:8766";

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
});

await page.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => {
  const frame = document.getElementById("deck");
  const win = frame?.contentWindow;
  const loading = win?.document?.getElementById("loading");
  const state = win?.deckGetState?.();
  return state?.total === 11 && loading && loading.style.display === "none";
}, { timeout: 120000 });

// Freeze the wall so every slide shares the same backdrop color.
await page.evaluate(() => {
  const plane = document.getElementById("led-plane");
  if (!plane) return;
  plane.style.animation = "none";
  plane.style.opacity = "1";
  plane.classList.add("ambient-off");
  plane.querySelectorAll("*").forEach((el) => {
    el.style.animation = "none";
  });
});

const count = await page.evaluate(() => {
  const frame = document.getElementById("deck");
  return frame?.contentWindow?.deckSlideCount?.() ?? 11;
});

console.log(`Capturing ${count} slides at ${W}×${H}…`);

for (let i = 0; i < count; i++) {
  await page.evaluate((slide) => {
    const frame = document.getElementById("deck");
    const win = frame?.contentWindow;
    if (win?.deckGoTo) win.deckGoTo(slide);
  }, i);

  await page.waitForTimeout(500);

  const name = `slide-${String(i + 1).padStart(2, "0")}-${W}x${H}.png`;
  const file = path.join(OUT, name);
  await page.screenshot({
    path: file,
    type: "png",
    clip: { x: 0, y: 0, width: W, height: H },
  });
  console.log("wrote", name);
}

await browser.close();
console.log("Done →", OUT);
