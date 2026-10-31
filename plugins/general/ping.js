import os from "os";
import fs from "fs";
import path from "path";
import {
  exec
} from "child_process";
import util from "util";
import axios from "axios";
import {
  performance
} from "perf_hooks";
import moment from "moment-timezone";
import {
  runtime
} from "../../core/tools.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
const execPromise = util.promisify(exec);
const SPEEDTEST_SCRIPT_URL = "https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py";
const SPEEDTEST_PATH = path.join(process.cwd(), "temporary", "speedtest.py");
const CACHE_SPEEDTEST_FILE = path.join(process.cwd(), "temporary", "speedtest_cache.json");
if (!fs.existsSync(path.join(process.cwd(), "temporary"))) {
  fs.mkdirSync(path.join(process.cwd(), "temporary"), {
    recursive: true
  });
}
let cachedSpeedtestData = null;
let cachedSpeedtestImageB64 = null;
try {
  if (fs.existsSync(CACHE_SPEEDTEST_FILE)) {
    const raw = JSON.parse(fs.readFileSync(CACHE_SPEEDTEST_FILE, "utf-8"));
    cachedSpeedtestData = raw.data || null;
    cachedSpeedtestImageB64 = raw.imageB64 || null;
  }
} catch {}

function formatBytes(bytes) {
  const numBytes = Number(bytes);
  if (isNaN(numBytes) || numBytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(numBytes) / Math.log(k));
  return `${parseFloat((numBytes / Math.pow(k, i)).toFixed(2))} ${sizes[Math.min(i, sizes.length - 1)]}`;
}

function formatSpeed(bits) {
  const numBits = Number(bits);
  if (isNaN(numBits) || numBits <= 0) return "0 Mbps";
  const mbps = numBits / 1e6;
  if (mbps >= 1e3) {
    return `${(mbps / 1e3).toFixed(2)} Gbps`;
  }
  return `${mbps.toFixed(2)} Mbps`;
}

