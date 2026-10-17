#!/usr/bin/env node
/**
 * Static file server + command/state relay for admin ↔ stage.
 * Usage: node server.mjs
 * Then open http://localhost:8765/admin.html and http://localhost:8765/index.html
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8765);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".zip": "application/zip",
};

/** @type {Set<http.ServerResponse>} */
const clients = new Set();
let lastState = null;

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(event, data, except) {
  for (const res of clients) {
    if (res === except) continue;
    try { sendSSE(res, event, data); } catch { /* drop */ }
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : null);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(ROOT, clean === "/" || clean === "" ? "index.html" : clean);
  if (!full.startsWith(ROOT)) return null;
  return full;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // SSE stream — admin and stage both subscribe
  if (pathname === "/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write(": connected\n\n");
    clients.add(res);
    if (lastState) sendSSE(res, "state", lastState);
    sendSSE(res, "hello", { ok: true, clients: clients.size });
    req.on("close", () => clients.delete(res));
    const ping = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
    }, 15000);
    req.on("close", () => clearInterval(ping));
    return;
  }

  // Admin / anyone posts a command
  if (pathname === "/cmd" && req.method === "POST") {
    try {
      const msg = await readBody(req);
      if (!msg || typeof msg !== "object") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "bad body" }));
        return;
      }
      const payload = Object.assign({ type: "cmd", from: "admin" }, msg, { type: "cmd" });
      broadcast("cmd", payload);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, clients: clients.size }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return;
  }

  // Stage publishes state
  if (pathname === "/state" && req.method === "POST") {
    try {
      const msg = await readBody(req);
      lastState = msg;
      broadcast("state", msg);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
    return;
  }

  if (pathname === "/state" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(lastState || { ok: false }));
    return;
  }

  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, clients: clients.size, port: PORT }));
    return;
  }

  // Static files
  let filePath = safePath(pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[led-backdrop] http://localhost:${PORT}/admin.html`);
  console.log(`[led-backdrop] http://localhost:${PORT}/index.html`);
  console.log(`[led-backdrop] health http://localhost:${PORT}/health`);
});

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
