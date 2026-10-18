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
const SPEEDTEST_PATH = path.join(process.cwd(), "speedtest.py");
const NotDetect = "Not Detected";

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
    return `${(mbps / 1e3).toFixed(2)} Gbps (${mbps.toFixed(2)} Mbps)`;
  }
  return `${mbps.toFixed(2)} Mbps`;
}

function formatTime(seconds) {
  const numSeconds = Number(seconds);
  if (isNaN(numSeconds) || numSeconds <= 0) return "0 Detik";
  if (typeof runtime === "function") {
    try {
      return runtime(numSeconds);
    } catch {}
  }
  let d = Math.floor(numSeconds / (3600 * 24));
  let h = Math.floor(numSeconds % (3600 * 24) / 3600);
  let m = Math.floor(numSeconds % 3600 / 60);
  let s = Math.floor(numSeconds % 60);
  return [d ? `${d} Hari` : "", h ? `${h} Jam` : "", m ? `${m} Menit` : "", s ? `${s} Detik` : ""].filter(Boolean).join(" ") || "0 Detik";
}
async function ensureSpeedtestScript() {
  try {
    if (!fs.existsSync(SPEEDTEST_PATH)) {
      const res = await axios.get(SPEEDTEST_SCRIPT_URL, {
        responseType: "text",
        timeout: 3e4,
        maxRedirects: 5
      });
      if (res.status === 200 && res.data) {
        fs.writeFileSync(SPEEDTEST_PATH, res.data, {
          mode: 493
        });
      }
    }
  } catch (err) {
    console.warn("[Speedtest Script Download Warn]:", err?.message || err);
  }
}
async function runSpeedtest() {
  try {
    await ensureSpeedtestScript();
    if (!fs.existsSync(SPEEDTEST_PATH)) return null;
    const {
      stdout
    } = await execPromise(`python3 "${SPEEDTEST_PATH}" --share --json`, {
      timeout: 9e4
    });
    return JSON.parse(stdout);
  } catch (err) {
    console.warn("[Speedtest Execution Warn]:", err?.message || err);
    return null;
  }
}

