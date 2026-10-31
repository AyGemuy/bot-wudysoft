import readline from "readline";
import pino from "pino";
import qrcode from "qrcode-terminal";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import JSZip from "jszip";
import {
  makeWASocket,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  proto,
  initAuthCreds,
  BufferJSON,
  jidNormalizedUser,
  extractMessageContent,
  isJidBroadcast,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import {
  Boom
} from "@hapi/boom";
import util from "util";
import chalk from "chalk";
import "./core/config.js";
import {
  SerializeMessage,
  decodeJid,
  extractNum,
  resolveLidToJid,
  resolveLidProactively,
  copyNForward,
  unwrapMessage,
  safeSendMessage,
  applyButtonsToBuilder,
  Button
} from "./core/serialize.js";
import {
  CommandLoader
} from "./core/loader.js";
import {
  UpsertMsgHandle
} from "./core/handler.js";
import {
  initAllJadiBots,
  flushJadibotGroupCache
} from "./core/jadibot.js";
import db from "./data/db.js";
const _SUPPRESS_LOG_PREFIXES = ["Closing session", "Closing open session in favor of incoming prekey bundle", "Failed to decrypt message with any known session", "Session error:", "Bad MAC", "[LID] ", "Decrypted message with closed session"];
const _matchesSuppress = s => _SUPPRESS_LOG_PREFIXES.some(p => s.startsWith(p));
const _nativeLog = console.log;
console.log = (...a) => {
  if (typeof a[0] === "string" && _matchesSuppress(a[0])) return;
  _nativeLog(...a);
};
const _nativeWarn = console.warn;
console.warn = (...a) => {
  if (typeof a[0] === "string" && _matchesSuppress(a[0])) return;
  _nativeWarn(...a);
};
const _nativeError = console.error;
console.error = (...a) => {
  if (typeof a[0] === "string" && _matchesSuppress(a[0])) return;
  _nativeError(...a);
};
const GROUP_NOTIF_MAX = 5;
global.msgStore = global.msgStore || new Map();
global.avatarCache = global.avatarCache || new Map();
global.AVATAR_CACHE_TTL = 30 * 60 * 1e3;
global.lidPhoneCache = global.lidPhoneCache || new Map();
global.phoneLidCache = global.phoneLidCache || new Map();
global.groupCache = global.groupCache || new Map();
const GROUP_CACHE_FILE = path.join(process.cwd(), "data", "group-cache.json");
const GROUP_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;

function loadGroupCacheFromDisk() {
  try {
    if (!fs.existsSync(GROUP_CACHE_FILE)) return;
    const arr = JSON.parse(fs.readFileSync(GROUP_CACHE_FILE, "utf-8"));
    if (!Array.isArray(arr)) return;
    const now = Date.now();
    let loaded = 0;
    for (const item of arr) {
      if (item?.jid && item?.data && now - (item.time || 0) < GROUP_CACHE_TTL_MS) {
        global.groupCache.set(item.jid, {
          data: item.data,
          time: item.time || now
        });
        loaded++;
      }
    }
    if (loaded > 0) {
      console.log(chalk.gray(`[ CACHE ]`) + chalk.cyan(` Pre-loaded ${loaded} grup dari disk ke memori.`));
    }
  } catch (_) {}
}
let _groupCacheSaveTimer = null;

function saveGroupCacheToDisk() {
  if (_groupCacheSaveTimer) return;
  _groupCacheSaveTimer = setTimeout(() => {
    _groupCacheSaveTimer = null;
    flushGroupCacheToDisk();
  }, 2e3);
}

function flushGroupCacheToDisk() {
  try {
    const dir = path.dirname(GROUP_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
      recursive: true
    });
    const arr = [];
    for (const [jid, entry] of global.groupCache.entries()) {
      arr.push({
        jid: jid,
        data: entry.data,
        time: entry.time
      });
    }
    fs.writeFileSync(GROUP_CACHE_FILE, JSON.stringify(arr));
  } catch (_) {}
}
global._presenceMap = global._presenceMap || new Map();
global.botStartTime = Date.now();
global.botJidPool = global.botJidPool || new Set();
global.botEventLocks = global.botEventLocks || new Set();
global.authKeysStore = global.authKeysStore || {};
global._toxicLastActivity = Date.now();
let currentSock = null;
const withTimeout = (promise, ms = 2500) => {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise.catch(() => null), timeout]).finally(() => clearTimeout(timer));
};

function cleanupSessionFiles(sessionDir = path.join(process.cwd(), "session")) {
  try {
    if (!fs.existsSync(sessionDir)) return {
      deleted: 0
    };
    const files = fs.readdirSync(sessionDir);
    let deletedCount = 0;
    for (const file of files) {
      if (file === "creds.json" || file.startsWith("app-state") || file.startsWith("pre-key")) continue;
      const filePath = path.join(sessionDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      } catch (_) {}
    }
    return {
      deleted: deletedCount
    };
  } catch {
    return {
      deleted: 0
    };
  }
}

function acquireTypedLock(type, identifier, ttlMs = 5e3) {
  if (!type || !identifier) return false;
  const lockKey = `${type}:${identifier}`;
  if (global.botEventLocks.has(lockKey)) return false;
  global.botEventLocks.add(lockKey);
  setTimeout(() => global.botEventLocks.delete(lockKey), ttlMs);
  return true;
}

function registerBotToPool(jid) {
  if (!jid) return;
  const clean = decodeJid(jid);
  global.botJidPool.add(clean);
  const num = extractNum(clean);
  if (num) global.botJidPool.add(`${num}@s.whatsapp.net`);
}
async function getAvatar(sock, id, fallback = "https://files.catbox.moe/8ugr9a.jpg", force = false) {
  if (!id) return fallback;
  let clean = decodeJid(id);
  if (clean.endsWith("@lid")) {
    const rawNum = clean.split("@")[0].split(":")[0];
    const mapped = global.lidPhoneCache.get(rawNum);
    if (mapped) clean = `${mapped}@s.whatsapp.net`;
  }
  const cached = global.avatarCache.get(clean);
  if (!force && cached && Date.now() - cached.time < global.AVATAR_CACHE_TTL) {
    return cached.url || fallback;
  }
  try {
    const pUrl = await Promise.race([sock.profilePictureUrl(clean, "image").catch(() => null), new Promise(r => setTimeout(() => r(null), 1500))]);
    const finalUrl = pUrl || fallback;
    global.avatarCache.set(clean, {
      url: finalUrl,
      time: Date.now()
    });
    return finalUrl;
  } catch {
    global.avatarCache.set(clean, {
      url: fallback,
      time: Date.now()
    });
    return fallback;
  }
}

function getUserName(sock, jid, fallbackNum) {
  if (!jid) return fallbackNum || "User";
  const clean = decodeJid(jid);
  const fromDb = global.db?.user?.[clean]?.name;
  if (fromDb && fromDb !== fallbackNum) return fromDb;
  const contact = sock?.contacts?.[clean] || global.db?.contacts?.[clean];
  const fromContact = contact?.name || contact?.notify || contact?.verifiedName;
  if (fromContact) return fromContact;
  return fallbackNum || "User";
}

function sanitizeMentions(list = []) {
  if (!Array.isArray(list)) return [];
  return list.filter(Boolean).map(j => decodeJid(String(j).trim())).filter(j => {
    if (j.includes("@lid") || !j.endsWith("@s.whatsapp.net")) return false;
    const num = j.split("@")[0].replace(/\D/g, "");
    return num.length >= 7 && num.length <= 16;
  });
}
const safeExit = async signal => {
  console.log(chalk.yellow(`\n[ SYSTEM ] Sinyal ${signal} diterima...`));
  try {
    flushGroupCacheToDisk();
    try {
      flushJadibotGroupCache();
    } catch (_) {}
    if (global.db && typeof db?.write === "function") {
      await db.write(global.db);
    }
    if (currentSock) {
      currentSock.ev?.removeAllListeners();
      try {
        currentSock.ws?.close();
      } catch (_) {}
      try {
        currentSock.end?.(undefined);
      } catch (_) {}
    }
  } catch (_) {}
  process.exit(0);
};
process.on("SIGINT", () => safeExit("SIGINT"));
process.on("SIGTERM", () => safeExit("SIGTERM"));

