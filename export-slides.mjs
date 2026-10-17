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

// Show the screen (it fades in from opacity 0) and freeze only the moving wall.
await page.evaluate(() => {
  const plane = document.getElementById("led-plane");
  if (plane) {
    plane.style.animation = "none";
    plane.style.opacity = "1";
    plane.classList.add("ambient-off");
  }
  const rig = document.getElementById("screen-rig");
  if (rig) {
    rig.style.animation = "none";
    rig.style.opacity = "1";
    rig.style.transform = "translate(-50%, -50%) scale(1)";
  }
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

  await page.waitForFunction((slide) => {
    const win = document.getElementById("deck")?.contentWindow;
    const canvas = win?.document?.getElementById("c");
    const state = win?.deckGetState?.();
    if (!canvas || !canvas.width || !state || state.slide !== slide) return false;
    const g = canvas.getContext("2d");
    const pts = [[0.5, 0.45], [0.35, 0.4], [0.65, 0.55], [0.5, 0.7]];
    return pts.some(([fx, fy]) => {
      const p = g.getImageData(Math.floor(canvas.width * fx), Math.floor(canvas.height * fy), 1, 1).data;
      return p[0] > 170 && p[1] > 170 && p[2] > 170;
    });
  }, i, { timeout: 15000 });

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
