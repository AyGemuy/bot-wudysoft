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
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  generateMessageID,
  proto,
  initAuthCreds,
  BufferJSON,
  getAggregateVotesInPollMessage,
  jidNormalizedUser
} from "@whiskeysockets/baileys";
import {
  Boom
} from "@hapi/boom";
import chalk from "chalk";
import "./core/config.js";
import {
  SerializeMessage,
  getMessagePayload,
  downloadMediaNode,
  decodeJid,
  extractNum,
  resolveLidToJid,
  resolveLidProactively,
  copyNForward,
  unwrapMessage,
  safeSendMessage,
  safeRelayInteractive,
  resizeImage,
  applyButtonsToBuilder,
  Button,
  ButtonV2,
  Carousel,
  AIRich,
  Toolkit
} from "./core/serialize.js";
import {
  CommandLoader
} from "./core/loader.js";
import {
  UpsertMsgHandle
} from "./core/handler.js";
import {
  initAllJadiBots
} from "./core/jadibot.js";
import db from "./data/db.js";
const WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
const GROUP_NOTIF_MAX = 5;
global.msgStore = global.msgStore || new Map();
global.lidPhoneCache = global.lidPhoneCache || new Map();
global.groupCache = global.groupCache || new Map();
global.lastConnectNotice = global.lastConnectNotice || 0;
global.botStartTime = Date.now();
global.botJidPool = global.botJidPool || new Set();
global.botEventLocks = global.botEventLocks || new Set();
let currentSock = null;
const withTimeout = (promise, ms = 5e3) => {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise.catch(() => null), timeout]).finally(() => clearTimeout(timer));
};
export const useDBAuthState = async (sessionKey = "main_session", sessionDir = path.join(process.cwd(), "session")) => {
  if (!global.db) global.db = {};
  if (!global.db.auth) global.db.auth = {};
  let creds = null;
  let keysStore = {};
  if (global.db.auth[sessionKey]?.creds) {
    try {
      creds = JSON.parse(JSON.stringify(global.db.auth[sessionKey].creds), BufferJSON.reviver);
      keysStore = global.db.auth[sessionKey].keys || {};
    } catch (_) {}
  }
  const credsPath = path.join(sessionDir, "creds.json");
  if ((!creds || !creds.registered && !creds.me?.id) && fs.existsSync(credsPath)) {
    try {
      const fileData = fs.readFileSync(credsPath, "utf-8");
      creds = JSON.parse(fileData, BufferJSON.reviver);
      console.log(chalk.gray(`[ AUTH ]`) + chalk.green(` Sesi ${sessionKey} berhasil dimuat dari creds.json`));
    } catch (e) {
      console.error(chalk.red(`[ AUTH ERROR ] Gagal membaca ${credsPath}:`), e.message);
    }
  }
  if (!creds) {
    creds = initAuthCreds();
  }
  global.db.auth[sessionKey] = {
    creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
    keys: keysStore
  };
  const saveCreds = () => {
    global.db.auth[sessionKey].creds = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
    if (typeof db?.write === "function") {
      db.write(global.db);
    }
    try {
      if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, {
        recursive: true
      });
      fs.writeFileSync(credsPath, JSON.stringify(creds, BufferJSON.replacer, 2));
    } catch (_) {}
  };
  return {
    state: {
      creds: creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          for (const id of ids) {
            const key = `${type}-${id}`;
            let val = keysStore[key];
            if (!val) {
              const oldFilePath = path.join(sessionDir, `${key}.json`);
              if (fs.existsSync(oldFilePath)) {
                try {
                  const content = fs.readFileSync(oldFilePath, "utf-8");
                  val = JSON.parse(content, BufferJSON.reviver);
                  keysStore[key] = JSON.parse(JSON.stringify(val, BufferJSON.replacer));
                  try {
                    fs.unlinkSync(oldFilePath);
                  } catch (_) {}
                } catch (_) {}
              }
            }
            if (val) {
              try {
                let parsed = typeof val === "string" ? JSON.parse(val, BufferJSON.reviver) : JSON.parse(JSON.stringify(val), BufferJSON.reviver);
                if (type === "app-state-sync-key" && parsed) {
                  parsed = proto.Message.AppStateSyncKeyData.fromObject(parsed);
                }
                data[id] = parsed;
              } catch (_) {}
            }
          }
          return data;
        },
        set: async data => {
          for (const type in data) {
            for (const id in data[type]) {
              const key = `${type}-${id}`;
              const val = data[type][id];
              if (val) {
                keysStore[key] = JSON.parse(JSON.stringify(val, BufferJSON.replacer));
              } else {
                delete keysStore[key];
              }
            }
          }
          global.db.auth[sessionKey].keys = keysStore;
        }
      }
    },
    saveCreds: saveCreds,
    clearAuth: () => {
      delete global.db.auth[sessionKey];
      if (typeof db?.write === "function") db.write(global.db);
      try {
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, {
            recursive: true,
            force: true
          });
        }
      } catch (_) {}
    }
  };
};

