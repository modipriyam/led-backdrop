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

await page.goto(`${BASE}/index.html`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1800); // fonts + open animations

const count = await page.evaluate(() => {
  const frame = document.getElementById("deck");
  return frame?.contentWindow?.deckSlideCount?.() ?? 7;
});

console.log(`Capturing ${count} slides at ${W}×${H}…`);

for (let i = 0; i < count; i++) {
  await page.evaluate((slide) => {
    const frame = document.getElementById("deck");
    const win = frame?.contentWindow;
    if (win?.deckGoTo) win.deckGoTo(slide);
  }, i);

  // Let highlight / chart / book settle; freeze ambient-looking frame
  await page.waitForTimeout(i === 0 ? 1600 : 700);

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
