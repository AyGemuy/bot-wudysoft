import fs from "fs";
import path from "path";
import pino from "pino";
import chalk from "chalk";
import QRCode from "qrcode";
import {
  makeWASocket,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  proto,
  extractMessageContent,
  isJidBroadcast,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import {
  Boom
} from "@hapi/boom";
import {
  SerializeMessage,
  decodeJid,
  extractNum,
  unwrapMessage
} from "./serialize.js";
import {
  UpsertMsgHandle
} from "./handler.js";
import db from "../data/db.js";
const JADIBOT_DIR = path.resolve("./session_jadibot");
const MAX_ATTEMPTS = 3;
global.jadiBots = global.jadiBots || new Map();
global.botJidPool = global.botJidPool || new Set();
global.botEventLocks = global.botEventLocks || new Set();
global.reconnectTimers = global.reconnectTimers || new Map();
global.msgStore = global.msgStore || new Map();
global.lidPhoneCache = global.lidPhoneCache || new Map();
global.phoneLidCache = global.phoneLidCache || new Map();
global.jadibotGroupCache = global.jadibotGroupCache || new Map();
const JADIBOT_CACHE_FILE = path.join(process.cwd(), "data", "jadibot-group-cache.json");
const JADIBOT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1e3;

function loadJadibotGroupCache() {
  try {
    if (!fs.existsSync(JADIBOT_CACHE_FILE)) return;
    const arr = JSON.parse(fs.readFileSync(JADIBOT_CACHE_FILE, "utf-8"));
    if (!Array.isArray(arr)) return;
    const now = Date.now();
    let loaded = 0;
    for (const item of arr) {
      if (!item?.jid || item.jid.startsWith("__grp_sync__")) continue;
      if (!item.data) continue;
      if (now - (item.time || 0) >= JADIBOT_CACHE_TTL_MS) continue;
      global.jadibotGroupCache.set(item.jid, {
        data: item.data,
        time: item.time || now
      });
      loaded++;
    }
    if (loaded > 0) {
      console.log(chalk.gray(`[ JADIBOT CACHE ] `) + chalk.cyan(`Pre-loaded ${loaded} grup sub-bot dari disk.`));
    }
  } catch (_) {}
}
let _jadibotCacheSaveTimer = null;

function scheduleFlushJadibotGroupCache() {
  if (_jadibotCacheSaveTimer) return;
  _jadibotCacheSaveTimer = setTimeout(() => {
    _jadibotCacheSaveTimer = null;
    flushJadibotGroupCache();
  }, 2e3);
}
export function flushJadibotGroupCache() {
  try {
    const dir = path.dirname(JADIBOT_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, {
      recursive: true
    });
    const arr = [];
    for (const [jid, entry] of global.jadibotGroupCache.entries()) {
      if (jid.startsWith("__grp_sync__")) continue;
      arr.push({
        jid: jid,
        data: entry.data,
        time: entry.time
      });
    }
    fs.writeFileSync(JADIBOT_CACHE_FILE, JSON.stringify(arr));
  } catch (_) {}
}
if (!global.db) global.db = {};
if (!global.db.jadibot) global.db.jadibot = {};

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function ensureJadibotDir() {
  try {
    if (!fs.existsSync(JADIBOT_DIR)) {
      fs.mkdirSync(JADIBOT_DIR, {
        recursive: true
      });
    }
  } catch (_) {}
}
export function cleanJadibotSession(sessionPath) {
  try {
    if (!fs.existsSync(sessionPath)) return;
    const files = fs.readdirSync(sessionPath);
    let deleted = 0;
    for (const file of files) {
      if (file === "creds.json" || file.startsWith("app-state") || file.startsWith("pre-key")) continue;
      const filePath = path.join(sessionPath, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          fs.unlinkSync(filePath);
          deleted++;
        }
      } catch (_) {}
    }
    if (deleted > 0) {
      console.log(chalk.gray(`[ JADIBOT CLEANER ] `) + chalk.cyan(`Membersihkan ${deleted} file sampah di ${path.basename(sessionPath)}`));
    }
  } catch (_) {}
}
setInterval(() => {
  try {
    ensureJadibotDir();
    if (!fs.existsSync(JADIBOT_DIR)) return;
    const subs = fs.readdirSync(JADIBOT_DIR);
    for (const sub of subs) {
      const fullPath = path.join(JADIBOT_DIR, sub);
      if (fs.statSync(fullPath).isDirectory()) {
        cleanJadibotSession(fullPath);
      }
    }
  } catch (_) {}
}, 24 * 60 * 60 * 1e3);