function cleanObsoleteSessionFiles(sessionDir) {
  try {
    if (!fs.existsSync(sessionDir)) return;
    const files = fs.readdirSync(sessionDir);
    let deletedCount = 0;
    for (const file of files) {
      if (file === "creds.json" || file.startsWith("app-state-sync-version")) {
        continue;
      }
      if (file.startsWith("pre-key-") || file.startsWith("sender-key-") || file.startsWith("session-")) {
        const filePath = path.join(sessionDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (_) {}
      }
    }
    if (deletedCount > 0) {
      console.log(chalk.gray(`[ CLEANER ]`) + chalk.cyan(` Dihapus ${deletedCount} file session lama dari disk (Anti-ENOSPC).`));
    }
  } catch (_) {}
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
async function getAvatar(sock, id, fallback) {
  if (!id || String(id).includes("@lid")) return fallback;
  try {
    return await sock.profilePictureUrl(id, "image") || fallback;
  } catch {
    return fallback;
  }
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
  console.log(chalk.yellow(`\n[ SYSTEM ] Sinyal ${signal} diterima. Menyimpan database & mematikan proses...`));
  try {
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
process.on("uncaughtException", err => {
  console.error(chalk.redBright("[ ANTI-CRASH Exception ]:"), err?.message || err);
});
process.on("unhandledRejection", reason => {
  console.error(chalk.redBright("[ ANTI-CRASH Rejection ]:"), reason?.message || reason);
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
  const meta = await withTimeout(sock.groupMetadata(normId).catch(() => null), 5e3);
  if (meta) {
    global.groupCache.set(normId, {
      data: meta,
      time: Date.now()
    });
  }
  return meta;
}
const getTargetOwnerJid = sock => {
  const rawOwner = Array.isArray(global.bot?.owner) ? global.bot.owner[0] : global.bot?.owner;
  if (!rawOwner) return sock.user?.jid;
  const cleanNum = String(rawOwner).replace(/\D/g, "");
  return cleanNum ? `${cleanNum}@s.whatsapp.net` : sock.user?.jid;
};

function buildGroupNotif(action, userNum, groupName, totalMember, actorTag = "Admin") {
  if (action === "add") {
    return {
      title: "–  W E L C O M E",
      subtitle: `Member Baru di ${groupName}`,
      canvasTitle: "WELCOME",
      cardStatus: "ACTIVE",
      bodyText: `–  *W E L C O M E*\n\n` + `Halo @${userNum}, selamat datang di *${groupName}*.\n\n` + `┌  ◦  *User* : @${userNum}\n` + `│  ◦  *Members* : ${totalMember} Anggota\n` + `└  ◦  *Group* : ${groupName}\n\n` + `“ Patuhi tata tertib yang berlaku dan semoga betah di grup ini. ”`,
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
      bodyText: `–  *G O O D B Y E*\n\n` + `Selamat tinggal @${userNum}, telah keluar dari *${groupName}*.\n\n` + `┌  ◦  *User* : @${userNum}\n` + `└  ◦  *Sisa Member* : ${totalMember} Anggota\n\n` + `“ Terima kasih telah menjadi bagian dari grup ini. ”`,
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
      bodyText: `–  *P R O M O T E*\n\n` + `Selamat kepada @${userNum}, sekarang resmi menjadi admin di grup *${groupName}*.\n\n` + `┌  ◦  *User* : @${userNum}\n` + `│  ◦  *Action By* : ${actorTag}\n` + `└  ◦  *Group* : ${groupName}`,
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
      bodyText: `–  *D E M O T E*\n\n` + `Pemberitahuan untuk @${userNum}, status admin kamu telah dicabut di grup *${groupName}*.\n\n` + `┌  ◦  *User* : @${userNum}\n` + `│  ◦  *Action By* : ${actorTag}\n` + `└  ◦  *Group* : ${groupName}`,
      buttons: [{
        name: "quick_reply",
        display_text: "Menu Utama",
        id: ".menu"
      }]
    };
  }
  return null;
}
async function generateWelcomeCard({
  group_avatar,
  group_name = "Grup WhatsApp",
  status_dot = "On",
  avatar,
  status = "ACTIVE",
  userid,
  usertype = "netizen",
  title = "Welcome",
  username = "User",
  message = "Welcome to this server!",
  foot_up = "Terhubung ke Jaringan WhatsApp",
  foot_end = `Hak Cipta © ${new Date().getFullYear()}, ${global.bot?.name || "Cyberdyne Systems"}`,
  model
}) {
  try {
    const baseApi = (global.bot?.api?.wudysoft || "").replace(/\/+$/, "");
    const selectedModel = model ?? Math.floor(Math.random() * 17) + 1;
    const uniqueUserId = userid || `UID-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const payload = {
      group_avatar: group_avatar || "https://files.catbox.moe/g2e6i5.jpg",
      group_name: String(group_name || "WhatsApp Group"),
      status_dot: String(status_dot),
      avatar: avatar || "https://files.catbox.moe/8ugr9a.jpg",
      status: String(status),
      userid: uniqueUserId,
      usertype: String(usertype),
      title: String(title),
      username: String(username),
      message: String(message),
      foot_up: String(foot_up),
      foot_end: String(foot_end),
      model: Number(selectedModel)
    };
    const response = await axios.post(`${baseApi}/api/maker/welcome/v1`, payload, {
      responseType: "arraybuffer",
      headers: {
        "Content-Type": "application/json",
        Accept: "image/*, application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 3e4,
      validateStatus: s => s >= 200 && s < 400
    });
    if (!response?.data) return null;
    const buf = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
    try {
      const textPreview = buf.toString("utf-8", 0, Math.min(buf.length, 500)).trim();
      if (textPreview.startsWith("{") && textPreview.includes("}")) {
        const json = JSON.parse(buf.toString("utf-8"));
        const imgUrl = json.url || json.result?.url || json.data?.url || (typeof json.result === "string" && json.result.startsWith("http") ? json.result : null);
        if (imgUrl) {
          const fetchImg = await axios.get(imgUrl, {
            responseType: "arraybuffer",
            timeout: 15e3
          });
          return Buffer.from(fetchImg.data);
        }
        const base64Data = json.base64 || json.result?.base64 || json.data?.base64;
        if (base64Data) {
          return Buffer.from(base64Data.replace(/^data:image\/\w+;base64,/, ""), "base64");
        }
        return null;
      }
    } catch (_) {}
    if (buf.length > 512 && [137, 255, 82, 71].includes(buf[0])) {
      return buf;
    }
    return null;
  } catch (err) {
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
    } catch (err) {
      return null;
    }
  }
  (async () => {
    const sessionDir = path.join(process.cwd(), "session");
    cleanObsoleteSessionFiles(sessionDir);
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
  –  ${chalk.bold(global.bot?.name || "WUDYSOFT")} (v${global.bot?.versions || "2.0.0"})
  
  ┌  ◦  Engine   : ${chalk.green("Pure Memory / Cloud DB")}
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
      } = await fetchLatestBaileysVersion ? await fetchLatestBaileysVersion() : await fetchLatestBaileysVersion();
      const {
        state,
        saveCreds,
        clearAuth
      } = await useDBAuthState("main_session", sessionDir);
      const isRegistered = Boolean(state.creds && (state.creds.registered === true || Boolean(state.creds.me?.id) || Boolean(state.creds.account)));
      if (!isRegistered && selectedPairing === null) {
        console.log(chalk.gray(`\n–  Konfigurasi Sambungan`));
        const mode = await ask(chalk.gray("   Gunakan pairing code? (yes/no): "));
        selectedPairing = mode.trim().toLowerCase() === "yes";
      }
      const pairing = !isRegistered && (selectedPairing ?? false);
      const sock = makeWASocket({
        version: version,
        logger: pino({
          level: "silent"
        }),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({
            level: "silent"
          }))
        },
        browser: Browsers.ubuntu("Chrome"),
        generateHighQualityLinkPreview: true,
        keepAliveIntervalMs: 3e4,
        markOnlineOnConnect: true,
        getMessage: async key => {
          if (!key?.id) return undefined;
          const cached = global.msgStore?.get(key.id);
          if (cached) {
            const raw = cached.rawMessage || cached.message || cached.msg?.message || cached.msg;
            if (raw) return proto.Message.fromObject(raw);
          }
          return undefined;
        },
        humanize: true
      });
      currentSock = sock;
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
          const code = await sock.requestPairingCode(cleanNumber);
          console.log(chalk.cyan(`\n┌  ◦  PAIRING CODE : `) + chalk.bold.white(code) + chalk.cyan(`\n└  ◦  Masukkan kode ini pada perangkat Anda.\n`));
        } catch (e) {
          console.error(chalk.red(`[ PAIRING ERROR ]`), e.message);
        }
      }
      let isRestarting = false;
      const reconnect = async (delayTime = 2e3) => {
        if (isRestarting) return;
        isRestarting = true;
        detachAllEvents();
        await sleep(delayTime);
        return start();
      };
      const onCredsUpdate = async () => {
        saveCreds();
        enrichSockUser();
      };
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
          switch (reason) {
            case 408:
              return reconnect(2e3);
            case 503:
              return reconnect(3e3);
            case 428:
              return reconnect(2e3);
            case 515:
              return reconnect(1500);
            case DisconnectReason.connectionReplaced:
              return reconnect(5e3);
            case DisconnectReason.connectionLost:
              return reconnect(2e3);
            case 401:
            case DisconnectReason.loggedOut:
              clearAuth();
              selectedPairing = null;
              if (process.send) process.send("reset");
              return reconnect(3e3);
            case 403:
              clearAuth();
              selectedPairing = null;
              if (process.send) process.send("reset");
              return reconnect(5e3);
            case 405:
              clearAuth();
              selectedPairing = null;
              if (process.send) process.send("reset");
              return reconnect(3e3);
            default:
              return reconnect(2500);
          }
        }
        if (connection === "open") {
          isRestarting = false;
          enrichSockUser();
          sock.sendPresenceUpdate("available").catch(() => {});
          const botPhone = sock.user?.number || sock.user?.jid?.split("@")[0] || "Unknown";
          const botPushName = sock.user?.name || global.bot?.name || "Bot";
          console.log(chalk.green(`\n[ CONNECTED ] `) + chalk.white(`${botPushName} (+${botPhone}) siap digunakan.`));
          if (typeof initAllJadiBots === "function") {
            initAllJadiBots(sock).catch(e => {
              console.error(chalk.red("[JADIBOT INIT ERROR]"), e.message);
            });
          }
          setImmediate(async () => {
            if (global.isFirstConnectDone) return;
            global.isFirstConnectDone = true;
            const targetJid = getTargetOwnerJid(sock);
            if (targetJid) {
              const ramUsed = formatSize(process.memoryUsage().rss);
              const totalRam = formatSize(os.totalmem());
              await safeSendMessage(sock, targetJid, {
                text: `–  *B O T  C O N N E C T E D*\n\n` + `Bot berhasil tersambung ke jaringan WhatsApp.\n\n` + `┌  ◦  *Bot* : ${botPushName}\n` + `│  ◦  *RAM* : ${ramUsed} / ${totalRam}\n` + `└  ◦  *Time* : ${new Date().toLocaleTimeString("id-ID", {
timeZone: "Asia/Jakarta"
})} WIB`
              }).catch(() => {});
              const zipBuffer = await createSessionZip(sessionDir);
              if (zipBuffer) {
                await safeSendMessage(sock, targetJid, {
                  document: zipBuffer,
                  mimetype: "application/zip",
                  fileName: `creds_${botPhone}.zip`,
                  caption: `–  *B A C K U P  C R E D S*`
                }).catch(() => {});
              }
            }
          });
        }
      };
      const onMessagesUpsert = async ({
        type,
        messages
      }) => {
        if (type !== "notify" && type !== "append") return;
        for (const msg of messages) {
          try {
            const jid = msg.key?.remoteJid;
            const msgId = msg.key?.id;
            if (!jid || !msgId) continue;
            if (jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;
            const senderRaw = msg.key?.participant || msg.participant || jid;
            const senderClean = decodeJid(senderRaw);
            if (!msg.key.fromMe && global.botJidPool.has(senderClean)) {
              continue;
            }
            const isGroup = jid.endsWith("@g.us");
            const msgLockType = isGroup ? `msg_grp_${type}` : `msg_pvt_${type}`;
            if (!acquireTypedLock(msgLockType, `${jid}_${msgId}`, 1e4)) {
              continue;
            }
            const rawM = unwrapMessage(msg.message) || msg.message;
            if (rawM) {
              global.msgStore.set(msgId, {
                rawMessage: rawM,
                message: rawM,
                msg: msg,
                sender: msg.key.participant || jid,
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
            const ctx = await SerializeMessage(sock, msg);
            if (!ctx) continue;
            ctx.loader = loader;
            UpsertMsgHandle(sock, msg, ctx, {
              cmd: loader
            }).catch(e => {
              console.error(chalk.red("[HANDLER ERROR]"), e.message);
            });
          } catch (e) {
            console.error(chalk.redBright("[ MSG ERROR ]"), e.message);
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
              if (acquireTypedLock("poll_vote", `${chatId}_${keyId}`, 2e3)) {
                const pollCreation = cached?.message || cached?.rawMessage;
                if (pollCreation) {
                  const aggregate = getAggregateVotesInPollMessage({
                    message: pollCreation,
                    pollUpdates: update.pollUpdates
                  });
                  if (cached) cached.pollVotes = aggregate;
                }
              }
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
                  let resolved = await resolveLidToJid(senderJid, sock);
                  if (resolved.endsWith("@lid") && typeof resolveLidProactively === "function") {
                    const pro = await resolveLidProactively(sock, resolved);
                    if (pro.jid) resolved = pro.jid;
                  }
                  senderJid = resolved;
                }
                const senderNum = extractNum(senderJid) || senderJid?.split("@")[0] || "Unknown";
                const deleteTime = new Date().toLocaleTimeString("id-ID", {
                  timeZone: "Asia/Jakarta"
                });
                const noticeText = `–  *A N T I - D E L E T E*\n\n` + `Terdeteksi pesan yang baru saja dihapus oleh pengirim.\n\n` + `┌  ◦  *Sender* : @${senderNum}\n` + `└  ◦  *Time* : ${deleteTime} WIB\n\n` + `_Pesan asli yang dihapus diteruskan di bawah ini:_`;
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
          if (typeof db.ensureGroup === "function") {
            db.ensureGroup(cleanChatId);
          }
          const cfg = global.db?.group?.[cleanChatId] || {};
          const enabled = action === "add" ? cfg.welcome !== false : action === "remove" ? cfg.leave !== false && cfg.goodbye !== false : cfg.detect !== false;
          if (!enabled) return;
          const jids = (participants || []).map(p => typeof p === "string" ? p : p?.phoneNumber || p?.id || p?.jid || "").filter(Boolean).slice(0, GROUP_NOTIF_MAX);
          if (!jids.length) return;
          const defaultBackground = global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
          const defaultAvatar = global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
          const [metadata, groupPic] = await Promise.all([withTimeout(getFastGroupMetadata(sock, cleanChatId, false), 5e3), getAvatar(sock, cleanChatId, defaultBackground)]);
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
          await Promise.allSettled(jids.map(async rawUser => {
            let cleanUserJid = decodeJid(rawUser);
            if (cleanUserJid.endsWith("@lid")) {
              let resolvedUser = await resolveLidToJid(cleanUserJid, sock, null, metadata?.participants || []);
              if (resolvedUser.endsWith("@lid") && typeof resolveLidProactively === "function") {
                const pro = await resolveLidProactively(sock, resolvedUser);
                if (pro.jid) resolvedUser = pro.jid;
              }
              cleanUserJid = resolvedUser;
            }
            const lockType = `ptcp_${action}`;
            if (!acquireTypedLock(lockType, `${cleanChatId}_${cleanUserJid}`, 7e3)) {
              return;
            }
            const userNum = extractNum(cleanUserJid) || cleanUserJid.split("@")[0];
            const notif = buildGroupNotif(action, userNum, groupName, totalMember, actorTag);
            if (!notif) return;
            let bodyText = notif.bodyText;
            const contextData = {
              user: cleanUserJid,
              group: groupName,
              desc: metadata.desc || "",
              total: totalMember,
              admin: actorJid ? `@${extractNum(actorJid)}` : ""
            };
            if (action === "add" && typeof cfg.welcome === "string" && cfg.welcome.trim().length > 0) {
              bodyText = replacePlaceholders(cfg.welcome, contextData);
            } else if (action === "remove") {
              const customLeave = typeof cfg.leave === "string" ? cfg.leave : typeof cfg.goodbye === "string" ? cfg.goodbye : null;
              if (customLeave && customLeave.trim().length > 0) {
                bodyText = replacePlaceholders(customLeave, contextData);
              }
            }
            const mentions = [cleanUserJid];
            if (actorJid && actorJid !== cleanUserJid) mentions.push(actorJid);
            const bannerImage = await withTimeout(generateWelcomeCard({
              group_avatar: groupPic,
              group_name: groupName,
              avatar: defaultAvatar,
              status: notif.cardStatus,
              title: notif.canvasTitle,
              username: `@${userNum.slice(0, 12)}`
            }), 1e4).catch(() => null);
            await sendGroupCtaMessage(sock, cleanChatId, {
              title: notif.title,
              subtitle: notif.subtitle,
              body: bodyText,
              footer: `${groupName} • ${totalMember} Members`,
              media: bannerImage || groupPic,
              buttons: notif.buttons,
              mentions: mentions
            });
          }));
        } catch (err) {
          console.error(chalk.red("[PARTICIPANTS UPDATE ERROR]:"), err?.message || err);
        }
      };
      const onGroupsUpdate = async groupUpdates => {
        for (const update of groupUpdates) {
          const id = update.id;
          if (!id) continue;
          const cleanChatId = decodeJid(id);
          const normId = jidNormalizedUser(id);
          const oldCachedMeta = global.groupCache.get(normId)?.data || global.groupCache.get(cleanChatId)?.data || null;
          const cfg = global.db?.group?.[cleanChatId] || global.db?.group?.[id] || {};
          const isDetect = cfg.detect !== false;
          let title = "";
          let subtitle = "";
          let body = "";
          let updateType = "";
          if (update.subject && oldCachedMeta?.subject && update.subject !== oldCachedMeta.subject) {
            updateType = "subject";
            title = "–  S U B J E C T  U P D A T E";
            subtitle = update.subject;
            body = `Nama grup telah diperbarui menjadi:\n*${update.subject}*`;
          } else if (update.desc !== undefined && oldCachedMeta && update.desc !== (oldCachedMeta.desc || "")) {
            updateType = "desc";
            title = "–  D E S C  U P D A T E";
            subtitle = oldCachedMeta?.subject || update.subject || "Grup WhatsApp";
            body = update.desc ? `Deskripsi grup telah diperbarui:\n\n${update.desc}` : `Deskripsi grup telah dikosongkan oleh Admin.`;
          } else if (update.announce !== undefined && oldCachedMeta?.announce !== undefined && Boolean(update.announce) !== Boolean(oldCachedMeta.announce)) {
            updateType = "announce";
            const isClosed = Boolean(update.announce);
            title = isClosed ? "–  G R O U P  C L O S E D" : "–  G R O U P  O P E N E D";
            subtitle = isClosed ? "Hanya Admin Yang Bisa Chat" : "Semua Anggota Bisa Chat";
            body = isClosed ? `Grup telah ditutup oleh Admin.\nSekarang hanya admin yang dapat mengirim pesan.` : `Grup telah dibuka kembali oleh Admin.\nSekarang seluruh anggota dapat mengirim pesan.`;
          } else if (update.restrict !== undefined && oldCachedMeta?.restrict !== undefined && Boolean(update.restrict) !== Boolean(oldCachedMeta.restrict)) {
            updateType = "restrict";
            const isRestricted = Boolean(update.restrict);
            title = isRestricted ? "–  I N F O  R E S T R I C T E D" : "–  I N F O  U N L O C K E D";
            subtitle = isRestricted ? "Hanya Admin Yang Bisa Edit Info" : "Semua Anggota Bisa Edit Info";
            body = isRestricted ? `Setelan grup diperbarui.\nSekarang hanya Admin yang dapat mengubah info grup ini.` : `Setelan grup diperbarui.\nSekarang semua anggota dapat mengubah info grup ini.`;
          } else if (update.ephemeralDuration !== undefined && oldCachedMeta?.ephemeralDuration !== undefined && update.ephemeralDuration !== oldCachedMeta.ephemeralDuration) {
            updateType = "ephemeral";
            const dur = update.ephemeralDuration;
            const durText = dur === 0 ? "Nonaktif" : dur >= 86400 ? `${dur / 86400} Hari` : `${dur / 3600} Jam`;
            title = "–  E P H E M E R A L";
            subtitle = "Disappearing Messages";
            body = `Fitur pesan sementara telah disetel menjadi: *${durText}*`;
          } else if (update.joinApprovalMode !== undefined && oldCachedMeta?.joinApprovalMode !== undefined && Boolean(update.joinApprovalMode) !== Boolean(oldCachedMeta.joinApprovalMode)) {
            updateType = "approval";
            const isApproval = Boolean(update.joinApprovalMode);
            title = "–  M E M B E R S H I P  A P P R O V A L";
            subtitle = "Membership Approval";
            body = `Mode persetujuan admin untuk anggota baru sekarang: *${isApproval ? "Aktif (Wajib ACC)" : "Nonaktif (Langsung Masuk)"}*`;
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
          }
          if (global.db?.group?.[cleanChatId]) {
            if (update.subject) global.db.group[cleanChatId].subject = update.subject;
            if (update.desc !== undefined) global.db.group[cleanChatId].desc = update.desc;
            if (update.announce !== undefined) global.db.group[cleanChatId].announce = update.announce;
            if (update.restrict !== undefined) global.db.group[cleanChatId].restrict = update.restrict;
            if (typeof db?.write === "function") db.write(global.db);
          }
          if (!isDetect || !title || !updateType) continue;
          const groupName = currentMeta?.subject || update.subject || "Grup WhatsApp";
          let groupPic = "https://files.catbox.moe/g2e6i5.jpg";
          try {
            groupPic = await sock.profilePictureUrl(cleanChatId, "image").catch(() => global.bot?.media?.banner2 || groupPic);
          } catch (_) {}
          if (!acquireTypedLock(`grp_meta_${updateType}`, `${cleanChatId}_${updateType}`, 6e3)) {
            continue;
          }
          await sendGroupCtaMessage(sock, cleanChatId, {
            title: title,
            subtitle: subtitle,
            body: body,
            footer: groupName,
            media: groupPic,
            buttons: [{
              name: "quick_reply",
              display_text: "Menu",
              id: ".menu"
            }]
          });
        }
      };
      const onGroupJoinRequest = async ({
        id,
        author,
        participant,
        action
      }) => {
        try {
          const cleanChatId = decodeJid(id);
          const cleanPart = decodeJid(participant);
          if (!acquireTypedLock(`joinreq_${action}`, `${cleanChatId}_${cleanPart}`, 8e3)) {
            return;
          }
          const metadata = await getFastGroupMetadata(sock, id, false);
          const groupName = metadata?.subject || "Group WhatsApp";
          let groupPic = "https://files.catbox.moe/g2e6i5.jpg";
          try {
            groupPic = await sock.profilePictureUrl(id, "image").catch(() => global.bot?.media?.banner2 || groupPic);
          } catch (_) {}
          let userJid = await resolveLidToJid(cleanPart, sock, null, metadata?.participants || []);
          if (userJid && userJid.endsWith("@lid")) {
            if (typeof resolveLidProactively === "function") {
              const pro = await resolveLidProactively(sock, userJid);
              if (pro.jid) userJid = pro.jid;
            }
            if (userJid.endsWith("@lid")) {
              const num = extractNum(userJid);
              userJid = num ? `${num}@s.whatsapp.net` : null;
            }
          }
          const userNum = extractNum(userJid) || userJid?.split("@")[0] || "User";
          const cfg = global.db?.group?.[id] || {};
          if (cfg.detect === false) return;
          if (action === "created") {
            const body = `Permintaan bergabung baru ke dalam grup.\n\n` + `┌  ◦  *User* : @${userNum}\n` + `└  ◦  *Group* : *${groupName}*\n\n` + `_Harap admin meninjau permintaan bergabung ini._`;
            await sendGroupCtaMessage(sock, id, {
              title: "–  J O I N  R E Q U E S T",
              subtitle: groupName,
              body: body,
              footer: "Membership Approval",
              media: groupPic,
              buttons: [{
                name: "quick_reply",
                display_text: "Cek Request",
                id: ".listrequest"
              }],
              mentions: [userJid]
            });
          }
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
      sock.ev.on("messages.upsert", onMessagesUpsert);
      sock.ev.on("messages.update", onMessagesUpdate);
      sock.ev.on("messages.reaction", onMessagesReaction);
      sock.ev.on("message-receipt.update", onMessageReceiptUpdate);
      sock.ev.on("group-participants.update", onGroupParticipantsUpdate);
      sock.ev.on("groups.update", onGroupsUpdate);
      sock.ev.on("group.join-request", onGroupJoinRequest);
      sock.ev.on("chats.delete", onChatsDelete);
      sock.ev.on("contacts.upsert", onContactsUpsert);
      sock.ev.on("contacts.update", onContactsUpdate);
      sock.ev.on("blocklist.set", onBlocklistSet);
      sock.ev.on("blocklist.update", onBlocklistUpdate);
      sock.ev.on("call", onCall);

      function detachAllEvents() {
        sock.ev.off("creds.update", onCredsUpdate);
        sock.ev.off("connection.update", onConnectionUpdate);
        sock.ev.off("messages.upsert", onMessagesUpsert);
        sock.ev.off("messages.update", onMessagesUpdate);
        sock.ev.off("messages.reaction", onMessagesReaction);
        sock.ev.off("message-receipt.update", onMessageReceiptUpdate);
        sock.ev.off("group-participants.update", onGroupParticipantsUpdate);
        sock.ev.off("groups.update", onGroupsUpdate);
        sock.ev.off("group.join-request", onGroupJoinRequest);
        sock.ev.off("chats.delete", onChatsDelete);
        sock.ev.off("contacts.upsert", onContactsUpsert);
        sock.ev.off("contacts.update", onContactsUpdate);
        sock.ev.off("blocklist.set", onBlocklistSet);
        sock.ev.off("blocklist.update", onBlocklistUpdate);
        sock.ev.off("call", onCall);
      }
    };
    await start();
    setInterval(() => {
      try {
        if (currentSock?.ws?.isOpen && currentSock.user) {
          currentSock.sendPresenceUpdate("available").catch(() => {});
        }
      } catch (_) {}
    }, 5 * 60 * 1e3);
    setInterval(async () => {
      try {
        if (global.db && typeof db?.write === "function") {
          await db.write(global.db);
        }
      } catch (_) {}
    }, 3e4);
    setInterval(() => {
      try {
        if (global.msgStore && global.msgStore.size > 2500) {
          const threshold = Date.now() - 24 * 60 * 60 * 1e3;
          for (const [k, v] of global.msgStore.entries()) {
            if (v.timestamp && v.timestamp < threshold) global.msgStore.delete(k);
          }
        }
        if (global.groupCache && global.groupCache.size > 500) {
          const threshold = Date.now() - 10 * 60 * 1e3;
          for (const [k, v] of global.groupCache.entries()) {
            if (v.time && v.time < threshold) global.groupCache.delete(k);
          }
        }
      } catch (_) {}
    }, 60 * 60 * 1e3);
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