function formatTime(seconds) {
  const numSeconds = Number(seconds);
  if (isNaN(numSeconds) || numSeconds <= 0) return "0s";
  if (typeof runtime === "function") {
    try {
      return runtime(numSeconds);
    } catch {}
  }
  let d = Math.floor(numSeconds / (3600 * 24));
  let h = Math.floor(numSeconds % (3600 * 24) / 3600);
  let m = Math.floor(numSeconds % 3600 / 60);
  let s = Math.floor(numSeconds % 60);
  return [d ? `${d}d` : "", h ? `${h}h` : "", m ? `${m}m` : "", s ? `${s}s` : ""].filter(Boolean).join(" ") || "0s";
}
async function ensureSpeedtestScript() {
  if (fs.existsSync(SPEEDTEST_PATH)) return true;
  try {
    const res = await axios.get(SPEEDTEST_SCRIPT_URL, {
      responseType: "text",
      timeout: 2e4
    });
    if (res.status === 200 && res.data) {
      fs.writeFileSync(SPEEDTEST_PATH, res.data, {
        mode: 493
      });
      return true;
    }
  } catch (err) {
    console.warn("[Speedtest Script Download Error]:", err?.message || err);
  }
  return false;
}
async function runAutoSpeedtest() {
  const scriptReady = await ensureSpeedtestScript();
  if (!scriptReady) {
    return {
      data: cachedSpeedtestData,
      imageB64: cachedSpeedtestImageB64
    };
  }
  try {
    const {
      stdout
    } = await execPromise(`python3 "${SPEEDTEST_PATH}" --share --json`, {
      timeout: 8e4
    });
    const parsed = JSON.parse(stdout);
    let imageBase64 = null;
    if (parsed?.share) {
      const imgRes = await axios.get(parsed.share.replace("http://", "https://"), {
        responseType: "arraybuffer",
        timeout: 1e4
      }).catch(() => null);
      if (imgRes?.data) {
        imageBase64 = `data:image/png;base64,${Buffer.from(imgRes.data).toString("base64")}`;
      }
    }
    cachedSpeedtestData = parsed;
    cachedSpeedtestImageB64 = imageBase64;
    try {
      fs.writeFileSync(CACHE_SPEEDTEST_FILE, JSON.stringify({
        data: cachedSpeedtestData,
        imageB64: cachedSpeedtestImageB64,
        updatedAt: Date.now()
      }));
    } catch {}
    return {
      data: cachedSpeedtestData,
      imageB64: cachedSpeedtestImageB64
    };
  } catch (err) {
    console.warn("[Speedtest Auto Execution Warning]:", err?.message || err);
    return {
      data: cachedSpeedtestData,
      imageB64: cachedSpeedtestImageB64
    };
  }
}
async function getDiskUsage() {
  try {
    if (os.platform() === "win32") {
      const {
        stdout
      } = await execPromise("wmic logicaldisk get size,freespace,caption");
      const lines = stdout.trim().split("\n").slice(1);
      let total = 0,
        free = 0;
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          free += parseInt(parts[1], 10) || 0;
          total += parseInt(parts[2], 10) || 0;
        }
      }
      const used = total - free;
      const numPercent = total > 0 ? Math.round(used / total * 100) : 0;
      return {
        total: formatBytes(total),
        used: formatBytes(used),
        percent: `${numPercent}%`,
        numPercent: numPercent
      };
    } else {
      const {
        stdout
      } = await execPromise("df -k / | tail -1");
      const parts = stdout.trim().split(/\s+/);
      const total = Number(parts[1]) * 1024;
      const used = Number(parts[2]) * 1024;
      const rawPct = parts[4] || "0%";
      const numPercent = parseInt(rawPct, 10) || 0;
      return {
        total: formatBytes(total),
        used: formatBytes(used),
        percent: rawPct,
        numPercent: numPercent
      };
    }
  } catch {
    return {
      total: "N/A",
      used: "N/A",
      percent: "0%",
      numPercent: 0
    };
  }
}
export default {
  name: "ping",
  aliases: ["speed", "p", "status", "botinfo", "system", "benchmark", "speedtest", "runtime", "uptime", "rt"],
  description: "Live Realtime Server Benchmark with Auto-Running Speedtest & Modern Vector UI",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || "Wudysoft • System Monitor";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const oldTime = performance.now();
      const [{
        data: speedData,
        imageB64: speedImgB64
      }, diskInfo] = await Promise.all([runAutoSpeedtest(), getDiskUsage()]);
      const newTime = performance.now();
      const latency = Number(newTime - oldTime).toFixed(2);
      const memUsage = process.memoryUsage();
      const totalRam = Number(os.totalmem());
      const freeRam = Number(os.freemem());
      const usedRam = totalRam - freeRam;
      const ramPercentNum = totalRam > 0 ? Math.round(usedRam / totalRam * 100) : 0;
      const rss = formatBytes(memUsage.rss);
      const heapUsedNum = Number(memUsage.heapUsed) / (1024 * 1024);
      const heapTotalNum = Number(memUsage.heapTotal) / (1024 * 1024);
      const heapPercent = heapTotalNum > 0 ? Math.round(heapUsedNum / heapTotalNum * 100) : 0;
      const rawCpus = os.cpus() || [];
      let totalCpuTimes = {
        user: 0,
        nice: 0,
        sys: 0,
        idle: 0,
        irq: 0
      };
      rawCpus.forEach(cpu => {
        for (const [type, val] of Object.entries(cpu.times)) {
          totalCpuTimes[type] = (totalCpuTimes[type] || 0) + Number(val);
        }
      });
      const overallCpuTime = Object.values(totalCpuTimes).reduce((a, b) => a + b, 0);
      const cpuUsageNum = overallCpuTime > 0 ? Math.round((overallCpuTime - totalCpuTimes.idle) / overallCpuTime * 100) : 0;
      const now = moment().tz("Asia/Jakarta");
      const times = now.locale("id").format("HH:mm:ss [WIB]");
      const serverUptime = formatTime(os.uptime());
      const totalDbUsers = Object.keys(global.db?.user || {}).length;
      const dlSpeed = speedData ? formatSpeed(speedData.download) : "0.00 Mbps";
      const upSpeed = speedData ? formatSpeed(speedData.upload) : "0.00 Mbps";
      const stPing = speedData?.ping ? `${Number(speedData.ping).toFixed(1)} ms` : `${latency} ms`;
      const richHtml = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    html, body {
      background: transparent !important;
      padding: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .panel {
      width: 100%;
      max-width: 440px;
      background: rgba(13, 17, 23, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 18px;
      color: #e6edf3;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
      position: relative;
      overflow: hidden;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
    }
    .icon {
      width: 16px;
      height: 16px;
      vertical-align: middle;
      display: inline-block;
      fill: currentColor;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
    }
    .brand-logo svg {
      width: 20px;
      height: 20px;
    }
    .brand-title {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      line-height: 1.2;
    }
    .brand-sub {
      font-size: 11px;
      color: #8b949e;
    }
    .live-beacon {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      background: rgba(35, 134, 54, 0.15);
      border: 1px solid rgba(46, 160, 67, 0.35);
      font-size: 10.5px;
      font-weight: 600;
      color: #3fb950;
      letter-spacing: 0.5px;
    }
    .beacon-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #3fb950;
      box-shadow: 0 0 10px #3fb950;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.35; transform: scale(0.85); }
    }
    ${speedImgB64 ? `
    .speed-img-wrap {
      width: 100%;
      margin-bottom: 16px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: #010409;
    }
    .speed-img-wrap img {
      width: 100%;
      display: block;
      height: auto;
      object-fit: contain;
    }
    ` : ""}
    .metric-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 16px;
    }
    .metric-card {
      background: rgba(22, 27, 34, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .metric-caption {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #8b949e;
      margin-bottom: 4px;
    }
    .metric-val {
      font-size: 19px;
      font-weight: 700;
      color: #38bdf8;
    }
    .metric-val.green { color: #4ade80; }

    /* ─── PROGRESS BAR 10PX (BESAR & JELAS) ─── */
    .bars-container {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 16px;
    }
    .bar-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .bar-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11.5px;
      color: #8b949e;
    }
    .bar-label span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .bar-label b {
      color: #f0f6fc;
      font-weight: 600;
    }
    .bar-rail {
      width: 100%;
      height: 10px; /* Lebar dan tebal 10px */
      background: #21262d;
      border-radius: 9999px;
      overflow: hidden;
      position: relative;
    }
    .bar-fill {
      height: 100%;
      border-radius: 9999px;
      position: relative;
      transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .bar-fill::after {
      content: "";
      position: absolute;
      top: 0; left: 0; bottom: 0; right: 0;
      background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0) 100%);
      animation: shimmer 2.5s infinite;
    }
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .fill-cpu { background: linear-gradient(90deg, #2563eb, #38bdf8); width: ${Math.min(cpuUsageNum, 100)}%; }
    .fill-ram { background: linear-gradient(90deg, #d97706, #fbbf24); width: ${Math.min(ramPercentNum, 100)}%; }
    .fill-disk { background: linear-gradient(90deg, #059669, #34d399); width: ${Math.min(diskInfo.numPercent || 0, 100)}%; }

    .table-details {
      background: rgba(22, 27, 34, 0.7);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      padding: 12px 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 14px;
      margin-bottom: 14px;
    }
    .cell {
      display: flex;
      flex-direction: column;
      font-size: 11px;
      color: #8b949e;
    }
    .cell-val {
      font-size: 11.5px;
      color: #e6edf3;
      font-weight: 500;
      margin-top: 2px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 11px;
      color: #8b949e;
    }
    .footer-highlight {
      color: #38bdf8;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  </style>
</head>
<body>
  <div class="panel">
    <div class="header">
      <div class="brand-wrap">
        <div class="brand-logo">
          <svg viewBox="0 0 24 24"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm3 2v8h10V8H7zm2 2h6v4H9v-4z"/></svg>
        </div>
        <div>
          <div class="brand-title">${botName}</div>
          <div class="brand-sub">Realtime Engine Benchmark</div>
        </div>
      </div>
      <div class="live-beacon">
        <span class="beacon-dot"></span>
        <span>LIVE PULSE</span>
      </div>
    </div>

    ${speedImgB64 ? `
    <div class="speed-img-wrap">
      <img src="${speedImgB64}" alt="Speedtest Result" />
    </div>
    ` : ""}

    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-caption">
          <svg class="icon" viewBox="0 0 24 24"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm9 4H3v-2h18v2z"/></svg>
          Download Rate
        </div>
        <div class="metric-val mono">${dlSpeed}</div>
      </div>
      <div class="metric-card">
        <div class="metric-caption">
          <svg class="icon" viewBox="0 0 24 24"><path d="M12 4l5 5h-3v7h-4V9H7l5-5zm9 16H3v-2h18v2z"/></svg>
          Upload Rate
        </div>
        <div class="metric-val green mono">${upSpeed}</div>
      </div>
    </div>

    <div class="bars-container">
      <div class="bar-group">
        <div class="bar-label">
          <span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M7 2h2v3h6V2h2v3h1a2 2 0 0 1 2 2v1h3v2h-3v6h3v2h-3v1a2 2 0 0 1-2 2h-1v3h-2v-3H9v3H7v-3H6a2 2 0 0 1-2-2v-1H1v-2h3V9H1V7h3V6a2 2 0 0 1 2-2h1V2zm0 5v10h10V7H7zm2 2h6v6H9V9z"/></svg>
            CPU Processing Load
          </span>
          <b class="mono" id="val-cpu">${cpuUsageNum}%</b>
        </div>
        <div class="bar-rail">
          <div class="bar-fill fill-cpu" id="bar-cpu"></div>
        </div>
      </div>

      <div class="bar-group">
        <div class="bar-label">
          <span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7zm3 2v6h2V9H5zm4 0v6h2V9H9zm4 0v6h2V9h-2zm4 0v6h2V9h-2z"/></svg>
            System Physical RAM
          </span>
          <b class="mono" id="val-ram">${ramPercentNum}% (${formatBytes(usedRam)})</b>
        </div>
        <div class="bar-rail">
          <div class="bar-fill fill-ram" id="bar-ram"></div>
        </div>
      </div>

      <div class="bar-group">
        <div class="bar-label">
          <span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm3 3v8h12V8H6zm6 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>
            Root Disk Storage
          </span>
          <b class="mono">${diskInfo.percent} (${diskInfo.used})</b>
        </div>
        <div class="bar-rail">
          <div class="bar-fill fill-disk"></div>
        </div>
      </div>
    </div>

    <div class="table-details">
      <div class="cell">
        <span>Latency / Response</span>
        <span class="cell-val mono">
          <svg class="icon" viewBox="0 0 24 24"><path d="M12 4a9 9 0 0 0-9 9c0 2.25.82 4.31 2.19 5.88l1.45-1.45A6.96 6.96 0 0 1 5 13a7 7 0 1 1 14 0c0 1.62-.55 3.12-1.48 4.31l1.45 1.45A8.96 8.96 0 0 0 21 13a9 9 0 0 0-9-9zm-1 5v4.41l3.3 1.9.75-1.3-2.55-1.47V9h-1.5z"/></svg>
          ${latency} ms <span style="color:#7d8590">(${stPing})</span>
        </span>
      </div>
      <div class="cell">
        <span>Operating System</span>
        <span class="cell-val mono">${os.platform()} (${os.arch()})</span>
      </div>
      <div class="cell">
        <span>Node Environment</span>
        <span class="cell-val mono">${process.version}</span>
      </div>
      <div class="cell">
        <span>Host Runtime</span>
        <span class="cell-val mono">${serverUptime}</span>
      </div>
      <div class="cell">
        <span>Process RSS Memory</span>
        <span class="cell-val mono">${rss}</span>
      </div>
      <div class="cell">
        <span>Active Userbase</span>
        <span class="cell-val mono">${totalDbUsers} Registered</span>
      </div>
    </div>

    <div class="footer">
      <div>
        <span class="footer-highlight mono">
          <svg class="icon" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 11h4v-2h-3V7h-2v6z"/></svg>
          <span id="live-time">${times}</span>
        </span>
      </div>
      <div><span>${botFooter}</span></div>
    </div>
  </div>

  <script>
    (function() {
      let baseCpu = ${cpuUsageNum};
      let baseRam = ${ramPercentNum};

      setInterval(() => {
        let cpuFluct = (baseCpu + (Math.random() * 3.6 - 1.8)).toFixed(1);
        cpuFluct = Math.min(Math.max(cpuFluct, 1), 99);

        let ramFluct = Math.min(Math.max(Math.round(baseRam + (Math.random() * 2 - 1)), 1), 99);

        let elCpu = document.getElementById("val-cpu");
        let elBarCpu = document.getElementById("bar-cpu");
        if (elCpu) elCpu.innerText = cpuFluct + "%";
        if (elBarCpu) elBarCpu.style.width = cpuFluct + "%";

        let elRam = document.getElementById("val-ram");
        let elBarRam = document.getElementById("bar-ram");
        if (elRam) elRam.innerText = ramFluct + "%";
        if (elBarRam) elBarRam.style.width = ramFluct + "%";

        let elTime = document.getElementById("live-time");
        if (elTime) {
          const d = new Date();
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          const ss = String(d.getSeconds()).padStart(2, '0');
          elTime.innerText = hh + ":" + mm + ":" + ss + " WIB";
        }
      }, 1000);
    })();
  </script>
</body>
</html>
`.trim();
      const targetJid = ctx.id;
      if (typeof sock.airich === "function") {
        return await sock.airich().setTitle(`⚡ ${botName} Performance Benchmark`).addHtml(richHtml).send(targetJid);
      } else if (typeof ctx.sendRich === "function") {
        return await ctx.sendRich({
          title: `⚡ ${botName} Performance Benchmark`,
          html: richHtml,
          quoted: quotedMsg
        });
      }
      const fallbackText = `–  *S Y S T E M  I N F O*

┌  ◦  *Bot Name* : ${botName}
│  ◦  *Latency* : ${latency} ms
│  ◦  *Platform* : ${os.platform()} (${os.arch()})
│  ◦  *Node.js* : ${process.version}
│  ◦  *CPU Load* : ${cpuUsageNum}%
│  ◦  *RAM* : ${formatBytes(usedRam)} / ${formatBytes(totalRam)} (${ramPercentNum}%)
└  ◦  *Time* : ${times}

–  ${botFooter}`;
      const buttons = [{
        name: "",
        params: {}
      }, {
        name: "quick_reply",
        params: {
          display_text: "⚡ Tes Ulang",
          id: `${prefix}ping`
        }
      }, {
        name: "quick_reply",
        params: {
          display_text: "📜 Menu Utama",
          id: `${prefix}menu`
        }
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(fallbackText, botFooter, buttons, {
          title: `✦ ${botName} • Performance Monitor ✦`,
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: fallbackText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[PING ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(global.bot?.msg?.error || `❌ Terjadi kesalahan pada sistem: ${e.message}`);
    }
  }
};