function acquireLock(key, ttlMs = 5e3) {
  if (!key) return false;
  if (global.botEventLocks.has(key)) return false;
  global.botEventLocks.add(key);
  setTimeout(() => global.botEventLocks.delete(key), ttlMs);
  return true;
}

function registerBotToPool(jid) {
  if (!jid) return;
  const clean = decodeJid(jid);
  global.botJidPool.add(clean);
  const num = extractNum(clean);
  if (num) global.botJidPool.add(`${num}@s.whatsapp.net`);
}

function unregisterBotFromPool(jid) {
  if (!jid) return;
  const clean = decodeJid(jid);
  global.botJidPool.delete(clean);
  const num = extractNum(clean);
  if (num) global.botJidPool.delete(`${num}@s.whatsapp.net`);
}
loadJadibotGroupCache();
export function isSessionRegistered(number) {
  const cleanNum = String(number).replace(/\D/g, "");
  const sessionPath = path.join(JADIBOT_DIR, cleanNum, "creds.json");
  if (fs.existsSync(sessionPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(sessionPath, "utf-8"));
      return Boolean(creds && (creds.registered === true || creds.me?.id));
    } catch (_) {}
  }
  return false;
}

function closeSocketInstance(instance) {
  if (!instance || !instance.sock) return;
  try {
    if (instance.sock.user?.jid) unregisterBotFromPool(instance.sock.user.jid);
    if (instance.sock.user?.lid) unregisterBotFromPool(instance.sock.user.lid);
    instance.sock.ev.removeAllListeners();
    if (instance.sock.ws) {
      try {
        instance.sock.ws.close();
      } catch (_) {}
      try {
        instance.sock.ws.terminate?.();
      } catch (_) {}
    }
    try {
      instance.sock.end?.(undefined);
    } catch (_) {}
  } catch (_) {}
}
export async function startJadiBot(parentSock, senderJid, options = {}) {
  ensureJadibotDir();
  const cleanNum = extractNum(senderJid);
  const targetPhoneJid = `${cleanNum}@s.whatsapp.net`;
  const sessionPath = path.join(JADIBOT_DIR, cleanNum);
  const mode = (options.mode || "pair").toLowerCase();
  cleanJadibotSession(sessionPath);
  if (global.reconnectTimers.has(cleanNum)) {
    clearTimeout(global.reconnectTimers.get(cleanNum));
    global.reconnectTimers.delete(cleanNum);
  }
  if (parentSock?.user?.jid) {
    registerBotToPool(parentSock.user.jid);
  }
  if (global.jadiBots.has(cleanNum)) {
    closeSocketInstance(global.jadiBots.get(cleanNum));
    global.jadiBots.delete(cleanNum);
  }
  const {
    version
  } = await fetchLatestBaileysVersion().catch(() => ({
    version: [2, 3e3, 1015901307]
  }));
  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(sessionPath);
  if (state.creds && !state.creds.myAppStateKeyId) {
    state.creds.myAppStateKeyId = "AAAAAIDq";
  }
  global.mainBotSock = parentSock || global.mainBotSock;
  const actualParentSock = parentSock || global.mainBotSock;
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
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    keepAliveIntervalMs: 25e3,
    connectTimeoutMs: 6e4,
    defaultQueryTimeoutMs: 0,
    shouldIgnoreJid: jid => isJidBroadcast(jid) || jid?.endsWith("@newsletter"),
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
      const err = node?.attrs;
      if (err?.error === "479" || err?.code === "479") {
        const targetGroup = err.from;
        if (targetGroup?.endsWith("@g.us")) {
          global.jadibotGroupCache.delete(decodeJid(targetGroup));
        }
      }
    } catch (_) {}
  });
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
  const enrichSubBotUser = () => {
    if (!sock.user && state.creds?.me) sock.user = {
      ...state.creds.me
    };
    if (sock.user) {
      const rawId = sock.user.id || "";
      const cleanJid = decodeJid(rawId);
      const userNum = extractNum(cleanJid);
      const cleanLid = sock.user.lid ? decodeJid(sock.user.lid) : null;
      sock.user.id = rawId;
      sock.user.jid = cleanJid;
      sock.user.phoneJid = cleanJid;
      sock.user.lid = cleanLid;
      sock.user.number = userNum;
      sock.user.phone = userNum;
      registerBotToPool(cleanJid);
      if (cleanLid) registerBotToPool(cleanLid);
      if (cleanLid && cleanJid) global.lidPhoneCache.set(cleanLid, cleanJid);
    }
  };
  enrichSubBotUser();
  const botInstance = {
    sock: sock,
    userJid: targetPhoneJid,
    number: cleanNum,
    startTime: Date.now(),
    lastActivity: Date.now(),
    status: "CONNECTING",
    mode: mode,
    speed: 120,
    qrAttempts: 0,
    pairAttempts: 0,
    failAttempts: 0
  };
  const isRegistered = Boolean(state.creds && (state.creds.registered === true || state.creds.me?.id));
  if (!isRegistered && mode === "pair" && typeof options.onPairingCode === "function") {
    setTimeout(async () => {
      try {
        botInstance.pairAttempts += 1;
        if (botInstance.pairAttempts > MAX_ATTEMPTS) {
          closeSocketInstance(botInstance);
          deleteJadiBot(cleanNum);
          await parentSock?.sendMessage(targetPhoneJid, {
            text: `–  *P A I R I N G  L I M I T*\n\nBatas percobaan pairing (3/3) telah habis tanpa respon.\nSesi otomatis dibatalkan. Ketik *.jadibot pair* untuk mencoba lagi.`
          }).catch(() => {});
          return;
        }
        let code = await sock.requestPairingCode(cleanNum);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        options.onPairingCode(code, botInstance.pairAttempts, MAX_ATTEMPTS);
      } catch (err) {
        console.error(chalk.red(`[JADIBOT PAIR ERROR: ${cleanNum}]`), err.message);
      }
    }, 1200);
  }
  sock.ev.on("creds.update", async () => {
    try {
      await saveCreds();
      enrichSubBotUser();
    } catch (err) {
      console.error(chalk.red(`[JADIBOT CREDS SAVE ERROR: ${cleanNum}]`), err.message);
    }
  });
  const triggerEndlessReconnect = (delay = 3e3) => {
    if (global.reconnectTimers.has(cleanNum)) {
      clearTimeout(global.reconnectTimers.get(cleanNum));
    }
    const timer = setTimeout(() => {
      global.reconnectTimers.delete(cleanNum);
      if (isSessionRegistered(cleanNum)) {
        const activeParent = global.mainBotSock || parentSock;
        startJadiBot(activeParent, targetPhoneJid, options).catch(e => {
          console.error(chalk.red(`[JADIBOT RECONNECT ERROR: ${cleanNum}]`), e.message);
        });
      }
    }, delay);
    global.reconnectTimers.set(cleanNum, timer);
  };
  sock.ev.on("connection.update", async ({
    connection,
    lastDisconnect,
    qr
  }) => {
    if (qr && !isRegistered && mode === "qr" && typeof options.onQR === "function") {
      botInstance.qrAttempts += 1;
      if (botInstance.qrAttempts > MAX_ATTEMPTS) {
        console.log(chalk.gray(`[ JADIBOT ] `) + chalk.yellow(`Batas scan QR code tercapai: ${cleanNum}`));
        closeSocketInstance(botInstance);
        deleteJadiBot(cleanNum);
        await actualParentSock?.sendMessage(targetPhoneJid, {
          text: `–  *Q R  L I M I T*\n\nQR code tidak dipindai setelah 3x percobaan.\nSesi dibatalkan. Ketik *.jadibot qr* untuk mengulang.`
        }).catch(() => {});
        return;
      }
      try {
        const qrBuffer = await QRCode.toBuffer(qr, {
          scale: 8,
          margin: 2
        });
        options.onQR(qrBuffer, botInstance.qrAttempts, MAX_ATTEMPTS);
      } catch (err) {
        console.error(chalk.red(`[JADIBOT QR ERROR: ${cleanNum}]`), err.message);
      }
    }
    if (connection === "open") {
      botInstance.failAttempts = 0;
      enrichSubBotUser();
      botInstance.status = "ONLINE";
      botInstance.startTime = Date.now();
      botInstance.lastActivity = Date.now();
      botInstance.qrAttempts = 0;
      botInstance.pairAttempts = 0;
      setTimeout(() => {
        sock.sendPresenceUpdate("available").catch(() => {});
      }, 1500);
      setTimeout(() => {
        sock.resyncAppState(["regular_low"], false).catch(() => {});
      }, 3500);
      global.jadiBots.set(cleanNum, botInstance);
      global.db.jadibot[cleanNum] = {
        number: cleanNum,
        jid: targetPhoneJid,
        connectedAt: global.db.jadibot[cleanNum]?.connectedAt || Date.now(),
        lastActive: Date.now(),
        platform: "@whiskeysockets/baileys (MultiFile)",
        status: "ONLINE"
      };
      saveDB();
      const syncKey = `__grp_sync__${cleanNum}`;
      const lastSync = global.jadibotGroupCache.get(syncKey) || 0;
      if (Date.now() - lastSync > 60 * 60 * 1e3) {
        setTimeout(async () => {
          try {
            global.jadibotGroupCache.set(syncKey, Date.now());
            const allGroups = await sock.groupFetchAllParticipating();
            for (const [jid, meta] of Object.entries(allGroups || {})) {
              global.jadibotGroupCache.set(decodeJid(jid), {
                data: meta,
                time: Date.now()
              });
            }
            scheduleFlushJadibotGroupCache();
          } catch (_) {}
        }, 5e3);
      }
      const botName = sock.user?.name || `Sub-Bot (+${cleanNum})`;
      console.log(chalk.gray(`[ JADIBOT ] `) + chalk.green(`${botName} terhubung (Mode Numpang).`));
      setTimeout(async () => {
        await actualParentSock?.sendMessage(targetPhoneJid, {
          text: `–  *J A D I B O T  -  C O N N E C T E D*\n\nSub-Bot berhasil aktif dan menumpang pada server Bot Utama.\n\n┌  ◦  *Nomor* : +${cleanNum}\n│  ◦  *Status* : Online (Numpang)\n└  ◦  *Waktu* : ${new Date().toLocaleString("id-ID", {
timeZone: "Asia/Jakarta"
})} WIB\n\n_Ketik *.menu* untuk mulai menggunakan._`
        }).catch(() => {});
      }, 4e3);
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode ?? (lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : undefined);
      console.log(chalk.gray(`[ JADIBOT ] `) + chalk.yellow(`Koneksi terputus: ${cleanNum} (Status: ${statusCode})`));
      if (botInstance.status === "ONLINE") botInstance.status = "OFFLINE";
      if (global.db.jadibot[cleanNum]) {
        global.db.jadibot[cleanNum].status = "OFFLINE";
        global.db.jadibot[cleanNum].lastActive = Date.now();
        saveDB();
      }
      if (sock.user?.jid) unregisterBotFromPool(sock.user.jid);
      if (sock.user?.lid) unregisterBotFromPool(sock.user.lid);
      if (global.jadiBots.has(cleanNum)) global.jadiBots.delete(cleanNum);
      closeSocketInstance(botInstance);
      if (statusCode === 401 || statusCode === DisconnectReason.loggedOut) {
        if (global.reconnectTimers.has(cleanNum)) {
          clearTimeout(global.reconnectTimers.get(cleanNum));
          global.reconnectTimers.delete(cleanNum);
        }
        deleteJadiBot(cleanNum);
        await actualParentSock?.sendMessage(targetPhoneJid, {
          text: `–  *J A D I B O T  -  L O G O U T*\n\nSesi Jadibot telah keluar dari akun WhatsApp Anda. Silakan pairing ulang jika ingin menggunakan fitur ini kembali.`
        }).catch(() => {});
        return;
      }
      if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
        console.log(chalk.gray(`[ JADIBOT ] `) + chalk.cyan(`Menyimpan kredensial & restart: ${cleanNum}`));
        try {
          await saveCreds();
        } catch (_) {}
        return triggerEndlessReconnect(1e3);
      }
      if (statusCode === DisconnectReason.connectionLost || statusCode === DisconnectReason.connectionClosed || statusCode === 408 || statusCode === 428 || statusCode === 503) {
        return triggerEndlessReconnect(3e3);
      }
      if (statusCode === DisconnectReason.connectionReplaced) {
        return triggerEndlessReconnect(8e3);
      }
      if (statusCode === 403) {
        deleteJadiBot(cleanNum);
        return;
      }
      if (isSessionRegistered(cleanNum)) {
        return triggerEndlessReconnect(5e3);
      } else {
        deleteJadiBot(cleanNum);
      }
    }
  });
  sock.ev.on("messages.upsert", async ({
    type,
    messages
  }) => {
    botInstance.lastActivity = Date.now();
    if (type !== "notify" && type !== "append") return;
    const parentBotJid = decodeJid(actualParentSock?.user?.id || actualParentSock?.user?.jid || "");
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
        if (!jid || !msgId) continue;
        if (jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;
        const subBotLockKey = `jadibot_msg_${cleanNum}_${jid}_${msgId}`;
        if (!acquireLock(subBotLockKey, 4e3)) continue;
        const senderRaw = msg.key?.participant || msg.participant || jid;
        const senderClean = decodeJid(senderRaw);
        if (!msg.key.fromMe) {
          if (senderClean === parentBotJid) continue;
          if (global.botJidPool.has(senderClean)) continue;
        }
        const extracted = extractMessageContent(msg.message) || msg.message;
        if (!extracted) continue;
        if (global.bot?.autoRead !== false && !msg.key.fromMe) {
          setTimeout(() => {
            sock.readMessages([msg.key]).catch(() => {});
          }, Math.floor(Math.random() * 400) + 300);
        }
        const rawM = unwrapMessage(msg.message) || msg.message;
        if (rawM) {
          global.msgStore.set(msgId, {
            rawMessage: rawM,
            message: rawM,
            msg: msg,
            sender: senderRaw,
            timestamp: Date.now()
          });
        }
        if (msg.key?.participant && msg.key?.participant.endsWith("@lid")) {
          const rawSender = msg.participant || msg.key.participantJid || msg.key.participantAlt || jid;
          if (rawSender && !rawSender.endsWith("@lid")) {
            global.lidPhoneCache.set(decodeJid(msg.key.participant), decodeJid(rawSender));
          }
        }
        const ctx = await SerializeMessage(sock, msg);
        if (!ctx) continue;
        ctx.loader = global.loader;
        ctx.isJadiBot = true;
        ctx.jadiBotNumber = cleanNum;
        ctx.parentSock = actualParentSock;
        const _text = String(ctx.text || ctx.body || "").trim();
        const _prefixes = Array.isArray(global.bot?.prefix) ? global.bot.prefix : typeof global.bot?.prefix === "string" ? [global.bot.prefix] : [".", "!", "/", "#"];
        const _hasPrefix = _text && _prefixes.some(p => _text.startsWith(p));
        const _firstWord = _text.split(/\s+/)[0]?.toLowerCase() || "";
        const _isNoprefix = Boolean(global.bot?.noprefix && global.loader?.getCommand?.(_firstWord));
        if ((_hasPrefix || _isNoprefix) && global.bot?.autoTyping && !msg.key.fromMe) {
          sock.sendPresenceUpdate("composing", jid).catch(() => {});
          _presenceActive = true;
        }
        try {
          await UpsertMsgHandle(sock, msg, ctx, {
            cmd: global.loader
          });
        } catch (e) {
          console.error(chalk.red(`[JADIBOT ERROR +${cleanNum}]`), e.message);
        } finally {
          _pausePresence();
        }
      } catch (e) {
        _pausePresence();
      }
    }
  });
  return botInstance;
}
export async function deleteJadiBot(number) {
  const cleanNum = String(number).replace(/\D/g, "");
  const sessionPath = path.join(JADIBOT_DIR, cleanNum);
  const sessionDbKey = `jadibot_${cleanNum}`;
  if (global.reconnectTimers.has(cleanNum)) {
    clearTimeout(global.reconnectTimers.get(cleanNum));
    global.reconnectTimers.delete(cleanNum);
  }
  if (global.jadiBots.has(cleanNum)) {
    closeSocketInstance(global.jadiBots.get(cleanNum));
    global.jadiBots.delete(cleanNum);
  }
  if (global.authKeysStore?.[sessionDbKey]) {
    delete global.authKeysStore[sessionDbKey];
  }
  if (global.db?.jadibot?.[cleanNum]) {
    delete global.db.jadibot[cleanNum];
  }
  if (global.db?.auth?.[sessionDbKey]) {
    delete global.db.auth[sessionDbKey];
  }
  saveDB();
  if (fs.existsSync(sessionPath)) {
    try {
      fs.rmSync(sessionPath, {
        recursive: true,
        force: true
      });
    } catch (_) {}
  }
  return true;
}
export function stopAllJadiBots() {
  if (!global.jadiBots || !global.jadiBots.size) return;
  for (const [, timer] of global.reconnectTimers.entries()) clearTimeout(timer);
  global.reconnectTimers.clear();
  for (const [, bot] of global.jadiBots.entries()) {
    try {
      closeSocketInstance(bot);
    } catch (_) {}
  }
  global.jadiBots.clear();
  flushJadibotGroupCache();
}
export function getJadiBotsList() {
  ensureJadibotDir();
  const diskSessions = fs.existsSync(JADIBOT_DIR) ? fs.readdirSync(JADIBOT_DIR).filter(f => {
    const p = path.join(JADIBOT_DIR, f);
    try {
      return fs.statSync(p).isDirectory() && isSessionRegistered(f);
    } catch (_) {
      return false;
    }
  }) : [];
  const dbSessions = Object.keys(global.db?.jadibot || {});
  const allNumbers = [...new Set([...diskSessions, ...dbSessions])];
  return allNumbers.map(num => {
    const isLive = global.jadiBots.has(num) && global.jadiBots.get(num).status === "ONLINE";
    const instance = global.jadiBots.get(num);
    const dbRecord = global.db?.jadibot?.[num] || {};
    const connectedAt = dbRecord.connectedAt || instance?.startTime || null;
    return {
      number: num,
      jid: `${num}@s.whatsapp.net`,
      status: isLive ? "ONLINE" : "OFFLINE",
      uptime: isLive && instance?.startTime ? Date.now() - instance.startTime : 0,
      connectedAt: connectedAt,
      platform: dbRecord.platform || "@whiskeysockets/baileys (Pure DB)",
      speed: isLive ? instance?.speed || 120 : 0
    };
  });
}
export async function initAllJadiBots(parentSock) {
  ensureJadibotDir();
  global.mainBotSock = parentSock || global.mainBotSock;
  const list = getJadiBotsList();
  if (!list.length) return;
  console.log(chalk.gray(`[ JADIBOT ] `) + chalk.cyan(`Memulihkan ${list.length} sesi sub-bot secara bertahap...`));
  for (const bot of list) {
    try {
      if (isSessionRegistered(bot.number)) {
        await startJadiBot(global.mainBotSock, bot.jid, {
          mode: "pair"
        });
        await new Promise(r => setTimeout(r, 3e3));
      }
    } catch (e) {
      console.error(chalk.red(`[ JADIBOT RESTORE ERROR: ${bot.number} ]`), e.message);
    }
  }
  setTimeout(() => {
    for (const [num, inst] of global.jadiBots.entries()) {
      if (inst.status !== "ONLINE") continue;
      global.jadibotGroupCache.delete(`__grp_sync__${num}`);
    }
  }, 5e3);
}
setInterval(() => {
  try {
    if (!global.jadiBots || !global.jadiBots.size) return;
    for (const [num, inst] of global.jadiBots.entries()) {
      if (!inst.sock) continue;
      if (global.reconnectTimers.has(num)) continue;
      const isSocketDead = !inst.sock.ws || inst.sock.ws.readyState !== 1;
      if (isSocketDead && isSessionRegistered(num)) {
        console.log(chalk.yellow(`⚠️ [JADIBOT WATCHDOG] WebSocket terputus (+${num}) — Reconnecting...`));
        closeSocketInstance(inst);
        global.jadiBots.delete(num);
        startJadiBot(global.mainBotSock, inst.userJid, {
          mode: inst.mode || "pair"
        }).catch(() => {});
      }
    }
  } catch (_) {}
}, 30 * 1e3);