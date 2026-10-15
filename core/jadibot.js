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
  getAggregateVotesInPollMessage,
  jidNormalizedUser
} from "@whiskeysockets/baileys";
import {
  Boom
} from "@hapi/boom";
import {
  SerializeMessage,
  decodeJid,
  extractNum
} from "./serialize.js";
import {
  UpsertMsgHandle
} from "./handler.js";
import db from "../data/db.js";
import {
  useDBAuthState
} from "../index.js";
const JADIBOT_DIR = path.resolve("./session_jadibot");
const MAX_ATTEMPTS = 3;
global.jadiBots = global.jadiBots || new Map();
global.botJidPool = global.botJidPool || new Set();
global.botEventLocks = global.botEventLocks || new Set();
global.reconnectTimers = global.reconnectTimers || new Map();
global.msgStore = global.msgStore || new Map();
global.lidPhoneCache = global.lidPhoneCache || new Map();
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

function cleanJadibotSession(sessionPath) {
  try {
    if (!fs.existsSync(sessionPath)) return;
    const files = fs.readdirSync(sessionPath);
    for (const file of files) {
      if (file === "creds.json" || file.startsWith("app-state-sync-version")) {
        continue;
      }
      if (file.startsWith("pre-key-") || file.startsWith("sender-key-") || file.startsWith("session-")) {
        const filePath = path.join(sessionPath, file);
        try {
          fs.unlinkSync(filePath);
        } catch (_) {}
      }
    }
  } catch (_) {}
}

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
export function isSessionRegistered(number) {
  const cleanNum = String(number).replace(/\D/g, "");
  const authRecord = global.db?.auth?.[`jadibot_${cleanNum}`]?.creds;
  if (authRecord && (authRecord.registered === true || authRecord.me?.id)) {
    return true;
  }
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
    if (instance.sock.user?.jid) {
      unregisterBotFromPool(instance.sock.user.jid);
    }
    if (instance.sock.user?.lid) {
      unregisterBotFromPool(instance.sock.user.lid);
    }
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

function cloneSock(parentSock, sock) {
  if (!parentSock) return sock;
  const parentProto = Object.getPrototypeOf(parentSock) || {};
  const allProps = new Set([...Object.getOwnPropertyNames(parentSock), ...Object.getOwnPropertyNames(parentProto)]);
  const blacklist = ["ws", "ev", "authState", "signalRepository", "user", "creds", "end", "logout", "destroy", "close", "on", "emit", "removeAllListeners"];
  for (const prop of allProps) {
    if (blacklist.includes(prop)) continue;
    try {
      if (typeof parentSock[prop] === "function" && !(prop in sock)) {
        sock[prop] = parentSock[prop].bind(sock);
      } else if (!(prop in sock)) {
        sock[prop] = parentSock[prop];
      }
    } catch (_) {}
  }
  return sock;
}

function cloneEvents(parentSock, sock) {
  if (!parentSock?.ev) return;
  const eventNames = parentSock.ev.eventNames ? parentSock.ev.eventNames() : Object.keys(parentSock.ev._events || {});
  const isolatedEvents = ["connection.update", "creds.update", "messages.upsert", "close"];
  for (const event of eventNames) {
    if (isolatedEvents.includes(event)) continue;
    const listeners = parentSock.ev.rawListeners ? parentSock.ev.rawListeners(event) : parentSock.ev.listeners ? parentSock.ev.listeners(event) : [];
    for (const listener of listeners) {
      sock.ev.on(event, (...args) => {
        try {
          const arg0 = args[0] || {};
          if (event === "group-participants.update") {
            const {
              id,
              action,
              participants = []
            } = arg0;
            const cleanChatId = decodeJid(id);
            const jids = (participants || []).map(p => typeof p === "string" ? p : p?.phoneNumber || p?.id || p?.jid || "").filter(Boolean).map(decodeJid);
            const lockKey = `ptcp_${cleanChatId}_${action}_${jids.sort().join("_")}`;
            if (!acquireLock(lockKey, 4e3)) return;
          } else if (event === "groups.update") {
            const updates = Array.isArray(arg0) ? arg0 : [arg0];
            for (const upd of updates) {
              const cleanId = decodeJid(upd?.id);
              if (!cleanId) continue;
              const lockKey = `grp_${cleanId}_${Object.keys(upd).sort().join("_")}`;
              if (!acquireLock(lockKey, 4e3)) return;
            }
          } else if (event === "group.join-request") {
            const {
              id,
              participant,
              action
            } = arg0;
            const cleanId = decodeJid(id);
            const cleanPart = decodeJid(participant);
            const lockKey = `joinreq_${cleanId}_${cleanPart}_${action}`;
            if (!acquireLock(lockKey, 4e3)) return;
          } else if (event === "messages.update") {
            const updates = Array.isArray(arg0) ? arg0 : [arg0];
            for (const upd of updates) {
              const keyId = upd.key?.id;
              if (upd.update?.pollUpdates) {
                const cached = global.msgStore?.get(keyId);
                const pollMessage = cached?.message || cached?.rawMessage;
                if (pollMessage) {
                  const aggregate = getAggregateVotesInPollMessage({
                    message: pollMessage,
                    pollUpdates: upd.update.pollUpdates
                  });
                  if (cached) cached.pollVotes = aggregate;
                }
              }
              if (keyId && (upd.update?.message === null || upd.update?.messageStubType === 68 || upd.update?.protocolMessage?.type === 0)) {
                const lockKey = `antidel_${keyId}`;
                if (!acquireLock(lockKey, 5e3)) return;
              }
            }
          }
          listener.apply(sock, args);
        } catch (err) {
          console.error(chalk.red(`[JADIBOT EVENT ERROR: ${event}]`), err?.message || err);
        }
      });
    }
  }
}
export async function startJadiBot(parentSock, senderJid, options = {}) {
  ensureJadibotDir();
  const cleanNum = extractNum(senderJid);
  const targetPhoneJid = `${cleanNum}@s.whatsapp.net`;
  const sessionPath = path.join(JADIBOT_DIR, cleanNum);
  const sessionDbKey = `jadibot_${cleanNum}`;
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
  } = await fetchLatestBaileysVersion();
  const {
    state,
    saveCreds,
    clearAuth
  } = await useDBAuthState(sessionDbKey, sessionPath);
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
  cloneSock(parentSock, sock);
  cloneEvents(parentSock, sock);
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
    status: "CONNECTING",
    mode: mode,
    speed: 120,
    qrAttempts: 0,
    pairAttempts: 0
  };
  const isRegistered = Boolean(state.creds && (state.creds.registered === true || state.creds.me?.id));
  if (!isRegistered && mode === "pair" && typeof options.onPairingCode === "function") {
    setTimeout(async () => {
      try {
        botInstance.pairAttempts += 1;
        if (botInstance.pairAttempts > MAX_ATTEMPTS) {
          console.log(chalk.gray(`[ JADIBOT ] `) + chalk.yellow(`Batas percobaan pairing tercapai: ${cleanNum}`));
          closeSocketInstance(botInstance);
          deleteJadiBot(cleanNum);
          await parentSock?.sendMessage(targetPhoneJid, {
            text: `–  *P A I R I N G  L I M I T*\n\n` + `Batas percobaan pairing (3/3) telah habis tanpa respon.\n` + `Sesi otomatis dibatalkan. Ketik *.jadibot pair* untuk mencoba lagi.`
          }).catch(() => {});
          return;
        }
        const code = await sock.requestPairingCode(cleanNum);
        options.onPairingCode(code, botInstance.pairAttempts, MAX_ATTEMPTS);
      } catch (err) {
        console.error(chalk.red(`[JADIBOT PAIR ERROR: ${cleanNum}]`), err.message);
      }
    }, 2500);
  }
  sock.ev.on("creds.update", async () => {
    try {
      saveCreds();
      enrichSubBotUser();
    } catch (err) {
      console.error(chalk.red(`[JADIBOT CREDS SAVE ERROR: ${cleanNum}]`), err.message);
    }
  });
  const triggerEndlessReconnect = (delay = 2500) => {
    if (global.reconnectTimers.has(cleanNum)) {
      clearTimeout(global.reconnectTimers.get(cleanNum));
    }
    const timer = setTimeout(() => {
      global.reconnectTimers.delete(cleanNum);
      if (isSessionRegistered(cleanNum)) {
        startJadiBot(parentSock, targetPhoneJid, options).catch(e => {
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
        await parentSock?.sendMessage(targetPhoneJid, {
          text: `–  *Q R  L I M I T*\n\n` + `QR code tidak dipindai setelah 3x percobaan.\n` + `Sesi otomatis dibatalkan. Ketik *.jadibot qr* untuk memulai kembali.`
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
      enrichSubBotUser();
      botInstance.status = "ONLINE";
      botInstance.startTime = Date.now();
      botInstance.qrAttempts = 0;
      botInstance.pairAttempts = 0;
      global.jadiBots.set(cleanNum, botInstance);
      global.db.jadibot[cleanNum] = {
        number: cleanNum,
        jid: targetPhoneJid,
        connectedAt: global.db.jadibot[cleanNum]?.connectedAt || Date.now(),
        lastActive: Date.now(),
        platform: "Baileys Multi-Device (Pure DB)",
        status: "ONLINE"
      };
      saveDB();
      const botName = sock.user?.name || `Sub-Bot (+${cleanNum})`;
      console.log(chalk.gray(`[ JADIBOT ] `) + chalk.green(`${botName} terhubung (In-DB Pure Storage).`));
      await sock.sendPresenceUpdate("available").catch(() => {});
      await parentSock?.sendMessage(targetPhoneJid, {
        text: `–  *J A D I B O T  -  C O N N E C T E D*\n\n` + `Sub-Bot berhasil diaktifkan dan terhubung ke server.\n\n` + `┌  ◦  *Nomor* : +${cleanNum}\n` + `│  ◦  *Status* : Online (24/7)\n` + `│  ◦  *Storage* : In-DB Pure Session\n` + `│  ◦  *Lock System* : Granular Locks Active\n` + `└  ◦  *Time* : ${new Date().toLocaleString("id-ID", {
timeZone: "Asia/Jakarta"
})} WIB\n\n` + `_Ketik *.menu* untuk mulai menggunakan bot ini._`
      }).catch(() => {});
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode ?? (lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : undefined);
      console.log(chalk.gray(`[ JADIBOT ] `) + chalk.yellow(`Koneksi terputus: ${cleanNum} (Status: ${statusCode})`));
      if (botInstance.status === "ONLINE") {
        botInstance.status = "OFFLINE";
      }
      if (global.db.jadibot[cleanNum]) {
        global.db.jadibot[cleanNum].status = "OFFLINE";
        global.db.jadibot[cleanNum].lastActive = Date.now();
        saveDB();
      }
      if (sock.user?.jid) {
        unregisterBotFromPool(sock.user.jid);
      }
      if (sock.user?.lid) {
        unregisterBotFromPool(sock.user.lid);
      }
      closeSocketInstance(botInstance);
      switch (statusCode) {
        case 408:
          return triggerEndlessReconnect(2e3);
        case 503:
          return triggerEndlessReconnect(3e3);
        case 428:
          return triggerEndlessReconnect(2e3);
        case 515:
          return triggerEndlessReconnect(1500);
        case DisconnectReason.connectionReplaced:
          return triggerEndlessReconnect(5e3);
        case DisconnectReason.connectionLost:
          return triggerEndlessReconnect(2500);
        case 401:
        case DisconnectReason.loggedOut:
          deleteJadiBot(cleanNum);
          await parentSock?.sendMessage(targetPhoneJid, {
            text: `–  *J A D I B O T  -  D I S C O N N E C T*\n\n` + `Sesi Jadibot telah keluar dari akun WhatsApp kamu.\n` + `Silakan hubungkan kembali dengan perintah *.jadibot*.`
          }).catch(() => {});
          return;
        case 403:
          deleteJadiBot(cleanNum);
          await parentSock?.sendMessage(targetPhoneJid, {
            text: `–  *A C C O U N T  B A N N E D*\n\n` + `Akun WhatsApp terblokir (403).\n` + `Sesi Jadibot telah dihapus otomatis dari database.`
          }).catch(() => {});
          return;
        case 405:
          deleteJadiBot(cleanNum);
          return;
        default:
          if (isSessionRegistered(cleanNum)) {
            return triggerEndlessReconnect(3e3);
          } else {
            deleteJadiBot(cleanNum);
          }
          break;
      }
    }
  });
  sock.ev.on("messages.upsert", async ({
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
        if (isGroup) {
          const msgLockKey = `msg_${jid}_${msgId}`;
          if (!acquireLock(msgLockKey, 8e3)) {
            continue;
          }
        }
        let rawM = msg.message;
        if (rawM?.ephemeralMessage) rawM = rawM.ephemeralMessage.message;
        if (rawM?.viewOnceMessage) rawM = rawM.viewOnceMessage.message;
        if (rawM?.viewOnceMessageV2) rawM = rawM.viewOnceMessageV2.message;
        if (rawM?.viewOnceMessageV2Extension) rawM = rawM.viewOnceMessageV2Extension.message;
        if (rawM?.viewOnceMessageV3) rawM = rawM.viewOnceMessageV3.message;
        if (rawM?.documentWithCaptionMessage) rawM = rawM.documentWithCaptionMessage.message;
        if (rawM) {
          global.msgStore.set(msgId, {
            rawMessage: rawM,
            message: rawM,
            msg: msg,
            sender: msg.key.participant || jid,
            timestamp: Date.now()
          });
        }
        if (global.bot?.autoRead !== false) {
          sock.readMessages([msg.key]).catch(() => {});
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
        ctx.parentSock = parentSock;
        UpsertMsgHandle(sock, msg, ctx, {
          cmd: global.loader
        }).catch(e => {
          console.error(chalk.red("[JADIBOT HANDLER ERROR]"), e.message);
        });
      } catch (e) {
        console.error(chalk.red("[JADIBOT MSG ERROR]"), e.message);
      }
    }
  });
  return botInstance;
}
export async function deleteJadiBot(number) {
  const cleanNum = String(number).replace(/\D/g, "");
  const sessionPath = path.join(JADIBOT_DIR, cleanNum);
  if (global.reconnectTimers.has(cleanNum)) {
    clearTimeout(global.reconnectTimers.get(cleanNum));
    global.reconnectTimers.delete(cleanNum);
  }
  if (global.jadiBots.has(cleanNum)) {
    closeSocketInstance(global.jadiBots.get(cleanNum));
    global.jadiBots.delete(cleanNum);
  }
  if (global.db?.jadibot?.[cleanNum]) {
    delete global.db.jadibot[cleanNum];
  }
  if (global.db?.auth?.[`jadibot_${cleanNum}`]) {
    delete global.db.auth[`jadibot_${cleanNum}`];
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
  for (const [num, timer] of global.reconnectTimers.entries()) {
    clearTimeout(timer);
  }
  global.reconnectTimers.clear();
  for (const [num, bot] of global.jadiBots.entries()) {
    try {
      closeSocketInstance(bot);
    } catch (_) {}
  }
  global.jadiBots.clear();
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
      platform: dbRecord.platform || "Baileys Multi-Device (Pure DB)",
      speed: isLive ? instance?.speed || 120 : 0
    };
  });
}
export async function initAllJadiBots(parentSock) {
  ensureJadibotDir();
  const list = getJadiBotsList();
  if (!list.length) return;
  console.log(chalk.gray(`[ JADIBOT ]`) + chalk.cyan(` Memulihkan ${list.length} sesi Jadibot (Full DB) bertahap . . .`));
  for (const bot of list) {
    try {
      if (isSessionRegistered(bot.number)) {
        await startJadiBot(parentSock, bot.jid, {
          mode: "pair"
        });
        await new Promise(r => setTimeout(r, 2500));
      }
    } catch (e) {
      console.error(chalk.red(`[ JADIBOT RESTORE ERROR: ${bot.number} ]`), e.message);
    }
  }
}