function getFolderSize(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) return 0;
    const files = fs.readdirSync(folderPath);
    let total = 0;
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      try {
        const stat = fs.statSync(filePath);
        const size = stat.isDirectory() ? getFolderSize(filePath) : Number(stat.size);
        total += isNaN(size) ? 0 : size;
      } catch {}
    }
    return total;
  } catch {
    return 0;
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
      return {
        total: formatBytes(total),
        used: formatBytes(used),
        percent: total > 0 ? `${Math.round(used / total * 100)}%` : NotDetect
      };
    } else {
      const {
        stdout
      } = await execPromise("df -k / | tail -1");
      const parts = stdout.trim().split(/\s+/);
      const total = Number(parts[1]) * 1024;
      const used = Number(parts[2]) * 1024;
      const percent = parts[4] || NotDetect;
      return {
        total: formatBytes(total),
        used: formatBytes(used),
        percent: percent
      };
    }
  } catch {
    return {
      total: NotDetect,
      used: NotDetect,
      percent: NotDetect
    };
  }
}
async function fetchImageBuffer(urlList) {
  for (let url of urlList) {
    if (!url) continue;
    try {
      if (url.startsWith("http://")) {
        url = url.replace("http://", "https://");
      }
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 15e3,
        maxRedirects: 10,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      if (res.status === 200 && res.data) {
        return Buffer.from(res.data);
      }
    } catch {}
  }
  return null;
}
export default {
  name: "ping",
  aliases: ["speed", "p", "status", "botinfo", "system", "benchmark", "speedtest"],
  description: "Memeriksa kecepatan internet (speedtest), CPU Core List, RAM/RSS, Disk, dan status server.",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || "Wudysoft • System Monitor";
      const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const oldTime = performance.now();
      const [speedData, diskInfo] = await Promise.all([runSpeedtest(), getDiskUsage()]);
      const newTime = performance.now();
      const latency = Number(newTime - oldTime).toFixed(2);
      const memUsage = process.memoryUsage();
      const totalRam = Number(os.totalmem());
      const freeRam = Number(os.freemem());
      const usedRam = totalRam - freeRam;
      const ramPercent = totalRam > 0 ? `${Math.round(usedRam / totalRam * 100)}%` : NotDetect;
      const rss = formatBytes(memUsage.rss);
      const heapUsed = formatBytes(memUsage.heapUsed);
      const heapTotal = formatBytes(memUsage.heapTotal);
      const externalMem = formatBytes(memUsage.external);
      const rawCpus = os.cpus() || [];
      let totalCpuTimes = {
        user: 0,
        nice: 0,
        sys: 0,
        idle: 0,
        irq: 0
      };
      const coreList = rawCpus.map((cpu, idx) => {
        const cTotal = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        const cUsage = cTotal > 0 ? ((cTotal - cpu.times.idle) / cTotal * 100).toFixed(1) : "0.0";
        for (const [type, val] of Object.entries(cpu.times)) {
          totalCpuTimes[type] = (totalCpuTimes[type] || 0) + Number(val);
        }
        return {
          index: idx + 1,
          speed: `${Number(cpu.speed) || 0} MHz`,
          usage: `${cUsage}%`
        };
      });
      const overallCpuTime = Object.values(totalCpuTimes).reduce((a, b) => a + b, 0);
      const overallCpuUsage = overallCpuTime > 0 ? `${((overallCpuTime - totalCpuTimes.idle) / overallCpuTime * 100).toFixed(1)}%` : NotDetect;
      const loadAvg = os.loadavg().map(l => Number(l).toFixed(2)).join(", ");
      const authFolder = path.join(process.cwd(), "session");
      const folderSession = formatBytes(getFolderSize(authFolder));
      const credsPath = path.join(authFolder, "creds.json");
      const credsSession = fs.existsSync(credsPath) ? formatBytes(Number(fs.statSync(credsPath).size)) : NotDetect;
      const now = moment().tz("Asia/Jakarta");
      const times = now.locale("id").format("HH:mm:ss [WIB]");
      const botUptime = formatTime(process.uptime());
      const serverUptime = formatTime(os.uptime());
      const chats = typeof sock?.chats === "object" ? Object.keys(sock.chats) : [];
      const groupsIn = chats.filter(id => id.endsWith("@g.us"));
      const totalDbUsers = Object.keys(global.db?.user || {}).length;
      const totalDbGroups = Object.keys(global.db?.group || {}).length;
      let str = `–  *S Y S T E M  I N F O*\n\n`;
      str += `┌  ◦  *Bot Name* : ${botName}\n`;
      str += `│  ◦  *Latency* : ${latency} ms\n`;
      str += `│  ◦  *Bot Uptime* : ${botUptime}\n`;
      str += `│  ◦  *Server Uptime* : ${serverUptime}\n`;
      str += `│  ◦  *Platform* : ${os.platform()} (${os.arch()})\n`;
      str += `│  ◦  *OS Release* : ${os.type()} ${os.release()}\n`;
      str += `│  ◦  *Hostname* : ${os.hostname()}\n`;
      str += `│  ◦  *Node.js* : ${process.version} (V8: ${process.versions.v8 || "N/A"})\n`;
      str += `│  ◦  *Process PID* : ${process.pid}\n`;
      str += `└  ◦  *Time* : ${times}\n\n`;
      if (speedData) {
        const srv = speedData.server || {};
        const clt = speedData.client || {};
        const distKm = srv.d ? `${Number(srv.d).toFixed(1)} km` : "N/A";
        const pingMs = speedData.ping ? `${Number(speedData.ping).toFixed(2)} ms` : "N/A";
        const bytesRecv = speedData.bytes_received ? formatBytes(speedData.bytes_received) : "N/A";
        const bytesSent = speedData.bytes_sent ? formatBytes(speedData.bytes_sent) : "N/A";
        str += `–  *S P E E D T E S T  R E S U L T*\n\n`;
        str += `┌  ◦  *Download* : ${formatSpeed(speedData.download)}\n`;
        str += `│  ◦  *Upload* : ${formatSpeed(speedData.upload)}\n`;
        str += `│  ◦  *Latency (Ping)* : ${pingMs}\n`;
        str += `│  ◦  *Bytes Received* : ${bytesRecv}\n`;
        str += `│  ◦  *Bytes Sent* : ${bytesSent}\n`;
        str += `│\n├─ [ *Server Provider* ]\n`;
        str += `│  ◦  *Sponsor* : ${srv.sponsor || "Unknown"}\n`;
        str += `│  ◦  *Location* : ${srv.name || "Unknown"}, ${srv.country || ""}\n`;
        str += `│  ◦  *Distance* : ${distKm}\n`;
        str += `│\n├─ [ *Client Info* ]\n`;
        str += `│  ◦  *ISP* : ${clt.isp || "Unknown"}\n`;
        str += `│  ◦  *ISP Rating* : ⭐ ${clt.isprating || "N/A"}\n`;
        str += `└  ◦  *Client Region* : ${clt.country || "TW"} (IP: ${clt.ip || "Hidden"})\n\n`;
      }
      str += `–  *M E M O R Y  ( R A M )*\n\n`;
      str += `┌  ◦  *System RAM* : ${formatBytes(usedRam)} / ${formatBytes(totalRam)} (${ramPercent})\n`;
      str += `│  ◦  *Free RAM* : ${formatBytes(freeRam)}\n`;
      str += `│  ◦  *Process RSS* : ${rss}\n`;
      str += `│  ◦  *Heap Used* : ${heapUsed} / ${heapTotal}\n`;
      str += `└  ◦  *External* : ${externalMem}\n\n`;
      str += `–  *C P U  &  C O R E  L I S T*\n\n`;
      str += `┌  ◦  *Model* : ${rawCpus[0]?.model?.trim() || "Unknown CPU"}\n`;
      str += `│  ◦  *Total Cores* : ${rawCpus.length} Cores\n`;
      str += `│  ◦  *Overall Usage* : ${overallCpuUsage}\n`;
      str += `│  ◦  *Load Average* : ${loadAvg}\n`;
      str += `│\n├─ [ *Core Breakdown* ]\n`;
      coreList.forEach((c, index) => {
        const isLast = index === coreList.length - 1;
        const branch = isLast ? "└" : "│";
        str += `${branch}  ◦  *Core ${c.index}* : ${c.speed} • ${c.usage} usage\n`;
      });
      str += `\n`;
      str += `–  *S T O R A G E*\n\n`;
      str += `┌  ◦  *Disk Usage* : ${diskInfo.used} / ${diskInfo.total} (${diskInfo.percent})\n`;
      str += `│  ◦  *Session Dir* : ${folderSession}\n`;
      str += `└  ◦  *Creds File* : ${credsSession}\n\n`;
      str += `–  *D A T A B A S E  &  C H A T S*\n\n`;
      str += `┌  ◦  *Total Users DB* : ${totalDbUsers} User\n`;
      str += `│  ◦  *Total Groups DB* : ${totalDbGroups} Grup\n`;
      str += `│  ◦  *Chats Active* : ${chats.length} (Group: ${groupsIn.length} | Private: ${chats.length - groupsIn.length})\n`;
      str += `└  ◦  *Status* : Operational ✅\n\n`;
      str += `Ketik *${prefix}ping* untuk menguji ulang performa server.`;
      const actionRows = [{
        title: "🔄 Tes Ulang (Speedtest)",
        id: `${prefix}ping`,
        description: "Jalankan ulang speedtest & ukur latency"
      }, {
        title: "🏠 Menu Utama",
        id: `${prefix}menu`,
        description: "Buka daftar kategori perintah bot"
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH NAVIGASI",
          sections: [{
            title: `${botName} • BENCHMARK`,
            rows: actionRows
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Speedtest Lagi",
          id: `${prefix}ping`
        })
      }];
      const shareUrl = speedData?.share ? speedData.share.replace("http://", "https://") : null;
      if (shareUrl) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            title: "🌐 Bukti Speedtest (Ookla)",
            display_text: "🌐 Bukti Speedtest (Ookla)",
            url: shareUrl,
            merchant_url: shareUrl
          })
        });
      }
      const defaultMedia = global.bot?.media?.banner1 || global.bot?.media?.thumb || "https://files.catbox.moe/g2e6i5.jpg";
      const imageBuffer = await fetchImageBuffer([speedData?.share, defaultMedia]);
      const baseContextInfo = {
        mentionedJid: [ctx.sender],
        ...global.bot?.utils?.contextInfo || {
          forwardingScore: 999,
          isForwarded: true
        }
      };
      const footerText = `${botFooter} ✦ Latency: ${latency} ms`;
      const options = {
        image: imageBuffer || defaultMedia,
        title: `✦ ${botName} • Performance Monitor ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Performance Monitor`,
            button_title: "Lihat Opsi Navigasi"
          },
          limited_time_offer: {
            text: `🚀 SPEED: ${speedData ? formatSpeed(speedData.download) : latency + " ms"}`,
            url: channelUrl,
            copy_code: `${prefix}ping`,
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: baseContextInfo,
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(str, footerText, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: imageBuffer ? imageBuffer : {
            url: defaultMedia
          },
          caption: `${str}\n\n_${footerText}_`
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