function logDetailedCrash(type, errorOrReason) {
  const timestamp = new Date().toLocaleTimeString("id-ID", {
    hour12: false
  });
  const divider = chalk.red("━".repeat(60));
  console.error(`\n${divider}`);
  console.error(chalk.bgRed.black.bold(` [ ANTI-CRASH ] `), chalk.yellow.bold(`» ${type.toUpperCase()} «`), chalk.gray(`[${timestamp}]`));
  console.error(divider);
  if (errorOrReason instanceof Error) {
    console.error(chalk.red.bold("• Name    :"), errorOrReason.name || "Error");
    console.error(chalk.white.bold("• Message :"), errorOrReason.message || "(tanpa pesan)");
    if (errorOrReason.code) {
      console.error(chalk.cyan.bold("• Code    :"), errorOrReason.code);
    }
    if (errorOrReason.stack) {
      console.error(chalk.yellow.bold("• Stack Trace :"));
      console.error(chalk.gray(errorOrReason.stack));
    }
  } else {
    console.error(chalk.white.bold("• Raw Value / Object :"));
    console.error(util.inspect(errorOrReason, {
      showHidden: false,
      depth: 5,
      colors: true,
      compact: false
    }));
  }
  console.error(`${divider}\n`);
}
process.on("uncaughtException", (err, origin) => {
  logDetailedCrash(`Uncaught Exception (${origin || "Unknown Origin"})`, err);
});
process.on("unhandledRejection", (reason, promise) => {
  logDetailedCrash("Unhandled Promise Rejection", reason);
});
const ask = prompt => new Promise(resolve => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question(prompt, ans => {
    rl.close();
    resolve(ans);
  });
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

function formatRuntime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? d + "d " : ""}${h > 0 ? h + "h " : ""}${m > 0 ? m + "m " : ""}${s}s`;
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function replacePlaceholders(text = "", data = {}) {
  return String(text).replace(/@user/gi, data.user ? `@${extractNum(data.user)}` : "").replace(/{user}/gi, data.user ? `@${extractNum(data.user)}` : "").replace(/{group}/gi, data.group || "").replace(/{desc}/gi, data.desc || "").replace(/{total}/gi, String(data.total || 0)).replace(/{admin}/gi, data.admin ? `@${extractNum(data.admin)}` : "").replace(/{date}/gi, new Date().toLocaleDateString("id-ID")).replace(/{time}/gi, new Date().toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta"
  }) + " WIB");
}
async function getFastGroupMetadata(sock, jid, force = false) {
  const normId = decodeJid(jid);
  const cached = global.groupCache.get(normId);
  if (!force && cached && Date.now() - cached.time < 5 * 60 * 1e3) {
    return cached.data;
  }
  const meta = await withTimeout(sock.groupMetadata(normId).catch(() => null), 3e3);
  if (meta) {
    global.groupCache.set(normId, {
      data: meta,
      time: Date.now()
    });
    saveGroupCacheToDisk();
  }
  return meta;
}
const getTargetOwnerJid = sock => {
  let rawOwner = Array.isArray(global.bot?.owner) ? global.bot.owner[0] : global.bot?.owner;
  if (!rawOwner && sock.user?.jid) return sock.user.jid;
  if (!rawOwner) return null;
  let cleanNum = String(rawOwner).replace(/\D/g, "");
  if (cleanNum.startsWith("0")) cleanNum = "62" + cleanNum.slice(1);
  return cleanNum ? `${cleanNum}@s.whatsapp.net` : sock.user?.jid;
};

function buildGroupNotif(action, userNum, groupName, totalMember, actorTag = "Admin") {
  if (action === "add") {
    return {
      title: "–  W E L C O M E",
      subtitle: `Member Baru di ${groupName}`,
      canvasTitle: "WELCOME",
      cardStatus: "ACTIVE",
      canvasMessage: "Selamat datang & semoga betah!",
      usertype: "Member",
      bodyText: `Halo @${userNum}, selamat datang di *${groupName}*.\n\n┌  ◦  *User* : @${userNum}\n│  ◦  *Members* : ${totalMember} Anggota\n└  ◦  *Group* : ${groupName}\n\n“ Patuhi tata tertib yang berlaku dan semoga betah di grup ini. ”`,
      buttons: [{
        name: "quick_reply",
        display_text: "Menu",
        id: ".menu"
      }, {
        name: "quick_reply",
        display_text: "Rules",
        id: ".rules"
      }]
    };
  }
  if (action === "remove") {
    return {
      title: "–  G O O D B Y E",
      subtitle: "Pemberitahuan Keluar",
      canvasTitle: "GOODBYE",
      cardStatus: "LEFT",
      canvasMessage: "Sampai jumpa & terima kasih!",
      usertype: "Ex-Member",
      bodyText: `Selamat tinggal @${userNum}, telah keluar dari *${groupName}*.\n\n┌  ◦  *User* : @${userNum}\n└  ◦  *Sisa Member* : ${totalMember} Anggota\n\n“ Terima kasih telah menjadi bagian dari grup ini. ”`,
      buttons: [{
        name: "quick_reply",
        display_text: "Sayonara",
        id: "sayonara"
      }]
    };
  }
  if (action === "promote") {
    return {
      title: "–  P R O M O T E",
      subtitle: `Promosi Admin di ${groupName}`,
      canvasTitle: "PROMOTED",
      cardStatus: "ADMIN",
      canvasMessage: "Selamat atas jabatan barunya!",
      usertype: "Admin",
      bodyText: `Selamat kepada @${userNum}, sekarang resmi menjadi admin di grup *${groupName}*.\n\n┌  ◦  *User* : @${userNum}\n│  ◦  *Action By* : ${actorTag}\n└  ◦  *Group* : ${groupName}`,
      buttons: [{
        name: "quick_reply",
        display_text: "Admin Menu",
        id: ".adminmenu"
      }]
    };
  }
  if (action === "demote") {
    return {
      title: "–  D E M O T E",
      subtitle: `Pencabutan Jabatan Admin`,
      canvasTitle: "DEMOTED",
      cardStatus: "MEMBER",
      canvasMessage: "Pencabutan wewenang admin grup.",
      usertype: "Member",
      bodyText: `Pemberitahuan untuk @${userNum}, status admin kamu telah dicabut di grup *${groupName}*.\n\n┌  ◦  *User* : @${userNum}\n│  ◦  *Action By* : ${actorTag}\n└  ◦  *Group* : ${groupName}`,
      buttons: [{
        name: "quick_reply",
        display_text: "Menu Utama",
        id: ".menu"
      }]
    };
  }
  return null;
}
async function generateWelcomeCard(params) {
  try {
    const baseApi = (global.bot?.api?.wudysoft || "").replace(/\/+$/, "");
    const selectedModel = params.model ?? Math.floor(Math.random() * 17) + 1;
    const uniqueUserId = params.userid || `UID-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const payload = {
      group_avatar: params.group_avatar || "https://files.catbox.moe/g2e6i5.jpg",
      group_name: String(params.group_name || "WhatsApp Group"),
      status_dot: String(params.status_dot || "On"),
      avatar: params.avatar || "https://files.catbox.moe/8ugr9a.jpg",
      status: String(params.status || "ACTIVE"),
      userid: uniqueUserId,
      usertype: String(params.usertype || "netizen"),
      title: String(params.title || "Welcome"),
      username: String(params.username || "User"),
      message: String(params.message || "Welcome to this server!"),
      foot_up: String(params.foot_up || "Terhubung ke Jaringan WhatsApp"),
      foot_end: String(params.foot_end || `Hak Cipta © ${new Date().getFullYear()}, ${global.bot?.name || "Cyberdyne Systems"}`),
      model: Number(selectedModel)
    };
    const response = await axios.post(`${baseApi}/api/maker/welcome/v1`, payload, {
      responseType: "arraybuffer",
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 6e4
    });
    if (!response?.data) return null;
    const buf = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
    if (buf.length > 512 && [137, 255, 82, 71].includes(buf[0])) return buf;
    return null;
  } catch {
    return null;
  }
}
async function sendGroupCtaMessage(sock, jid, {
  title = "",
  subtitle = "",
  body = "",
  footer = "",
  media = null,
  buttons = [],
  mentions = []
}) {
  const cleanJid = decodeJid(jid);
  const safeMentions = sanitizeMentions(mentions);
  try {
    const btn = new Button(sock);
    if (title) btn.setTitle(title);
    if (subtitle) btn.setSubtitle(subtitle);
    if (body) btn.setBody(body);
    if (footer) btn.setFooter(footer);
    if (media) btn.setImage(media);
    applyButtonsToBuilder(btn, buttons);
    if (safeMentions.length > 0) {
      btn.setContextInfo({
        mentionedJid: safeMentions
      });
    }
    return await btn.send(cleanJid, {
      mentions: safeMentions
    });
  } catch (err) {
    return await safeSendMessage(sock, cleanJid, {
      text: `–  *${title}*\n\n${body}\n\n_${footer}_`.trim(),
      mentions: safeMentions
    }).catch(() => {});
  }
}
async function createSessionZip(sessionDir) {
    try {
      const credsPath = path.join(sessionDir, "creds.json");
      let credsData = null;
      if (fs.existsSync(credsPath)) {
        credsData = fs.readFileSync(credsPath);
      } else if (global.db?.auth?.["main_session"]?.creds) {
        credsData = Buffer.from(JSON.stringify(global.db.auth["main_session"].creds, null, 2));
      }
      if (!credsData) return null;
      const zip = new JSZip();
      zip.file("creds.json", credsData);
      return await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6
        }
      });
    } catch {
      return null;
    }
  }
  (async () => {
    const sessionDir = path.join(process.cwd(), "session");
    cleanupSessionFiles(sessionDir);
    const loader = new CommandLoader({
      dir: path.join(process.cwd(), "./plugins"),
      logger: {
        log: console.log,
        info: console.log,
        error: console.error,
        warn: console.warn
      }
    });
    global.loader = loader;
    await loader.loadAll();
    loader.watch();
    const total = Object.values(loader.getCommandsByCategory()).flat().length;
    console.clear();
    console.log(chalk.cyan(`
  –  ${chalk.bold(global.bot?.name || "WUDYSOFT")} (v${global.bot?.versions || "3.0.1"})
  
  ┌  ◦  Engine   : ${chalk.green("@whiskeysockets/baileys (Full Synchronized)")}
  │  ◦  Commands : ${chalk.yellow(total)} Loaded
  │  ◦  Prefix   : ${chalk.white("[ . ] / Multi Prefix")}
  └  ◦  Platform : ${chalk.magenta(os.platform())} (${os.arch()})
`));
    const saved = await db.read() || {};
    global.db = {
      user: saved?.user || {},
      group: saved?.group || {},
      cmd: saved?.cmd || {},
      stats: saved?.stats || {},
      contacts: saved?.contacts || {},
      domino: saved?.domino || {},
      mines: saved?.mines || {},
      arena: saved?.arena || {},
      stickerCmd: saved?.stickerCmd || {},
      jadibot: saved?.jadibot || {},
      auth: saved?.auth || {},
      totalHits: saved?.totalHits || 0
    };
    let selectedPairing = null;
    let authFailCount = 0;
    const start = async () => {
      if (currentSock) {
        try {
          currentSock.ev.removeAllListeners();
          if (currentSock.ws) currentSock.ws.close();
          currentSock.end?.(undefined);
        } catch (_) {}
        currentSock = null;
      }
      const {
        version
      } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3e3, 1015901307]
      }));
      const {
        state,
        saveCreds
      } = await useMultiFileAuthState(sessionDir);
      const isRegistered = Boolean(state.creds && (state.creds.registered === true || Boolean(state.creds.me?.id) || Boolean(state.creds.account)));
      if (!isRegistered && selectedPairing === null) {
        console.log(chalk.gray(`\n–  Konfigurasi Sambungan`));
        const mode = await ask(chalk.gray("   Gunakan pairing code? (yes/no): "));
        selectedPairing = mode.trim().toLowerCase() === "yes";
      }
      const pairing = !isRegistered && (selectedPairing ?? false);
      global.signalKeyStore = makeCacheableSignalKeyStore(state.keys, pino({
        level: "silent"
      }));
      const sock = makeWASocket({
        version: version,
        logger: pino({
          level: "silent"
        }),
        auth: {
          creds: state.creds,
          keys: global.signalKeyStore
        },
        shouldIgnoreJid: jid => isJidBroadcast(jid) || jid?.endsWith("@newsletter"),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 25e3,
        connectTimeoutMs: 6e4,
        defaultQueryTimeoutMs: 0,
        retryRequestDelayMs: 500,
        getMessage: async key => {
          if (!key?.id) return undefined;
          const cached = global.msgStore?.get(key.id);
          if (cached) {
            const raw = cached.rawMessage || cached.message || cached.msg?.message || cached.msg;
            if (raw) return proto.Message.fromObject(raw);
          }
          return undefined;
        }
      });
      sock.ws?.on("CB:ack,class:message,type:error", node => {
        try {
          const errorAttr = node?.attrs;
          if (errorAttr?.error === "479" || errorAttr?.code === "479") {
            const fromGroup = errorAttr.from;
            if (fromGroup && fromGroup.endsWith("@g.us")) {
              global.groupCache?.delete(decodeJid(fromGroup));
            }
          }
        } catch (_) {}
      });
      currentSock = sock;
      const _origChatModify = sock.chatModify?.bind(sock);
      if (_origChatModify) {
        sock.chatModify = async function(mod, jid) {
          try {
            return await _origChatModify(mod, jid);
          } catch (err) {
            if (String(err?.message || "").includes("myAppStateKey")) {
              if (sock.authState?.creds && !sock.authState.creds.myAppStateKeyId) {
                sock.authState.creds.myAppStateKeyId = "AAAAAIDq";
              }
              if (typeof sock.resyncAppState === "function") {
                await sock.resyncAppState(["critical_unblock_low"], true).catch(() => {});
              }
            }
            throw err;
          }
        };
      }
      if (sock.signalRepository?.lidMapping?.on) {
        sock.signalRepository.lidMapping.on("update", updates => {
          for (const update of updates) {
            if (update.lid && update.pn) {
              const lidNum = update.lid.split("@")[0].split(":")[0];
              const phoneNum = update.pn.split("@")[0].split(":")[0].replace(/[^\d]/g, "");
              global.lidPhoneCache.set(lidNum, phoneNum);
              global.phoneLidCache.set(phoneNum, lidNum);
            }
          }
        });
      }
      sock.ev.on("lid-mapping.update", map => {
        for (const [lid, phoneNumber] of Object.entries(map || {})) {
          const lidClean = lid.split("@")[0].split(":")[0];
          const phoneClean = String(phoneNumber).split("@")[0].split(":")[0].replace(/[^\d]/g, "");
          global.lidPhoneCache.set(lidClean, phoneClean);
          global.phoneLidCache.set(phoneClean, lidClean);
        }
      });
      const enrichSockUser = () => {
        if (!sock.user && state.creds?.me) sock.user = {
          ...state.creds.me
        };
        if (sock.user) {
          const rawId = sock.user.id || "";
          const cleanJid = decodeJid(rawId);
          const cleanNum = extractNum(cleanJid);
          const cleanLid = sock.user.lid ? decodeJid(sock.user.lid) : null;
          const botName = sock.user.name || state.creds?.me?.name || global.bot?.name || "Wudysoft";
          sock.user.id = rawId;
          sock.user.jid = cleanJid;
          sock.user.phoneJid = cleanJid;
          sock.user.lid = cleanLid;
          sock.user.number = cleanNum;
          sock.user.phone = cleanNum;
          sock.user.name = botName;
          sock.user.pushname = botName;
          sock.user.pushName = botName;
          if (cleanLid && cleanJid) global.lidPhoneCache.set(cleanLid, cleanJid);
          registerBotToPool(cleanJid);
          if (cleanLid) registerBotToPool(cleanLid);
        }
      };
      enrichSockUser();
      if (pairing) {
        console.log(chalk.gray(`\n–  Pairing Code Request`));
        const number = await ask(chalk.gray("   Masukkan nomor WhatsApp (contoh: 628xxx): "));
        let cleanNumber = number.replace(/\D/g, "");
        if (cleanNumber.startsWith("0")) cleanNumber = "62" + cleanNumber.slice(1);
        try {
          const customCode = "WUDYSOFT";
          let code = await sock.requestPairingCode(cleanNumber);
          code = code?.match(/.{1,4}/g)?.join("-") || code;
          console.log(chalk.cyan(`\n┌  ◦  PAIRING CODE : `) + chalk.bold.white(code) + chalk.cyan(`\n└  ◦  Masukkan kode ini pada perangkat Anda.\n`));
        } catch (e) {
          console.error(chalk.red(`[ PAIRING ERROR ]`), e.message);
        }
      }
      let isRestarting = false;
      let reconnectAttempts = 0;
      let globalReconnect = null;
      const reconnect = async (customDelay = null) => {
        if (isRestarting) return;
        isRestarting = true;
        reconnectAttempts++;
        const delayTime = customDelay || Math.min(3e3 * Math.pow(1.5, reconnectAttempts - 1), 3e4);
        console.log(chalk.gray(`[ RECONNECT ]`) + chalk.yellow(` Menghubungkan ulang dalam ${(delayTime / 1e3).toFixed(1)} detik...`));
        try {
          detachAllEvents();
          if (currentSock?.ws) currentSock.ws.close();
          currentSock?.end?.(undefined);
        } catch (_) {}
        await sleep(delayTime);
        isRestarting = false;
        return start();
      };
      globalReconnect = reconnect;
      const onCredsUpdate = async () => {
        await saveCreds();
        enrichSockUser();
      };
      let hasSentConnectNotice = false;
      const onConnectionUpdate = async ({
        connection,
        lastDisconnect,
        qr
      }) => {
        if (qr && !isRegistered && !pairing) {
          console.log(chalk.gray(`\n–  Pindai Kode QR:`));
          qrcode.generate(qr, {
            small: true
          });
        }
        if (connection === "close") {
          const reason = lastDisconnect?.error?.output?.statusCode ?? (lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : undefined);
          console.log(chalk.gray(`[ CONNECTION ]`) + chalk.yellow(` Ditutup (Status: ${reason})`));
          if (reason === DisconnectReason.loggedOut || reason === 401) {
            console.log(chalk.red(`[ SESSION ] Sesi tidak valid / Dikeluarkan. Menghapus sesi...`));
            try {
              fs.rmSync(sessionDir, {
                recursive: true,
                force: true
              });
              console.log(chalk.green(`[ SESSION ] Direktori sesi berhasil dihapus.`));
            } catch (e) {
              console.error(chalk.red(`[ SESSION ] Gagal menghapus direktori sesi:`), e.message);
            }
            process.exit(1);
          }
          if (reason === DisconnectReason.restartRequired || reason === 515) {
            console.log(chalk.gray(`[ CONNECTION ] Pairing berhasil, menyimpan kredensial...`));
            try {
              await saveCreds();
              console.log(chalk.green(`[ CONNECTION ] Kredensial tersimpan. Melakukan restart...`));
            } catch (e) {
              console.error(chalk.red(`[ CREDS ERROR ] Gagal menyimpan kredensial:`), e.message);
            }
            return reconnect(1e3);
          }
          if (reason === DisconnectReason.connectionLost || reason === DisconnectReason.connectionClosed || reason === 408 || reason === 428 || reason === 503) {
            return reconnect(3e3);
          }
          return reconnect(5e3);
        }
        if (connection === "open") {
          authFailCount = 0;
          reconnectAttempts = 0;
          isRestarting = false;
          enrichSockUser();
          global._toxicLastActivity = Date.now();
          const botPhone = sock.user?.number || sock.user?.jid?.split("@")[0] || "Unknown";
          const botPushName = sock.user?.name || global.bot?.name || "Bot";
          console.log(chalk.green(`\n[ CONNECTED ] `) + chalk.white(`${botPushName} (+${botPhone}) siap digunakan.`));
          setTimeout(() => {
            sock.sendPresenceUpdate("available").catch(() => {});
          }, 1500);
          setTimeout(() => {
            sock.resyncAppState(["regular_high", "regular_low"], false).catch(() => {});
          }, 3500);
          setTimeout(async () => {
            try {
              const allGroups = await sock.groupFetchAllParticipating();
              for (const [jid, meta] of Object.entries(allGroups || {})) {
                global.groupCache.set(decodeJid(jid), {
                  data: meta,
                  time: Date.now()
                });
              }
              saveGroupCacheToDisk();
              console.log(chalk.gray(`[ SYNC ] `) + chalk.cyan(`${Object.keys(allGroups || {}).length} grup tersinkronisasi.`));
            } catch (_) {}
          }, 5e3);
          if (typeof initAllJadiBots === "function") {
            setTimeout(() => {
              initAllJadiBots(sock).catch(e => {
                console.error(chalk.red("[JADIBOT INIT ERROR]"), e.message);
              });
            }, 6e3);
          }
          if (!hasSentConnectNotice) {
            hasSentConnectNotice = true;
            setTimeout(async () => {
              const targetJid = getTargetOwnerJid(sock);
              if (!targetJid) return;
              try {
                const ramUsed = formatSize(process.memoryUsage().rss);
                const totalRam = formatSize(os.totalmem());
                await safeSendMessage(sock, targetJid, {
                  text: `–  *B O T  C O N N E C T E D*\n\nBot berhasil tersambung ke jaringan WhatsApp.\n\n┌  ◦  *Bot* : ${botPushName}\n│  ◦  *RAM* : ${ramUsed} / ${totalRam}\n└  ◦  *Time* : ${new Date().toLocaleTimeString("id-ID", {
timeZone: "Asia/Jakarta"
})} WIB`
                });
                const zipBuffer = await createSessionZip(sessionDir);
                if (zipBuffer) {
                  await safeSendMessage(sock, targetJid, {
                    document: zipBuffer,
                    mimetype: "application/zip",
                    fileName: `creds_${botPhone}.zip`,
                    caption: `–  *B A C K U P  C R E D S*`
                  });
                  console.log(chalk.green(`[ BACKUP ] Sesi ZIP berhasil dikirim ke Owner.`));
                }
              } catch (err) {
                console.error(chalk.red(`[ BACKUP ERROR ] Gagal kirim ke ${targetJid}:`), err.message);
              }
            }, 8e3);
          }
        }
      };
      const onMessagingHistorySet = ({
        contacts
      }) => {
        if (Array.isArray(contacts)) {
          for (const c of contacts) {
            const id = jidNormalizedUser(c.id);
            if (c.lid && id) global.lidPhoneCache.set(jidNormalizedUser(c.lid), id);
            if (global.db.contacts) {
              global.db.contacts[id] = {
                ...global.db.contacts[id] || {},
                ...c,
                isContact: true
              };
            }
          }
        }
      };
      const onMessagesUpsert = async ({
        type,
        messages
      }) => {
        global._toxicLastActivity = Date.now();
        if (type !== "notify" && type !== "append") return;
        for (const msg of messages) {
          const _jid = msg.key?.remoteJid;
          let _presenceActive = false;
          const _pausePresence = () => {
            if (!_presenceActive || !_jid) return;
            _presenceActive = false;
            sock.sendPresenceUpdate("paused", _jid).catch(() => {});
          };
          try {
            const jid = msg.key?.remoteJid;
            const msgId = msg.key?.id;
            sock.presenceSubscribe(jid).catch(() => {});
            if (!jid || !msgId) continue;
            if (jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;
            const rawMessageObj = msg.message || unwrapMessage?.(msg.message) || {};
            if (!rawMessageObj) continue;
            if (global.bot?.autoRead && !msg.key.fromMe) {
              setTimeout(() => {
                sock.readMessages([msg.key]).catch(() => {});
              }, Math.floor(Math.random() * 400) + 300);
            }
            const senderRaw = msg.key?.participant || msg.participant || jid;
            const senderClean = decodeJid(senderRaw);
            if (!msg.key.fromMe && global.botJidPool.has(senderClean)) continue;
            const isGroup = jid.endsWith("@g.us");
            const msgLockType = isGroup ? `msg_grp_${type}` : `msg_pvt_${type}`;
            if (!acquireTypedLock(msgLockType, `jid_${msgId}`, 3e3)) continue;
            if (rawMessageObj) {
              global.msgStore.set(msgId, {
                rawMessage: rawMessageObj,
                message: rawMessageObj,
                msg: msg,
                sender: senderRaw,
                timestamp: Date.now()
              });
            }
            if (msg.key?.participant && msg.key?.participant.endsWith("@lid")) {
              const rawSender = msg.participant || msg.key.participantJid || msg.key.participantAlt || jid;
              if (rawSender && !rawSender.endsWith("@lid")) {
                global.lidPhoneCache.set(decodeJid(msg.key.participant), decodeJid(rawSender));
              } else if (typeof resolveLidProactively === "function") {
                resolveLidProactively(sock, msg.key.participant).catch(() => {});
              }
            }
            let ctx = null;
            try {
              ctx = await Promise.race([SerializeMessage(sock, msg), new Promise((_, rej) => setTimeout(() => rej(new Error("serialize_timeout")), 6e3))]);
            } catch (serErr) {
              continue;
            }
            if (!ctx) continue;
            ctx.loader = loader;
            const _text = String(ctx.text || ctx.body || "").trim();
            const _prefixes = Array.isArray(global.bot?.prefix) ? global.bot.prefix : typeof global.bot?.prefix === "string" ? [global.bot.prefix] : [".", "!", "/", "#"];
            const _hasPrefix = _text && _prefixes.some(p => _text.startsWith(p));
            const _firstWord = _text.split(/\s+/)[0]?.toLowerCase() || "";
            const _isNoprefix = Boolean(global.bot?.noprefix && loader?.getCommand?.(_firstWord));
            if ((_hasPrefix || _isNoprefix) && global.bot?.autoTyping && !msg.key.fromMe) {
              sock.sendPresenceUpdate("composing", jid).catch(() => {});
              _presenceActive = true;
            }
            try {
              await UpsertMsgHandle(sock, msg, ctx, {
                cmd: loader
              });
            } catch (e) {
              console.error(chalk.red("[HANDLER ERROR]"), e.stack || e.message);
            } finally {
              _pausePresence();
            }
          } catch (e) {
            _pausePresence();
          }
        }
      };
      const onMessagesUpdate = async updates => {
        for (const updateItem of updates) {
          try {
            const {
              key,
              update
            } = updateItem;
            const keyId = key?.id;
            const chatId = key?.remoteJid;
            if (!keyId || !chatId) continue;
            const cached = global.msgStore?.get(keyId);
            if (update?.pollUpdates) {
              continue;
            }
            const rawUpdate = update;
            const isStubEdit = rawUpdate?.messageStubType === 68 || rawUpdate?.messageStubType === proto.WebMessageInfo?.StubType?.MESSAGE_EDIT || rawUpdate?.stubType === 68;
            const isProtoEdit = rawUpdate?.message?.protocolMessage?.type === 14 || rawUpdate?.protocolMessage?.type === 14 || Boolean(rawUpdate?.message?.protocolMessage?.editedMessage);
            if (isStubEdit || isProtoEdit) {
              if (!acquireTypedLock("msg_edit", `${chatId}_${keyId}`, 4e3)) continue;
              const editedMsgPayload = rawUpdate?.message?.protocolMessage?.editedMessage || rawUpdate?.protocolMessage?.editedMessage || rawUpdate?.message;
              if (editedMsgPayload) {
                const editMsg = {
                  key: {
                    ...key,
                    participant: key?.participant || cached?.sender || (key?.fromMe ? sock.user?.id : chatId)
                  },
                  message: editedMsgPayload,
                  messageTimestamp: rawUpdate?.messageTimestamp || Date.now()
                };
                if (cached) {
                  cached.message = editedMsgPayload;
                  cached.rawMessage = editedMsgPayload;
                }
                const ctx = await SerializeMessage(sock, editMsg);
                if (ctx) {
                  ctx.loader = loader;
                  ctx.isEdited = true;
                  UpsertMsgHandle(sock, editMsg, ctx, {
                    cmd: loader
                  });
                }
              }
              continue;
            }
            const isRevoked = rawUpdate?.messageStubType === 68 && !isStubEdit ? false : rawUpdate?.messageStubType === proto.WebMessageInfo?.StubType?.REVOKE || rawUpdate?.message === null || rawUpdate?.protocolMessage?.type === 0;
            if (isRevoked) {
              if (!acquireTypedLock("antidel_revoke", `${chatId}_${keyId}`, 8e3)) continue;
              const groupCfg = global.db?.group?.[chatId];
              if (cached && groupCfg?.antidelete === true && chatId?.endsWith("@g.us")) {
                let senderJid = cached.sender || cached.key?.participant || cached.participant;
                if (senderJid && senderJid.endsWith("@lid")) {
                  senderJid = await withTimeout(resolveLidToJid(senderJid, sock, null, []), 2500).catch(() => senderJid);
                }
                const senderNum = extractNum(senderJid) || senderJid?.split("@")[0] || "Unknown";
                const deleteTime = new Date().toLocaleTimeString("id-ID", {
                  timeZone: "Asia/Jakarta"
                });
                const noticeText = `–  *A N T I - D E L E T E*\n\nTerdeteksi pesan yang baru saja dihapus oleh pengirim.\n\n┌  ◦  *Sender* : @${senderNum}\n└  ◦  *Time* : ${deleteTime} WIB\n\n_Pesan asli yang dihapus diteruskan di bawah ini:_`;
                const safeMentions = sanitizeMentions([senderJid]);
                const sentNotice = await safeSendMessage(sock, chatId, {
                  text: noticeText,
                  mentions: safeMentions
                }).catch(() => null);
                const targetMsg = cached.fakeObj || cached.vM || cached.msg || (cached.key ? cached : null) || {
                  key: {
                    remoteJid: chatId,
                    id: keyId,
                    participant: senderJid
                  },
                  message: cached.rawMessage || {
                    conversation: cached.text || ""
                  },
                  messageTimestamp: cached.timestamp || Date.now()
                };
                if (targetMsg) {
                  try {
                    await copyNForward(sock, chatId, targetMsg, false, {}, sentNotice || undefined);
                  } catch (_) {
                    if (cached.text || cached.body) {
                      await safeSendMessage(sock, chatId, {
                        text: `💬 *Isi Pesan:*\n\`\`\`${cached.text || cached.body}\`\`\``
                      }, {
                        quoted: sentNotice || undefined
                      });
                    }
                  }
                }
              }
            }
          } catch (_) {}
        }
      };
      const onGroupParticipantsUpdate = async ({
        id,
        author,
        participants,
        action
      }) => {
        try {
          if (!["add", "remove", "promote", "demote"].includes(action)) return;
          const cleanChatId = decodeJid(id);
          if (typeof db.ensureGroup === "function") db.ensureGroup(cleanChatId);
          const cfg = global.db?.group?.[cleanChatId] || {};
          const enabled = action === "add" ? cfg.welcome !== false : action === "remove" ? cfg.leave !== false && cfg.goodbye !== false : cfg.detect !== false;
          if (!enabled) return;
          const jids = (participants || []).map(p => typeof p === "string" ? p : p?.phoneNumber || p?.id || p?.jid || "").filter(Boolean).slice(0, GROUP_NOTIF_MAX);
          if (!jids.length) return;
          const defaultBackground = global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
          const defaultAvatar = global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
          const [metadata, groupPic] = await Promise.all([getFastGroupMetadata(sock, cleanChatId, false), getAvatar(sock, cleanChatId, defaultBackground)]);
          if (!metadata) return;
          global.groupCache.set(cleanChatId, {
            data: metadata,
            time: Date.now()
          });
          const groupName = metadata.subject || "Group WhatsApp";
          const totalMember = metadata.participants?.length || 0;
          let actorJid = null;
          if (author) {
            actorJid = decodeJid(author);
            if (actorJid.endsWith("@lid")) {
              const resolvedActor = await resolveLidToJid(actorJid, sock, null, metadata?.participants || []);
              actorJid = resolvedActor.endsWith("@lid") ? null : resolvedActor;
            }
          }
          const actorTag = actorJid ? `@${extractNum(actorJid)}` : "Sistem/Admin";
          const prepared = await Promise.all(jids.map(async rawUser => {
            let cleanUserJid = decodeJid(rawUser);
            if (cleanUserJid.endsWith("@lid")) {
              const resolvedUser = await resolveLidToJid(cleanUserJid, sock, null, metadata?.participants || []);
              cleanUserJid = resolvedUser;
            }
            const userNum = extractNum(cleanUserJid) || cleanUserJid.split("@")[0];
            const userName = getUserName(sock, cleanUserJid, userNum);
            const notif = buildGroupNotif(action, userNum, groupName, totalMember, actorTag);
            if (!notif) return null;
            let bodyText = notif.bodyText;
            const ctxData = {
              user: cleanUserJid,
              group: groupName,
              desc: metadata.desc || "",
              total: totalMember,
              admin: actorJid ? `@${extractNum(actorJid)}` : ""
            };
            if (action === "add" && typeof cfg.welcome === "string" && cfg.welcome.trim()) {
              bodyText = replacePlaceholders(cfg.welcome, ctxData);
            } else if (action === "remove") {
              const customLeave = typeof cfg.leave === "string" ? cfg.leave : typeof cfg.goodbye === "string" ? cfg.goodbye : null;
              if (customLeave && customLeave.trim()) bodyText = replacePlaceholders(customLeave, ctxData);
            }
            const mentions = [cleanUserJid];
            if (actorJid && actorJid !== cleanUserJid) mentions.push(actorJid);
            const userPic = await getAvatar(sock, cleanUserJid, defaultAvatar);
            return {
              cleanUserJid: cleanUserJid,
              userNum: userNum,
              userName: userName,
              userPic: userPic,
              notif: notif,
              bodyText: bodyText,
              mentions: mentions
            };
          }));
          await Promise.allSettled(prepared.filter(Boolean).map(async p => {
            if (!acquireTypedLock(`ptcp_${action}`, `${cleanChatId}_${p.cleanUserJid}`, 5e3)) return;
            const bannerImage = await withTimeout(generateWelcomeCard({
              group_avatar: groupPic,
              group_name: groupName,
              avatar: p.userPic,
              status: p.notif.cardStatus,
              title: p.notif.canvasTitle,
              username: String(p.userName).slice(0, 15),
              message: p.notif.canvasMessage || p.notif.subtitle,
              usertype: p.notif.usertype || "Member"
            }), 4e3).catch(() => null);
            await sendGroupCtaMessage(sock, cleanChatId, {
              title: p.notif.title,
              subtitle: p.notif.subtitle,
              body: p.bodyText,
              footer: `${groupName} • ${totalMember} Members`,
              media: bannerImage || p.userPic || groupPic,
              buttons: p.notif.buttons,
              mentions: p.mentions
            });
          }));
        } catch (err) {
          console.error(chalk.red("[PARTICIPANTS UPDATE ERROR]:"), err?.message || err);
        }
      };
      const onGroupsUpdate = async groupUpdates => {
        for (const update of groupUpdates) {
          try {
            const id = update.id;
            if (!id) continue;
            const cleanChatId = decodeJid(id);
            const normId = jidNormalizedUser(id);
            const oldCachedMeta = global.groupCache.get(normId)?.data || global.groupCache.get(cleanChatId)?.data || null;
            const cfg = global.db?.group?.[cleanChatId] || global.db?.group?.[id] || {};
            const isDetect = cfg.detect !== false;
            let title = "",
              subtitle = "",
              body = "",
              updateType = "",
              canvasTitle = "UPDATED",
              canvasStatus = "ACTIVE";
            if (update.subject && oldCachedMeta?.subject && update.subject !== oldCachedMeta.subject) {
              updateType = "subject";
              title = "–  S U B J E C T  U P D A T E";
              subtitle = update.subject;
              body = `Nama grup telah diperbarui menjadi:\n*${update.subject}*`;
              canvasTitle = "NAME CHANGED";
              canvasStatus = "SUBJECT";
            } else if (update.desc !== undefined && oldCachedMeta && update.desc !== (oldCachedMeta.desc || "")) {
              updateType = "desc";
              title = "–  D E S C  U P D A T E";
              subtitle = oldCachedMeta?.subject || update.subject || "Grup WhatsApp";
              body = update.desc ? `Deskripsi grup telah diperbarui:\n\n${update.desc}` : `Deskripsi grup telah dikosongkan oleh Admin.`;
              canvasTitle = "DESC UPDATE";
              canvasStatus = "INFO";
            } else if (update.announce !== undefined && oldCachedMeta?.announce !== undefined && Boolean(update.announce) !== Boolean(oldCachedMeta.announce)) {
              updateType = "announce";
              const isClosed = Boolean(update.announce);
              title = isClosed ? "–  G R O U P  C L O S E D" : "–  G R O U P  O P E N E D";
              subtitle = isClosed ? "Hanya Admin Yang Bisa Chat" : "Semua Anggota Bisa Chat";
              body = isClosed ? `Grup telah ditutup oleh Admin.\nSekarang hanya admin yang dapat mengirim pesan.` : `Grup telah dibuka kembali oleh Admin.\nSekarang seluruh anggota dapat mengirim pesan.`;
              canvasTitle = isClosed ? "GROUP CLOSED" : "GROUP OPEN";
              canvasStatus = isClosed ? "CLOSED" : "OPENED";
            } else if (update.restrict !== undefined && oldCachedMeta?.restrict !== undefined && Boolean(update.restrict) !== Boolean(oldCachedMeta.restrict)) {
              updateType = "restrict";
              const isRestricted = Boolean(update.restrict);
              title = isRestricted ? "–  I N F O  R E S T R I C T E D" : "–  I N F O  U N L O C K E D";
              subtitle = isRestricted ? "Hanya Admin Yang Bisa Edit Info" : "Semua Anggota Bisa Edit Info";
              body = isRestricted ? `Setelan grup diperbarui.\nSekarang hanya Admin yang dapat mengubah info grup ini.` : `Setelan grup diperbarui.\nSekarang semua anggota dapat mengubah info grup ini.`;
              canvasTitle = isRestricted ? "INFO LOCKED" : "INFO UNLOCKED";
              canvasStatus = "RESTRICT";
            } else if (update.ephemeralDuration !== undefined && oldCachedMeta?.ephemeralDuration !== undefined && update.ephemeralDuration !== oldCachedMeta.ephemeralDuration) {
              updateType = "ephemeral";
              const dur = update.ephemeralDuration;
              const durText = dur === 0 ? "Nonaktif" : dur >= 86400 ? `${dur / 86400} Hari` : `${dur / 3600} Jam`;
              title = "–  E P H E M E R A L";
              subtitle = "Disappearing Messages";
              body = `Fitur pesan sementara telah disetel menjadi: *${durText}*`;
              canvasTitle = "EPHEMERAL";
              canvasStatus = "DURATION";
            } else if (update.joinApprovalMode !== undefined && oldCachedMeta?.joinApprovalMode !== undefined && Boolean(update.joinApprovalMode) !== Boolean(oldCachedMeta.joinApprovalMode)) {
              updateType = "approval";
              const isApproval = Boolean(update.joinApprovalMode);
              title = "–  M E M B E R S H I P  A P P R O V A L";
              subtitle = "Membership Approval";
              body = `Mode persetujuan admin untuk anggota baru sekarang: *${isApproval ? "Aktif (Wajib ACC)" : "Nonaktif (Langsung Masuk)"}*`;
              canvasTitle = "APPROVAL";
              canvasStatus = isApproval ? "ON" : "OFF";
            }
            const currentMeta = oldCachedMeta ? {
              ...oldCachedMeta,
              ...update
            } : await getFastGroupMetadata(sock, cleanChatId, true);
            if (currentMeta) {
              global.groupCache.set(normId, {
                data: currentMeta,
                time: Date.now()
              });
              global.groupCache.set(cleanChatId, {
                data: currentMeta,
                time: Date.now()
              });
              saveGroupCacheToDisk();
            }
            if (global.db?.group?.[cleanChatId]) {
              if (update.subject) global.db.group[cleanChatId].subject = update.subject;
              if (update.desc !== undefined) global.db.group[cleanChatId].desc = update.desc;
              if (update.announce !== undefined) global.db.group[cleanChatId].announce = update.announce;
              if (update.restrict !== undefined) global.db.group[cleanChatId].restrict = update.restrict;
              if (typeof db?.write === "function") db.write(global.db);
            }
            if (!isDetect || !title || !updateType) continue;
            if (!acquireTypedLock(`grp_meta_${updateType}`, `${cleanChatId}_${updateType}`, 6e3)) continue;
            const groupName = currentMeta?.subject || update.subject || "Grup WhatsApp";
            const defaultBg = global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
            const groupPic = await getAvatar(sock, cleanChatId, defaultBg);
            const bannerImage = await withTimeout(generateWelcomeCard({
              group_avatar: groupPic,
              group_name: groupName,
              avatar: groupPic,
              status: canvasStatus,
              title: canvasTitle,
              username: subtitle.slice(0, 15),
              message: String(body || "").replace(/[\n*_\x60~]/g, " ").replace(/\s+/g, " ").trim().slice(0, 35),
              usertype: "Notification"
            }), 4e3).catch(() => null);
            await sendGroupCtaMessage(sock, cleanChatId, {
              title: title,
              subtitle: subtitle,
              body: body,
              footer: groupName,
              media: bannerImage || groupPic,
              buttons: [{
                name: "quick_reply",
                display_text: "Menu",
                id: ".menu"
              }]
            });
          } catch (_) {}
        }
      };
      const onGroupJoinRequest = async ({
        id,
        participant,
        action
      }) => {
        try {
          const cleanChatId = decodeJid(id);
          const cleanPart = decodeJid(participant);
          if (!acquireTypedLock(`joinreq_${action}`, `${cleanChatId}_${cleanPart}`, 8e3)) return;
          const cfg = global.db?.group?.[id] || {};
          if (cfg.detect === false) return;
          if (action !== "created") return;
          const defaultBg = global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
          const defaultAvatar = global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
          const [metadata, groupPic, userPic] = await Promise.all([getFastGroupMetadata(sock, id, false), getAvatar(sock, id, defaultBg), getAvatar(sock, cleanPart, defaultAvatar)]);
          const groupName = metadata?.subject || "Group WhatsApp";
          const userJid = await resolveLidToJid(cleanPart, sock, null, metadata?.participants || []);
          const userNum = extractNum(userJid) || userJid?.split("@")[0] || "User";
          const userName = getUserName(sock, userJid, userNum);
          const bannerImage = await withTimeout(generateWelcomeCard({
            group_avatar: groupPic,
            group_name: groupName,
            avatar: userPic,
            status: "REQUEST",
            title: "JOIN REQUEST",
            username: String(userName).slice(0, 15),
            message: "Permintaan bergabung ke grup"
          }), 4e3).catch(() => null);
          const body = `Permintaan bergabung baru ke dalam grup.\n\n` + `┌  ◦  *User* : @${userNum}\n` + `└  ◦  *Group* : *${groupName}*\n\n` + `_Harap admin meninjau permintaan bergabung ini._`;
          await sendGroupCtaMessage(sock, id, {
            title: "–  J O I N  R E Q U E S T",
            subtitle: groupName,
            body: body,
            footer: "Membership Approval",
            media: bannerImage || userPic || groupPic,
            buttons: [{
              name: "quick_reply",
              display_text: "Cek Request",
              id: ".listrequest"
            }],
            mentions: [userJid]
          });
        } catch (_) {}
      };
      const onCall = async calls => {
        if (!global.bot?.anticall) return;
        for (const call of calls) {
          if (call.status === "offer") {
            const from = call.from;
            if (!acquireTypedLock("call_offer", `${from}_${call.id}`, 1e4)) continue;
            sock.rejectCall(call.id, from).catch(() => {});
            safeSendMessage(sock, from, {
              text: `–  *A N T I - C A L L*\n\nMohon maaf, bot tidak dapat menerima panggilan suara atau video.`
            }).catch(() => {});
            if (global.bot?.anticallBlock) {
              sock.updateBlockStatus(from, "block").catch(() => {});
            }
          }
        }
      };
      const onContactsUpsert = contacts => {
        for (const c of contacts) {
          const id = jidNormalizedUser(c.id);
          if (c.lid && id) global.lidPhoneCache.set(jidNormalizedUser(c.lid), id);
          if (global.db.contacts) {
            global.db.contacts[id] = {
              ...global.db.contacts[id] || {},
              ...c,
              isContact: true
            };
          }
          if (c.name && global.db?.user?.[id]) {
            global.db.user[id].name = c.name;
          }
        }
      };
      const onContactsUpdate = contacts => {
        for (const c of contacts) {
          const id = jidNormalizedUser(c.id);
          if (c.lid && id) global.lidPhoneCache.set(jidNormalizedUser(c.lid), id);
          if (global.db.contacts) {
            global.db.contacts[id] = {
              ...global.db.contacts[id] || {},
              ...c
            };
          }
          if (c.name && global.db?.user?.[id]) {
            global.db.user[id].name = c.name;
          }
        }
      };
      const handleUserActivityAfk = async (chatJid, participantJid, activityType = "aktif") => {
        try {
          if (!participantJid) return;
          let cleanSender = decodeJid(participantJid);
          if (cleanSender.endsWith("@lid")) {
            const rawLid = cleanSender.split("@")[0].split(":")[0];
            const cachedPhone = global.lidPhoneCache?.get(rawLid);
            if (cachedPhone) {
              cleanSender = `${cachedPhone}@s.whatsapp.net`;
            } else if (typeof resolveLidToJid === "function") {
              cleanSender = await resolveLidToJid(cleanSender, sock, null, []).catch(() => cleanSender);
            }
          }
          const senderNumber = extractNum(cleanSender);
          const userPhoneJid = senderNumber ? `${senderNumber}@s.whatsapp.net` : cleanSender;
          let u = global.db?.user?.[userPhoneJid] || global.db?.user?.[cleanSender];
          if (!u && senderNumber) {
            for (const [key, val] of Object.entries(global.db?.user || {})) {
              if (extractNum(key) === senderNumber) {
                u = val;
                break;
              }
            }
          }
          const afkTime = Number(u?.afk?.afkTime || u?.afk?.time || 0);
          if (u?.afk && afkTime > 0 && Date.now() - afkTime > 3e3) {
            const seconds = Math.floor((Date.now() - afkTime) / 1e3);
            const afkDuration = formatRuntime(seconds);
            const reason = u.afk.reason || "Tanpa alasan";
            delete u.afk;
            if (global.db?.user?.[userPhoneJid]) delete global.db.user[userPhoneJid].afk;
            if (global.db?.user?.[cleanSender]) delete global.db.user[cleanSender].afk;
            if (typeof db?.write === "function") db.write(global.db);
            let actionText = "berinteraksi di chat";
            if (activityType === "composing") actionText = "mengetik pesan";
            else if (activityType === "recording") actionText = "merekam audio";
            else if (activityType === "paused") actionText = "mengetik pesan";
            else if (activityType === "reaction") actionText = "memberi reaksi emoji";
            const targetChat = chatJid ? decodeJid(chatJid) : userPhoneJid;
            const lockKey = `afk_act_${targetChat}_${senderNumber}`;
            if (acquireTypedLock("afk_activity", lockKey, 15e3)) {
              console.log(chalk.green(`[ AFK STOPPED ] @${senderNumber} terdeteksi ${actionText} di ${targetChat}`));
              await safeSendMessage(sock, targetChat, {
                text: `–  *A F K  -  S T O P P E D*\n\n` + `@${senderNumber} terdeteksi sedang *${actionText}*. Mode AFK telah dinonaktifkan.\n\n` + `┌  ◦  *Alasan* : ${reason}\n` + `└  ◦  *Lama AFK* : ${afkDuration}`,
                mentions: [userPhoneJid]
              }).catch(() => {});
            }
          } else if (u?.afk && afkTime <= 0) {
            delete u.afk;
          }
        } catch (_) {}
      };
      const onPresenceUpdate = async ({
        id,
        presences
      }) => {
        if (!presences) return;
        for (const [jid, data] of Object.entries(presences)) {
          const cleanNum = jid.split(":")[0].replace(/\D/g, "");
          const formattedJid = cleanNum ? `${cleanNum}@s.whatsapp.net` : decodeJid(jid);
          global._presenceMap.set(jid, {
            ...data,
            timestamp: Date.now()
          });
          if (cleanNum) {
            global._presenceMap.set(cleanNum, {
              ...data,
              timestamp: Date.now()
            });
          }
          if (global.db?.user?.[formattedJid]) {
            global.db.user[formattedJid].lastSeen = Date.now();
            global.db.user[formattedJid].presence = data?.lastKnownPresence || data?.presence || "available";
          }
          const currentPresence = data?.lastKnownPresence || data?.presence || "";
          if (["composing", "recording", "paused"].includes(currentPresence)) {
            await handleUserActivityAfk(id, jid, currentPresence);
          }
        }
      };
      sock.ws?.on("CB:chatstate", async node => {
        try {
          const from = node?.attrs?.from;
          const participant = node?.attrs?.participant || from;
          const tag = node?.content?.[0]?.tag || node?.tag || "composing";
          if (["composing", "recording", "paused"].includes(tag) && from && participant) {
            await handleUserActivityAfk(from, participant, tag);
          }
        } catch (_) {}
      });
      const onChatsSet = ({
        chats
      }) => {
        for (const chat of chats) {
          if (chat.id?.endsWith("@g.us") && !global.groupCache.has(chat.id)) {
            global.groupCache.set(chat.id, {
              data: chat,
              time: Date.now()
            });
          }
        }
      };
      const onChatsUpdate = updates => {
        for (const chat of updates) {
          if (chat.id?.endsWith("@g.us") && global.groupCache.has(chat.id)) {
            const cached = global.groupCache.get(chat.id);
            global.groupCache.set(chat.id, {
              data: {
                ...cached.data,
                ...chat
              },
              time: Date.now()
            });
          }
        }
      };
      const onChatsDelete = chatIds => {
        for (const id of chatIds) {
          global.groupCache.delete(jidNormalizedUser(id));
        }
      };
      const onMessagesReaction = async reactions => {
        for (const r of reactions) {
          const keyId = r.key?.id;
          if (keyId && global.msgStore.has(keyId)) {
            const cached = global.msgStore.get(keyId);
            if (cached) cached.reaction = r.reaction;
          }
          if (r.reaction) {
            const senderReaction = r.key?.participant || r.key?.remoteJid;
            await handleUserActivityAfk(r.key?.remoteJid, senderReaction, "reaction");
          }
        }
      };
      const onMessageReceiptUpdate = receipts => {
        for (const receipt of receipts) {
          const keyId = receipt.key?.id;
          if (keyId && global.msgStore.has(keyId)) {
            const cached = global.msgStore.get(keyId);
            if (cached) cached.receipt = receipt.receipt;
          }
        }
      };
      const onBlocklistSet = ({
        blocklist
      }) => {
        global.blocklist = new Set(blocklist.map(decodeJid));
      };
      const onBlocklistUpdate = ({
        blocklist,
        type
      }) => {
        global.blocklist = global.blocklist || new Set();
        for (const jid of blocklist) {
          const clean = decodeJid(jid);
          if (type === "add") global.blocklist.add(clean);
          else global.blocklist.delete(clean);
        }
      };
      sock.ev.on("creds.update", onCredsUpdate);
      sock.ev.on("connection.update", onConnectionUpdate);
      sock.ev.on("messaging-history.set", onMessagingHistorySet);
      sock.ev.on("chats.set", onChatsSet);
      sock.ev.on("chats.update", onChatsUpdate);
      sock.ev.on("messages.upsert", onMessagesUpsert);
      sock.ev.on("messages.update", onMessagesUpdate);
      sock.ev.on("messages.reaction", onMessagesReaction);
      sock.ev.on("message-receipt.update", onMessageReceiptUpdate);
      sock.ev.on("group-participants.update", onGroupParticipantsUpdate);
      sock.ev.on("groups.update", onGroupsUpdate);
      sock.ev.on("group.join-request", onGroupJoinRequest);
      sock.ev.on("presence.update", onPresenceUpdate);
      sock.ev.on("chats.delete", onChatsDelete);
      sock.ev.on("contacts.upsert", onContactsUpsert);
      sock.ev.on("contacts.update", onContactsUpdate);
      sock.ev.on("blocklist.set", onBlocklistSet);
      sock.ev.on("blocklist.update", onBlocklistUpdate);
      sock.ev.on("call", onCall);

      function detachAllEvents() {
        try {
          sock.ev.removeAllListeners();
        } catch (_) {}
      }
    };
    loadGroupCacheFromDisk();
    await start();
    setInterval(() => {
      try {
        cleanupSessionFiles(sessionDir);
      } catch (_) {}
    }, 24 * 60 * 60 * 1e3);
    setInterval(() => {
      try {
        if (!currentSock) return;
        const isSocketDead = !currentSock.ws || currentSock.ws.readyState !== 1;
        if (isSocketDead && !isRestarting) {
          console.log(chalk.yellow("⚠️ [WATCHDOG] Socket mati/terputus di background. Memulihkan..."));
          if (typeof globalReconnect === "function") {
            globalReconnect(3e3);
          }
        }
      } catch (_) {}
    }, 30 * 1e3);
    setInterval(async () => {
      try {
        if (global.db && typeof db?.write === "function") {
          await db.write(global.db);
        }
      } catch (_) {}
    }, 3e4);
    setInterval(() => {
      try {
        if (global.msgStore && global.msgStore.size > 2e3) {
          const threshold = Date.now() - 12 * 60 * 60 * 1e3;
          for (const [k, v] of global.msgStore.entries()) {
            if (v.timestamp && v.timestamp < threshold) global.msgStore.delete(k);
          }
        }
        if (global.groupCache && global.groupCache.size > 300) {
          const threshold = Date.now() - 15 * 60 * 1e3;
          for (const [k, v] of global.groupCache.entries()) {
            if (v.time && v.time < threshold) global.groupCache.delete(k);
          }
        }
        if (process.memoryUsage().rss > 450 * 1024 * 1024 && global.gc) {
          global.gc();
        }
      } catch (_) {}
    }, 15 * 60 * 1e3);
    setInterval(() => {
      try {
        if (typeof db.checkPremiumExpiry === "function") db.checkPremiumExpiry();
      } catch (_) {}
    }, 6e4);
    setInterval(async () => {
      try {
        if (global.bot?.autoBio && currentSock && currentSock.user) {
          const uptime = formatRuntime(Math.floor((Date.now() - global.botStartTime) / 1e3));
          const bioText = `– ${global.bot?.name || "Wudysoft"} • Online: ${uptime} | Prefix: [ ${global.bot?.noprefix ? "None" : "."} ]`;
          await currentSock.updateProfileStatus(bioText).catch(() => {});
        }
      } catch (_) {}
    }, 15 * 60 * 1e3);
    const scheduleNextReset = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(24, 0, 0, 0);
      setTimeout(async () => {
        try {
          const defaultLimit = global.bot?.defaultLimit || 20;
          if (typeof db.resetAllLimits === "function") db.resetAllLimits(defaultLimit);
        } catch (_) {}
        scheduleNextReset();
      }, next - now);
    };
    scheduleNextReset();
  })();