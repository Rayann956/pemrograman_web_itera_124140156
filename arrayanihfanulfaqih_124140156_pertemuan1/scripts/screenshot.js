/* Screenshot Mini POS via Chrome headless + CDP (tanpa dependensi).
   Membuat 3 screenshot ke folder screenshots/.
   Cara pakai: node scripts/screenshot.js */
"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "screenshots");
const PORT = 9333;
const FILE_URL =
  "file:///" + path.join(ROOT, "index.html").replace(/\\/g, "/");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- HTTP ke endpoint JSON CDP ---------- */
function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

/* ---------- Klien WebSocket CDP minimal ---------- */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res, { once: true });
      ws.addEventListener("error", rej, { once: true });
    });
    return new CDP(ws);
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) =>
      this.pending.set(id, { resolve, reject })
    );
  }
  async waitEvent(method, timeoutMs = 10000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      const i = this.events.findIndex((m) => m.method === method);
      if (i >= 0) return this.events.splice(i, 1)[0];
      await sleep(50);
    }
    throw new Error(`Timeout menunggu event ${method}`);
  }
  close() { try { this.ws.close(); } catch (_) {} }
}

/* ---------- Screenshot viewport penuh halaman ---------- */
async function capture(cdp, file, fullWidth = true) {
  const metrics = await cdp.send("Page.getLayoutMetrics");
  const cw = Math.ceil(metrics.cssContentSize.width);
  const ch = Math.ceil(metrics.cssContentSize.height);
  const width = fullWidth ? cw : 1280;
  const height = fullWidth ? Math.min(ch, 2400) : 800;

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 2, mobile: false,
  });
  await sleep(300);
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png", captureBeyondViewport: true,
  });
  fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
  console.log("OK :", file);
}

/* ---------- Utama ---------- */
async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=" + path.join(process.env.TEMP || ".", "cdp-mini-pos"),
    "--no-first-run", "--no-default-browser-check",
    "--disable-gpu", "--window-size=1400,900",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    // Tunggu devtools siap
    let targets = null;
    for (let i = 0; i < 50; i++) {
      try {
        const list = await getJSON(`http://127.0.0.1:${PORT}/json/list`);
        targets = list.filter((t) => t.type === "page");
        if (targets.length) break;
      } catch (_) {}
      await sleep(200);
    }
    if (!targets || !targets.length) throw new Error("Chrome target tidak ditemukan");

    const cdp = await CDP.connect(targets[0].webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280, height: 900, deviceScaleFactor: 2, mobile: false,
    });

    const nav = cdp.waitEvent("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: FILE_URL });
    await nav;
    await sleep(500);

    const evaljs = async (expr) => {
      const r = await cdp.send("Runtime.evaluate", {
        expression: expr, returnByValue: true, awaitPromise: true,
      });
      if (r.exceptionDetails) {
        throw new Error("Eval error: " + JSON.stringify(r.exceptionDetails.exception));
      }
      return r.result.value;
    };

    /* ---- Screenshot 1: form utama (kosong) ---- */
    await capture(cdp, path.join(OUT, "1-form-utama.png"), false);

    /* ---- Screenshot 2: validasi error ---- */
    // Kosongkan localStorage agar keadaan bersih
    await evaljs("localStorage.clear()");
    await evaljs(`
      document.getElementById('namaBarang').value = 'Ai';
      document.getElementById('hargaSatuan').value = '300';
      document.getElementById('qty').value = '0';
      document.getElementById('formBarang').requestSubmit();
    `);
    await sleep(300);
    await capture(cdp, path.join(OUT, "2-validasi-error.png"), false);

    /* ---- Screenshot 3: keranjang terisi + kalkulator ---- */
    await evaljs(`
      localStorage.clear();
      // Input via form agar alur sama seperti pemakaian nyata
      const tambah = (nama, harga, qty) => {
        document.getElementById('namaBarang').value = nama;
        document.getElementById('hargaSatuan').value = String(harga);
        document.getElementById('qty').value = String(qty);
        document.getElementById('formBarang').requestSubmit();
      };
      tambah('Nasi Ayam Geprek', 12000, 2);
      tambah('Es Teh Manis', 4000, 3);
      tambah('Air Mineral 600ml', 4000, 1);
      // Promo diterapkan
      document.getElementById('kodePromo').value = 'HEMAT10';
      document.getElementById('btnPromo').click();
      // Uang bayar cukup -> kembalian muncul
      document.getElementById('uangBayar').value = '50000';
      document.getElementById('uangBayar').dispatchEvent(new Event('input'));
    `);
    await sleep(300);
    // Sanity check isi keranjang
    const info = await evaljs(
      "({baris: document.querySelectorAll('#isiTabel tr').length, total: document.getElementById('totalBelanja').textContent})"
    );
    console.log("Cek keranjang:", JSON.stringify(info));
    await capture(cdp, path.join(OUT, "3-kalkulator-tabel.png"), true);

    cdp.close();
  } finally {
    chrome.kill();
  }
}

main().then(
  () => process.exit(0),
  (err) => { console.error("GAGAL:", err.message); process.exit(1); }
);
