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
  if (!bytes || isNaN(bytes) || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatSpeed(bits) {
  if (!bits || isNaN(bits)) return "0 Mbps";
  return `${(bits / 1e6).toFixed(2)} Mbps`;
}

function formatTime(seconds) {
  if (typeof runtime === "function") return runtime(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}
async function ensureSpeedtestScript() {
  if (!fs.existsSync(SPEEDTEST_PATH)) {
    const res = await axios.get(SPEEDTEST_SCRIPT_URL, {
      responseType: "text",
      timeout: 3e4
    });
    fs.writeFileSync(SPEEDTEST_PATH, res.data, {
      mode: 493
    });
  }
}
async function runSpeedtest() {
  await ensureSpeedtestScript();
  const {
    stdout
  } = await execPromise(`python3 "${SPEEDTEST_PATH}" --share --json`, {
    timeout: 9e4
  });
  return JSON.parse(stdout);
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
        total += stat.isDirectory() ? getFolderSize(filePath) : stat.size;
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
      let total = 0;
      let free = 0;
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
      const total = parseInt(parts[1], 10) * 1024;
      const used = parseInt(parts[2], 10) * 1024;
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
export default {
  name: "ping",
  aliases: ["speed", "p", "status", "botinfo", "system", "benchmark", "speedtest"],
  description: "Memeriksa kecepatan internet (speedtest), CPU Core List, RAM/RSS, Disk, dan status server.",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • System Monitor`;
      const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const oldTime = performance.now();
      await ctx.react("⚡");
      const [speedData, diskInfo, ipData] = await Promise.all([runSpeedtest().catch(e => {
        console.warn("[Speedtest Timeout/Skip]:", e?.message || e);
        return null;
      }), getDiskUsage(), axios.get("https://api.myip.com", {
        timeout: 4e3
      }).then(r => r.data).catch(() => ({
        ip: NotDetect,
        country: NotDetect,
        cc: NotDetect
      }))]);
      const newTime = performance.now();
      const latency = (newTime - oldTime).toFixed(2);
      const memUsage = process.memoryUsage();
      const totalRam = os.totalmem();
      const freeRam = os.freemem();
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
          totalCpuTimes[type] = (totalCpuTimes[type] || 0) + val;
        }
        return {
          index: idx + 1,
          speed: `${cpu.speed || 0} MHz`,
          usage: `${cUsage}%`
        };
      });
      const overallCpuTime = Object.values(totalCpuTimes).reduce((a, b) => a + b, 0);
      const overallCpuUsage = overallCpuTime > 0 ? `${((overallCpuTime - totalCpuTimes.idle) / overallCpuTime * 100).toFixed(1)}%` : NotDetect;
      const loadAvg = os.loadavg().map(l => l.toFixed(2)).join(", ");
      const authFolder = path.join(process.cwd(), "session");
      const folderSession = formatBytes(getFolderSize(authFolder));
      const credsPath = path.join(authFolder, "creds.json");
      const credsSession = fs.existsSync(credsPath) ? formatBytes(fs.statSync(credsPath).size) : NotDetect;
      const now = moment().tz("Asia/Jakarta");
      const times = now.locale("id").format("HH:mm:ss [WIB]");
      const botUptime = formatTime(process.uptime());
      const serverUptime = formatTime(os.uptime());
      const chats = typeof sock?.chats === "object" ? Object.keys(sock.chats) : [];
      const groupsIn = chats.filter(id => id.endsWith("@g.us"));
      const totalDbUsers = Object.keys(global.db?.user || {}).length;
      const totalDbGroups = Object.keys(global.db?.group || {}).length;
      let str = `–  *S Y S T E M  I N F O*

┌  ◦  *Bot Name* : ${botName}
│  ◦  *Latency* : ${latency} ms
│  ◦  *Bot Uptime* : ${botUptime}
│  ◦  *Server Uptime* : ${serverUptime}
│  ◦  *Platform* : ${os.platform()} (${os.arch()})
│  ◦  *OS Release* : ${os.type()} ${os.release()}
│  ◦  *Hostname* : ${os.hostname()}
│  ◦  *Node.js* : ${process.version} (V8: ${process.versions.v8 || "N/A"})
│  ◦  *Process PID* : ${process.pid}
└  ◦  *Time* : ${times}\n\n`;
      str += `–  *M E M O R Y  ( R A M )*

┌  ◦  *System RAM* : ${formatBytes(usedRam)} / ${formatBytes(totalRam)} (${ramPercent})
│  ◦  *Free RAM* : ${formatBytes(freeRam)}
│  ◦  *Process RSS* : ${rss}
│  ◦  *Heap Used* : ${heapUsed} / ${heapTotal}
└  ◦  *External* : ${externalMem}\n\n`;
      str += `–  *C P U  &  C O R E  L I S T*

┌  ◦  *Model* : ${rawCpus[0]?.model?.trim() || "Unknown CPU"}
│  ◦  *Total Cores* : ${rawCpus.length} Cores
│  ◦  *Overall Usage* : ${overallCpuUsage}
│  ◦  *Load Average* : ${loadAvg}
│
├─ [ *Core Breakdown* ]\n`;
      coreList.forEach((c, index) => {
        const isLast = index === coreList.length - 1;
        const branch = isLast ? "└" : "│";
        str += `${branch}  ◦  *Core ${c.index}* : ${c.speed} • ${c.usage} usage\n`;
      });
      str += "\n";
      str += `–  *S T O R A G E*

┌  ◦  *Disk Usage* : ${diskInfo.used} / ${diskInfo.total} (${diskInfo.percent})
│  ◦  *Session Dir* : ${folderSession}
└  ◦  *Creds File* : ${credsSession}\n\n`;
      if (ipData?.ip !== NotDetect) {
        str += `–  *N E T W O R K*

┌  ◦  *Public IP* : ${ipData.ip}
└  ◦  *Location* : ${ipData.country || "Unknown"} (${ipData.cc || "ID"})\n\n`;
      }
      if (speedData) {
        str += `–  *S P E E D T E S T*

┌  ◦  *Download* : ${formatSpeed(speedData.download)}
│  ◦  *Upload* : ${formatSpeed(speedData.upload)}
│  ◦  *Ping* : ${speedData.ping || 0} ms
│  ◦  *ISP* : ${speedData.client?.isp || "Unknown"}
└  ◦  *Server* : ${speedData.server?.name || "Unknown"} (${speedData.server?.country || ""})\n\n`;
      }
      str += `–  *D A T A B A S E  &  C H A T S*

┌  ◦  *Total Users DB* : ${totalDbUsers} User
│  ◦  *Total Groups DB* : ${totalDbGroups} Grup
│  ◦  *Chats Active* : ${chats.length} (Group: ${groupsIn.length} | Private: ${chats.length - groupsIn.length})
└  ◦  *Status* : Operational ✅\n\n`;
      str += `Ketik *${prefix}ping* untuk menguji ulang performa server.`;
      const actionRows = [{
        title: "🔄 Tes Ulang (Speedtest)",
        id: `${prefix}ping`,
        description: "Ukur kembali kecepatan internet dan respon server"
      }, {
        title: "🏠 Menu Utama",
        id: `${prefix}menu`,
        description: "Buka daftar kategori perintah bot"
      }, {
        title: "📜 Semua Fitur",
        id: `${prefix}allmenu`,
        description: "Buka seluruh katalog perintah bot"
      }];
      const sections = [{
        title: "⚡ NAVIGASI CEPAT",
        rows: actionRows
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 OPSI BENCHMARK & MENU",
          sections: sections
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Speedtest Lagi",
          id: `${prefix}ping`
        })
      }];
      if (speedData?.share) {
        buttons.push({
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "🌐 Hasil Speedtest",
            url: speedData.share,
            merchant_url: speedData.share
          })
        });
      }
      const bannerMedia = speedData?.share || global.bot?.media?.banner1 || global.bot?.media?.thumb || "https://files.catbox.moe/g2e6i5.jpg";
      const footerText = `${botFooter} ✦ Latency: ${latency} ms`;
      const options = {
        image: bannerMedia,
        title: `✦ ${botName} • Performance Monitor ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Performance Monitor`,
            button_title: "Lihat Detail Menu"
          },
          limited_time_offer: {
            text: `🚀 SPEED: ${speedData ? formatSpeed(speedData.download) : latency + " ms"}`,
            url: channelUrl,
            copy_code: `${prefix}ping`,
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(str, footerText, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: bannerMedia
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
      ctx.reply(global.bot?.msg?.error || `❌ Terjadi kegagalan benchmark: ${e.message}`);
    }
  }
};