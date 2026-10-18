import * as Baileys from "@whiskeysockets/baileys";
import {
  Boom
} from "@hapi/boom";
import crypto from "crypto";
import axios from "axios";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import {
  createRequire
} from "module";
import {
  Button,
  ButtonV2,
  Carousel as BuilderCarousel,
  AIRich,
  Poll,
  Toolkit,
  A2UI,
  sendA2UIWidget,
  MESSAGE_BUILDER_VERSION
} from "./msg-builder.js";
const require = createRequire(import.meta.url);
let Jimp = null;
try {
  Jimp = require("jimp");
} catch {}
const {
  prepareWAMessageMedia,
  generateWAMessage,
  generateWAMessageFromContent,
  generateForwardMessageContent,
  generateMessageID,
  downloadContentFromMessage,
  proto,
  normalizeMessageContent,
  getContentType,
  areJidsSameUser,
  jidDecode,
  isJidGroup,
  jidNormalizedUser
} = Baileys;
const WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
global.lidPhoneCache = global.lidPhoneCache || new Map();
global.msgStore = global.msgStore || new Map();
const inFlightLidLookups = new Map();
if (!Button.prototype.setHeader) {
  Button.prototype.setHeader = function(title = "", subtitle = "") {
    this.setTitle(String(title || ""));
    this.setSubtitle(String(subtitle || ""));
    return this;
  };
}
if (!Button.prototype.setJid) {
  Button.prototype.setJid = function(jid) {
    this._jid = jid;
    return this;
  };
}
if (!Button.prototype.makeSections) {
  Button.prototype.makeSections = function(title = "", highlight_label = "") {
    return this.makeSection(title, highlight_label);
  };
}
if (!Button.prototype.addList) {
  Button.prototype.addList = function(title, sections = []) {
    this.addSelection(title);
    for (const sec of sections) {
      this.makeSection(sec.title || "", sec.highlight_label || "");
      for (const row of sec.rows || []) {
        this.makeRow(row.header || "", row.title || "", row.description || "", row.id || "");
      }
    }
    return this;
  };
}
export class CustomCarousel extends BuilderCarousel {
  #client;
  constructor(client) {
    super(client);
    this.#client = client;
    this._cards = [];
  }
  createCard() {
    return new Button(this.#client);
  }
  addCard(cardOrBuilder) {
    if (typeof cardOrBuilder === "function") {
      const card = new Button(this.#client);
      cardOrBuilder(card);
      this._cards.push(card);
    } else {
      this._cards.push(cardOrBuilder);
    }
    return this;
  }
  setCards(cards = []) {
    this._cards = [];
    for (const card of cards) this.addCard(card);
    return this;
  }
  async build(jid, options = {}) {
    const compiledCards = [];
    for (const c of this._cards) {
      if (c && typeof c.toCard === "function") {
        compiledCards.push(await c.toCard());
      } else {
        compiledCards.push(c);
      }
    }
    this._cards = compiledCards;
    return await generateWAMessageFromContent(jid, {
      ...this._extraPayload,
      interactiveMessage: {
        header: {
          hasMediaAttachment: false
        },
        body: {
          text: this._body
        },
        footer: {
          text: this._footer
        },
        contextInfo: this._contextInfo,
        carouselMessage: {
          cards: this._cards
        }
      }
    }, {
      ...options
    });
  }
  async send(jid, options = {}) {
    const msg = await this.build(jid, options);
    await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
      messageId: msg.key.id,
      additionalNodes: [{
        tag: "biz",
        attrs: {},
        content: [{
          tag: "interactive",
          attrs: {
            type: "native_flow",
            v: "1"
          },
          content: [{
            tag: "native_flow",
            attrs: {
              v: "9",
              name: "mixed"
            }
          }]
        }]
      }],
      ...options
    });
    return msg;
  }
  async run(jid, sockOrQuoted = null, options = {}) {
    const actualOptions = typeof sockOrQuoted === "object" && !sockOrQuoted?.relayMessage ? sockOrQuoted : options;
    return await this.send(jid, actualOptions);
  }
}
export {
  Button,
  ButtonV2,
  CustomCarousel as Carousel,
  AIRich,
  Poll,
  Toolkit,
  A2UI,
  sendA2UIWidget,
  MESSAGE_BUILDER_VERSION,
  AIRich as LeafRich,
  AIRich as LeafReach
};
export const CtaButtonBuilder = Button;
export const CarouselCard = Button;
export function decodeJid(jid = "") {
  if (!jid || typeof jid !== "string") return "";
  if (/:\d+@/gi.test(jid)) {
    const decode = jidDecode(jid) || {};
    return decode.user && decode.server && `${decode.user}@${decode.server}` || jid;
  }
  return jid;
}
export const cleanId = id => id ? id.split("@")[0].split(":")[0] + "@" + (id.split("@")[1] || "s.whatsapp.net") : "";
export const extractNum = id => id ? String(id).split("@")[0].split(":")[0].replace(/\D/g, "") : "";
export async function resolveLidProactively(sock, lid, cache = global.lidPhoneCache, timeoutMs = 5e3) {
  if (!sock || !lid) return {
    status: "skipped",
    jid: null
  };
  const cleanLid = decodeJid(lid);
  if (!cleanLid.endsWith("@lid")) {
    return {
      status: "skipped",
      jid: cleanLid
    };
  }
  if (cache && cache.has(cleanLid)) {
    return {
      status: "cached",
      jid: cache.get(cleanLid)
    };
  }
  if (sock.user) {
    const botLid = sock.user.lid ? decodeJid(sock.user.lid) : null;
    const botPn = sock.user.id ? decodeJid(sock.user.id) : null;
    if (botLid && botPn && cleanLid === botLid) {
      cache?.set(cleanLid, botPn);
      return {
        status: "resolved",
        jid: botPn
      };
    }
  }
  try {
    const lidMapping = sock.signalRepository?.lidMapping;
    if (lidMapping && typeof lidMapping.getPNForLID === "function") {
      const pn = await lidMapping.getPNForLID(cleanLid);
      if (pn && typeof pn === "string") {
        const resolved = pn.endsWith("@s.whatsapp.net") ? pn : `${pn}@s.whatsapp.net`;
        cache?.set(cleanLid, resolved);
        return {
          status: "resolved",
          jid: resolved
        };
      }
    }
  } catch {}
  const contacts = sock.contacts || sock.store?.contacts || {};
  for (const [jid, contact] of Object.entries(contacts)) {
    if (contact?.lid === cleanLid && jid.endsWith("@s.whatsapp.net")) {
      cache?.set(cleanLid, jid);
      return {
        status: "resolved",
        jid: jid
      };
    }
  }
  if (inFlightLidLookups.has(cleanLid)) {
    try {
      const res = await inFlightLidLookups.get(cleanLid);
      return res;
    } catch {
      return {
        status: "error",
        jid: null
      };
    }
  }
  if (typeof sock.onWhatsApp !== "function") {
    return {
      status: "skipped",
      jid: null
    };
  }
  const lookupPromise = (async () => {
    let timer = null;
    try {
      const lookup = await Promise.race([sock.onWhatsApp(cleanLid), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      })]);
      const hit = Array.isArray(lookup) ? lookup.find(item => item?.jid && item?.exists) || lookup[0] : null;
      if (hit && hit.jid) {
        const resolvedJid = decodeJid(hit.jid);
        cache?.set(cleanLid, resolvedJid);
        return {
          status: "resolved",
          jid: resolvedJid
        };
      }
      return {
        status: "empty",
        jid: null
      };
    } catch (e) {
      if (e?.message === "timeout") {
        return {
          status: "timeout",
          jid: null
        };
      }
      return {
        status: "error",
        jid: null
      };
    } finally {
      if (timer) clearTimeout(timer);
      inFlightLidLookups.delete(cleanLid);
    }
  })();
  inFlightLidLookups.set(cleanLid, lookupPromise);
  return await lookupPromise;
}
export async function resolveLidToJid(targetJid = "", sock = null, altJid = null, groupParticipants = []) {
  if (!targetJid && !altJid) return "";
  const rawTarget = String(targetJid || "").trim();
  const rawAlt = String(altJid || "").trim();
  if (rawAlt && !rawAlt.endsWith("@lid") && (rawAlt.endsWith("@s.whatsapp.net") || /^\d{6,}$/.test(rawAlt))) {
    const res = decodeJid(rawAlt.endsWith("@s.whatsapp.net") ? rawAlt : `${rawAlt}@s.whatsapp.net`);
    if (rawTarget.endsWith("@lid")) global.lidPhoneCache.set(rawTarget, res);
    return res;
  }
  const cleanTarget = decodeJid(rawTarget);
  if (!cleanTarget.endsWith("@lid")) return cleanTarget;
  if (global.lidPhoneCache.has(cleanTarget)) return global.lidPhoneCache.get(cleanTarget);
  if (sock?.user) {
    const botId = decodeJid(sock.user.id || sock.user.jid || "");
    const botLid = sock.user.lid ? decodeJid(sock.user.lid) : null;
    if (botLid && cleanTarget === botLid) {
      global.lidPhoneCache.set(cleanTarget, botId);
      return botId;
    }
  }
  try {
    const lidMapping = sock?.signalRepository?.lidMapping;
    if (lidMapping && typeof lidMapping.getPNForLID === "function") {
      const pn = await lidMapping.getPNForLID(cleanTarget);
      if (pn && typeof pn === "string") {
        const res = decodeJid(pn.endsWith("@s.whatsapp.net") ? pn : `${pn}@s.whatsapp.net`);
        global.lidPhoneCache.set(cleanTarget, res);
        return res;
      }
    }
  } catch {}
  if (Array.isArray(groupParticipants) && groupParticipants.length > 0) {
    const found = groupParticipants.find(p => decodeJid(p?.lid) === cleanTarget || decodeJid(p?.id) === cleanTarget);
    if (found) {
      if (found.phoneNumber) {
        const num = String(found.phoneNumber).replace(/\D/g, "");
        if (num.length >= 6) {
          const res = `${num}@s.whatsapp.net`;
          global.lidPhoneCache.set(cleanTarget, res);
          return res;
        }
      }
      if (found.id && !found.id.endsWith("@lid")) {
        const res = decodeJid(found.id);
        global.lidPhoneCache.set(cleanTarget, res);
        return res;
      }
      if (found.jid && !found.jid.endsWith("@lid")) {
        const res = decodeJid(found.jid);
        global.lidPhoneCache.set(cleanTarget, res);
        return res;
      }
    }
  }
  const allGroups = sock?.chats || sock?.store?.chats || sock?.store?.groupMetadata || {};
  for (const group of Object.values(allGroups)) {
    const ptcps = group?.participants || group?.groupMetadata?.participants || [];
    if (!Array.isArray(ptcps)) continue;
    for (const p of ptcps) {
      if (decodeJid(p?.lid) === cleanTarget || decodeJid(p?.id) === cleanTarget) {
        if (p.phoneNumber) {
          const num = String(p.phoneNumber).replace(/\D/g, "");
          if (num.length >= 6) {
            const res = `${num}@s.whatsapp.net`;
            global.lidPhoneCache.set(cleanTarget, res);
            return res;
          }
        }
        if (p.id && !p.id.endsWith("@lid")) {
          const res = decodeJid(p.id);
          global.lidPhoneCache.set(cleanTarget, res);
          return res;
        }
      }
    }
  }
  const contacts = sock?.contacts || sock?.store?.contacts || {};
  for (const [jid, contact] of Object.entries(contacts)) {
    if (contact?.lid && decodeJid(contact.lid) === cleanTarget && jid.endsWith("@s.whatsapp.net")) {
      const res = decodeJid(jid);
      global.lidPhoneCache.set(cleanTarget, res);
      return res;
    }
    if (contact?.id && decodeJid(contact.id) === cleanTarget && contact?.phoneJid) {
      const res = decodeJid(contact.phoneJid);
      global.lidPhoneCache.set(cleanTarget, res);
      return res;
    }
  }
  const dbUsers = global.db?.user || {};
  for (const [dbJid, u] of Object.entries(dbUsers)) {
    if (dbJid.endsWith("@s.whatsapp.net") && (u?.lid === cleanTarget || u?.userLid === cleanTarget)) {
      global.lidPhoneCache.set(cleanTarget, dbJid);
      return dbJid;
    }
  }
  if (sock && typeof resolveLidProactively === "function") {
    const pro = await resolveLidProactively(sock, cleanTarget);
    if (pro.jid) return pro.jid;
  }
  return cleanTarget;
}
export function lidToJid(targetJid = "", sock = null, altJid = null, groupParticipants = []) {
  if (!targetJid && !altJid) return "";
  const rawTarget = String(targetJid || "").trim();
  const rawAlt = String(altJid || "").trim();
  if (rawAlt && !rawAlt.endsWith("@lid") && (rawAlt.endsWith("@s.whatsapp.net") || /^\d{6,}$/.test(rawAlt))) {
    return decodeJid(rawAlt.endsWith("@s.whatsapp.net") ? rawAlt : `${rawAlt}@s.whatsapp.net`);
  }
  const cleanTarget = decodeJid(rawTarget);
  if (!cleanTarget.endsWith("@lid")) return cleanTarget;
  if (global.lidPhoneCache?.has(cleanTarget)) return global.lidPhoneCache.get(cleanTarget);
  return cleanTarget;
}
export async function resizeImage(input, width = 300, height = 220, mime = "image/jpeg") {
  if (!input) return null;
  let buffer = null;
  try {
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (typeof input === "string") {
      const cleanInput = input.trim();
      if (/^https?:\/\//i.test(cleanInput)) {
        const res = await axios.get(cleanInput, {
          responseType: "arraybuffer",
          timeout: 12e3,
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        });
        buffer = Buffer.from(res.data);
      } else if (cleanInput.startsWith("data:") || cleanInput.length > 100) {
        buffer = Buffer.from(cleanInput.replace(/^data:image\/[a-z]+;base64,/, ""), "base64");
      }
    }
    if (!buffer || !Buffer.isBuffer(buffer) || !Jimp) return buffer;
    const image = await (typeof Jimp.read === "function" ? Jimp.read(buffer) : Jimp(buffer));
    if (!image) return buffer;
    if (typeof image.resize === "function") {
      image.resize(width, height);
    }
    const targetMime = mime === "image/png" ? Jimp.MIME_PNG || "image/png" : Jimp.MIME_JPEG || "image/jpeg";
    if (typeof image.getBufferAsync === "function") {
      return await image.getBufferAsync(targetMime);
    }
    return await new Promise((resolve, reject) => {
      image.getBuffer(targetMime, (err, buf) => err ? reject(err) : resolve(buf));
    });
  } catch {
    return buffer || input;
  }
}
export async function processThumbnails(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 8) return obj;
  const ensureCompressed = async target => {
    if (!target) return null;
    if (Buffer.isBuffer(target) && target._isResized) return target;
    const res = await resizeImage(target, 300, 220, "image/jpeg");
    if (res && Buffer.isBuffer(res)) {
      res._isResized = true;
      return res;
    }
    return res;
  };
  if (obj.externalAdReply) {
    const ad = obj.externalAdReply;
    const targetThumb = ad.jpegThumbnail || ad.thumbnail || ad.thumbnailUrl || ad.image;
    if (targetThumb) {
      const resized = await ensureCompressed(targetThumb);
      if (resized) {
        ad.jpegThumbnail = resized;
        ad.thumbnail = resized;
        delete ad.thumbnailUrl;
        delete ad.image;
      }
    }
  }
  if (obj.locationMessage || obj.degreesLatitude !== undefined && obj.degreesLongitude !== undefined) {
    const loc = obj.locationMessage || obj;
    const targetThumb = loc.jpegThumbnail || loc.thumbnail || loc.image || loc.thumb || loc.thumbnailUrl;
    if (targetThumb) {
      const resized = await ensureCompressed(targetThumb);
      if (resized) {
        loc.jpegThumbnail = resized;
        delete loc.thumbnail;
        delete loc.image;
        delete loc.thumb;
        delete loc.thumbnailUrl;
      }
    }
  }
  const mediaKeys = ["documentMessage", "videoMessage", "audioMessage", "imageMessage"];
  for (const mk of mediaKeys) {
    if (obj[mk]) {
      const target = obj[mk].jpegThumbnail || obj[mk].thumbnail;
      if (target) {
        const resized = await ensureCompressed(target);
        if (resized) {
          obj[mk].jpegThumbnail = resized;
          delete obj[mk].thumbnail;
        }
      }
    }
  }
  if (obj.jpegThumbnail) obj.jpegThumbnail = await ensureCompressed(obj.jpegThumbnail);
  if (obj.thumbnail) {
    const resized = await ensureCompressed(obj.thumbnail);
    if (resized) {
      obj.jpegThumbnail = resized;
      delete obj.thumbnail;
    }
  }
  if (Array.isArray(obj.cards)) {
    for (const card of obj.cards) {
      await processThumbnails(card, depth + 1);
    }
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && obj[key] !== null && !Buffer.isBuffer(obj[key])) {
      await processThumbnails(obj[key], depth + 1);
    }
  }
  return obj;
}
export async function safeRelayInteractive(sock, jid, message, options = {}, retries = 2) {
  const targetJid = decodeJid(jid);
  try {
    const duration = options.duration ?? options.afterReadDuration;
    if (duration && message && typeof message === "object") {
      const injectDuration = obj => {
        if (!obj || typeof obj !== "object") return;
        if (obj.contextInfo) {
          obj.contextInfo.expiration = 0;
          obj.contextInfo.ephemeralSettingTimestamp = Date.now();
          obj.contextInfo.disappearingMode = {
            initiator: 0,
            trigger: 1
          };
          obj.contextInfo.afterReadDuration = Number(duration);
        }
        for (const k of Object.keys(obj)) {
          if (typeof obj[k] === "object" && obj[k] !== null && !Buffer.isBuffer(obj[k])) {
            injectDuration(obj[k]);
          }
        }
      };
      injectDuration(message);
    }
    const messageId = options.messageId || (typeof generateMessageID === "function" ? generateMessageID() : undefined);
    return await sock.relayMessage(targetJid, message, {
      messageId: messageId,
      ...options
    });
  } catch (err) {
    const errorMsg = String(err?.message || "").toLowerCase();
    const statusCode = err?.output?.statusCode || err?.status;
    if (retries > 0 && (statusCode === 428 || statusCode === 499 || statusCode === 515 || errorMsg.includes("closed") || errorMsg.includes("precondition"))) {
      await sleep(500);
      return await safeRelayInteractive(sock, targetJid, message, options, retries - 1);
    }
    throw err;
  }
}
export function cleanQuotedForTarget(quoted, targetJid) {
  if (!quoted || !quoted.key) return quoted;
  const isTargetGroup = String(targetJid).endsWith("@g.us");
  let participant = quoted.key.participant || quoted.participant;
  if (participant && participant.endsWith("@lid")) {
    const lidNum = participant.split("@")[0].split(":")[0];
    const cachedNum = global.lidPhoneCache?.get(lidNum);
    participant = cachedNum ? `${cachedNum}@s.whatsapp.net` : undefined;
  }
  const sanitized = {
    ...quoted,
    key: {
      ...quoted.key,
      remoteJid: targetJid,
      participant: isTargetGroup ? participant && !participant.endsWith("@lid") ? participant : undefined : undefined
    }
  };
  if (!isTargetGroup) {
    delete sanitized.key.participant;
    delete sanitized.key.participantAlt;
    delete sanitized.key.remoteJidAlt;
  }
  return sanitized;
}
export async function autoFixGroupSession(sock, groupJid) {
  try {
    const cleanId = decodeJid(groupJid);
    if (!cleanId.endsWith("@g.us")) return;
    const cleanNumId = cleanId.split("@")[0].replace(/\D/g, "");
    if (global.groupCache) global.groupCache.delete(cleanId);
    if (global.jadibotGroupCache) global.jadibotGroupCache.delete(cleanId);
    if (global.authKeysStore) {
      const stores = typeof global.authKeysStore === "object" ? Object.values(global.authKeysStore) : [];
      for (const st of stores) {
        if (st && typeof st === "object") {
          for (const key in st) {
            if (key.includes(cleanNumId)) delete st[key];
          }
        }
      }
    }
    const sessionDir = path.join(process.cwd(), "session");
    if (fs.existsSync(sessionDir)) {
      const badFiles = fs.readdirSync(sessionDir).filter(f => f.includes(cleanNumId));
      for (const f of badFiles) {
        try {
          fs.unlinkSync(path.join(sessionDir, f));
        } catch (_) {}
      }
    }
    if (typeof sock?.groupMetadata === "function") {
      const freshMeta = await Promise.race([sock.groupMetadata(cleanId).catch(() => null), new Promise(r => setTimeout(() => r(null), 1500))]);
      if (freshMeta && global.groupCache) {
        global.groupCache.set(cleanId, {
          data: freshMeta,
          time: Date.now()
        });
      }
    }
  } catch (_) {}
}
const NON_CONTENT_KEYS = new Set(["delete", "react", "edit", "pin", "poll", "pollUpdate", "protocolMessage", "senderKeyDistributionMessage", "forward", "groupStatus", "statusMentionMessage", "pollResult"]);
export async function safeSendMessage(sock, jid, content, options = {}, retries = 2) {
  const targetJid = decodeJid(jid);
  try {
    if (typeof content === "string") content = {
      text: content
    };
    if (content && typeof content === "object") await processThumbnails(content);
    if (options && typeof options === "object") await processThumbnails(options);
    const rawText = String(content?.text || content?.caption || content?.conversation || content?.image?.caption || content?.video?.caption || content?.document?.caption || content?.extendedTextMessage?.text || "");
    const parsedTextMentions = typeof parseMention === "function" ? parseMention(rawText) : [];
    const rawMentions = [...Array.isArray(options.mentions) ? options.mentions : [], ...Array.isArray(options.mentionedJid) ? options.mentionedJid : [], ...Array.isArray(options.contextInfo?.mentionedJid) ? options.contextInfo.mentionedJid : [], ...Array.isArray(content?.mentions) ? content.mentions : [], ...Array.isArray(content?.mentionedJid) ? content.mentionedJid : [], ...Array.isArray(content?.contextInfo?.mentionedJid) ? content.contextInfo.mentionedJid : [], ...parsedTextMentions].filter(Boolean);
    const finalMentions = [...new Set(rawMentions.map(item => {
      let clean = decodeJid(String(item).trim());
      if (clean.endsWith("@lid")) {
        if (typeof resolveLidToJid === "function") clean = resolveLidToJid(clean, sock);
        else if (global.lidPhoneCache?.has(clean)) clean = global.lidPhoneCache.get(clean);
      }
      if (clean.endsWith("@s.whatsapp.net") || clean.endsWith("@lid")) {
        return clean;
      }
      const num = clean.replace(/\D/g, "");
      return num.length >= 7 ? `${num}@s.whatsapp.net` : null;
    }).filter(Boolean))];
    if (content && typeof content === "object") {
      if (!content.contextInfo) content.contextInfo = {};
      content.contextInfo.mentionedJid = finalMentions;
      content.mentions = finalMentions;
    }
    if (options && typeof options === "object") {
      if (!options.contextInfo) options.contextInfo = {};
      options.contextInfo.mentionedJid = finalMentions;
      options.mentions = finalMentions;
    }
    const isControl = content && typeof content === "object" && Object.keys(content).some(k => NON_CONTENT_KEYS.has(k));
    if (!isControl && content && typeof content === "object") {
      const botCfg = global.bot || {};
      const botUtils = botCfg.utils || {};
      if (content.title === undefined && botUtils.title) content.title = botUtils.title;
      if (content.subtitle === undefined && botUtils.subtitle) content.subtitle = botUtils.subtitle;
      if (content.footer === undefined && (botUtils.footer || botCfg.footer || botCfg.watermark)) {
        content.footer = botUtils.footer || botCfg.footer || botCfg.watermark;
      }
      const customButtons = content.interactiveButtons || options.interactiveButtons || botUtils.interactiveButtons || null;
      if (customButtons && Array.isArray(customButtons) && customButtons.length > 0) {
        content.interactiveButtons = customButtons;
      }
      content.contextInfo = {
        ...botUtils.contextInfo || {},
        ...content.contextInfo || {},
        ...options.contextInfo || {},
        mentionedJid: finalMentions
      };
      content.mentions = finalMentions;
      options.mentions = finalMentions;
      const interactiveKeys = ["interactiveMessage", "buttonsMessage", "templateMessage", "listMessage"];
      for (const key of interactiveKeys) {
        if (content[key] && typeof content[key] === "object") {
          content[key].contextInfo = {
            ...content[key].contextInfo || {},
            ...content.contextInfo,
            mentionedJid: finalMentions
          };
        }
      }
      const duration = options.duration ?? options.afterReadDuration ?? content.duration ?? content.afterReadDuration;
      if (duration) {
        Object.assign(content.contextInfo, {
          expiration: 0,
          ephemeralSettingTimestamp: Date.now(),
          disappearingMode: {
            initiator: 0,
            trigger: 1
          },
          afterReadDuration: Number(duration)
        });
        if (content.text && content.previewType === undefined) {
          content.previewType = 0;
        }
      }
    } else if (finalMentions.length > 0 && content && typeof content === "object") {
      content.mentions = finalMentions;
      options.mentions = finalMentions;
      content.contextInfo = {
        ...content.contextInfo || {},
        mentionedJid: finalMentions
      };
    }
    if (finalMentions.length > 0) {
      options.mentions = finalMentions;
      if (!options.contextInfo) options.contextInfo = {};
      options.contextInfo.mentionedJid = finalMentions;
    }
    if (options.quoted && typeof options.quoted === "object") {
      let q = options.quoted;
      if (!q.message || typeof q.message !== "object" || Object.keys(q.message).length === 0) {
        q = {
          key: q.key || {
            remoteJid: targetJid,
            id: "3EB0" + crypto.randomBytes(8).toString("hex")
          },
          message: {
            conversation: q.text || q.body || " "
          },
          messageTimestamp: Math.floor(Date.now() / 1e3)
        };
      }
      options.quoted = cleanQuotedForTarget(q, targetJid);
    }
    return await sock.sendMessage(targetJid, content, options);
  } catch (err) {
    const statusCode = err?.output?.statusCode || err?.status;
    const errorText = String(err?.message || "").toLowerCase();
    const isStaleSession = statusCode === 479 || errorText.includes("479") || errorText.includes("stale") || errorText.includes("malformed") || errorText.includes("session");
    if (isStaleSession && targetJid.endsWith("@g.us") && retries > 0) {
      console.log(chalk.yellow(`[AUTO-RECOVERY] Error 479 terdeteksi di ${targetJid}. Memperbaiki sesi & kirim ulang...`));
      await autoFixGroupSession(sock, targetJid);
      await sleep(500);
      return await safeSendMessage(sock, targetJid, content, options, retries - 1);
    }
    if (retries > 0 && (statusCode === 428 || statusCode === 499 || statusCode === 515 || errorText.includes("precondition") || errorText.includes("closed") || errorText.includes("timed out"))) {
      await sleep(500);
      return await safeSendMessage(sock, targetJid, content, options, retries - 1);
    }
    throw err;
  }
}
const PROTOCOL_KEYS = new Set(["messageContextInfo", "senderKeyDistributionMessage", "contextInfo", "botMetadata", "key"]);
export const unwrapMessage = msg => {
  if (!msg || typeof msg !== "object") return msg;
  let cur = msg;
  let guard = 0;
  while (cur && typeof cur === "object" && guard < 25) {
    guard++;
    if (cur.message && typeof cur.message === "object") {
      cur = cur.message;
      continue;
    }
    if (cur.rawMessage && typeof cur.rawMessage === "object") {
      cur = cur.rawMessage;
      continue;
    }
    if (cur.fakeObj?.message) {
      cur = cur.fakeObj.message;
      continue;
    }
    if (cur.protocolMessage?.editedMessage) {
      cur = cur.protocolMessage.editedMessage;
      continue;
    }
    if (cur.editedMessage) {
      cur = cur.editedMessage.message || cur.editedMessage;
      continue;
    }
    if (cur.ephemeralMessage?.message) {
      cur = cur.ephemeralMessage.message;
      continue;
    }
    if (cur.viewOnceMessage?.message) {
      cur = cur.viewOnceMessage.message;
      continue;
    }
    if (cur.viewOnceMessageV2?.message) {
      cur = cur.viewOnceMessageV2.message;
      continue;
    }
    if (cur.viewOnceMessageV2Extension?.message) {
      cur = cur.viewOnceMessageV2Extension.message;
      continue;
    }
    if (cur.viewOnceMessageV3?.message) {
      cur = cur.viewOnceMessageV3.message;
      continue;
    }
    if (cur.documentWithCaptionMessage?.message) {
      cur = cur.documentWithCaptionMessage.message;
      continue;
    }
    if (cur.botForwardedMessage?.message) {
      cur = cur.botForwardedMessage.message;
      continue;
    }
    if (cur.groupMentionedMessage?.message) {
      cur = cur.groupMentionedMessage.message;
      continue;
    }
    if (cur.templateMessage && typeof cur.templateMessage === "object") {
      const tplKey = Object.keys(cur.templateMessage).find(k => k.toLowerCase().includes("template"));
      cur = tplKey ? cur.templateMessage[tplKey] : cur.templateMessage;
      continue;
    }
    if (cur.verticalAlbumMessage && typeof cur.verticalAlbumMessage === "object") {
      cur = cur.verticalAlbumMessage;
      continue;
    }
    if (cur.a2uiMessage && typeof cur.a2uiMessage === "object") {
      cur = cur.a2uiMessage;
      continue;
    }
    const interactive = cur.interactiveMessage || cur.interactiveResponseMessage;
    if (interactive?.header && typeof interactive.header === "object") {
      const hasContent = Boolean(interactive.body?.text || interactive.nativeFlowMessage || interactive.nativeFlowResponseMessage);
      if (!hasContent) {
        const mediaKey = Object.keys(interactive.header).find(k => k.endsWith("Message"));
        if (mediaKey) {
          cur = interactive.header;
          continue;
        }
      }
    }
    const wrapperKey = Object.keys(cur).find(k => !PROTOCOL_KEYS.has(k) && cur[k] && typeof cur[k] === "object" && cur[k].message);
    if (wrapperKey) {
      cur = cur[wrapperKey].message;
      continue;
    }
    break;
  }
  return cur;
};
export function getMessagePayload(m) {
  if (!m) return {
    mtype: "conversation",
    msg: {
      text: ""
    }
  };
  if (typeof m === "string") return {
    mtype: "conversation",
    msg: {
      text: m
    }
  };
  const unwrapped = unwrapMessage(m) || m;
  if (typeof unwrapped === "string") return {
    mtype: "conversation",
    msg: {
      text: unwrapped
    }
  };
  const header = unwrapped?.interactiveMessage?.header || unwrapped?.header || unwrapped?.interactiveResponseMessage?.header;
  if (header && typeof header === "object") {
    const mediaKey = Object.keys(header).find(k => k.endsWith("Message") && header[k]);
    if (mediaKey) return {
      mtype: mediaKey,
      msg: header[mediaKey]
    };
  }
  const keys = Object.keys(unwrapped).filter(k => !PROTOCOL_KEYS.has(k) && unwrapped[k] != null);
  let mtype = keys.find(k => k.endsWith("Message")) || keys.find(k => ["album", "conversation", "text", "pollCreationMessage"].includes(k)) || keys[0] || "conversation";
  let payload = unwrapped[mtype] ?? unwrapped;
  if (typeof payload === "string") {
    payload = {
      text: payload,
      conversation: payload
    };
  }
  return {
    mtype: mtype,
    msg: payload
  };
}
export function extractMessageText(message) {
  if (!message) return "";
  const m = unwrapMessage(message) || message;
  if (typeof m === "string") return m.trim();
  if (typeof m.conversation === "string" && m.conversation.trim()) return m.conversation.trim();
  if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
  if (typeof m.caption === "string" && m.caption.trim()) return m.caption.trim();
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text.trim();
  if (m.imageMessage?.caption) return m.imageMessage.caption.trim();
  if (m.videoMessage?.caption) return m.videoMessage.caption.trim();
  if (m.documentMessage?.caption) return m.documentMessage.caption.trim();
  const interactive = m.interactiveResponseMessage || m.interactiveMessage || m;
  const nativeFlow = interactive?.nativeFlowResponseMessage || m.nativeFlowResponseMessage;
  if (nativeFlow?.paramsJson) {
    try {
      const params = typeof nativeFlow.paramsJson === "string" ? JSON.parse(nativeFlow.paramsJson) : nativeFlow.paramsJson;
      const res = params.id || params.selected_id || params.command || params.response || params.text || params.name || "";
      if (res) return String(res).trim();
    } catch {}
  }
  if (m.buttonsResponseMessage?.selectedButtonId) return m.buttonsResponseMessage.selectedButtonId.trim();
  if (m.buttonsResponseMessage?.selectedDisplayText) return m.buttonsResponseMessage.selectedDisplayText.trim();
  if (m.templateButtonReplyMessage?.selectedId) return m.templateButtonReplyMessage.selectedId.trim();
  if (m.templateButtonReplyMessage?.selectedDisplayText) return m.templateButtonReplyMessage.selectedDisplayText.trim();
  if (m.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return m.listResponseMessage.singleSelectReply.selectedRowId.trim();
  }
  const responseKeys = Object.keys(m).filter(k => k.endsWith("ResponseMessage") || k.endsWith("ReplyMessage"));
  for (const rk of responseKeys) {
    const obj = m[rk];
    if (obj) {
      const val = obj.selectedButtonId || obj.selectedDisplayText || obj.selectedId || obj.singleSelectReply?.selectedRowId || obj.singleSelectReply?.title;
      if (val) return String(val).trim();
    }
  }
  if (m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3) {
    const poll = m.pollCreationMessage || m.pollCreationMessageV2 || m.pollCreationMessageV3;
    if (poll?.name) return poll.name.trim();
  }
  if (m.eventMessage?.name) {
    return `${m.eventMessage.name}${m.eventMessage.description ? `\n${m.eventMessage.description}` : ""}`.trim();
  }
  if (m.locationMessage) {
    return (m.locationMessage.name || m.locationMessage.address || "").trim();
  }
  if (m.contactMessage?.displayName) {
    return m.contactMessage.displayName.trim();
  }
  if (interactive?.body?.text) return interactive.body.text.trim();
  if (interactive?.header?.title) return interactive.header.title.trim();
  const {
    msg
  } = getMessagePayload(m);
  if (msg && typeof msg === "object") {
    if (typeof msg.text === "string" && msg.text.trim()) return msg.text.trim();
    if (typeof msg.caption === "string" && msg.caption.trim()) return msg.caption.trim();
    if (typeof msg.conversation === "string" && msg.conversation.trim()) return msg.conversation.trim();
    if (typeof msg.selectedDisplayText === "string" && msg.selectedDisplayText.trim()) return msg.selectedDisplayText.trim();
    if (typeof msg.name === "string" && msg.name.trim()) return msg.name.trim();
    if (typeof msg.title === "string" && msg.title.trim()) return msg.title.trim();
    if (typeof msg.description === "string" && msg.description.trim()) return msg.description.trim();
    if (typeof msg.displayName === "string" && msg.displayName.trim()) return msg.displayName.trim();
    if (typeof msg.body?.text === "string" && msg.body.text.trim()) return msg.body.text.trim();
  }
  return "";
}
export const getBody = extractMessageText;
export function parseMention(text = "") {
  if (typeof text !== "string") return [];
  const matches = [...text.matchAll(/@([0-9]{5,20})(?:@s\.whatsapp\.net)?/g)];
  return matches.map(v => `${v[1]}@s.whatsapp.net`);
}
export function extractMentions(message, sock = null) {
  if (!message) return [];
  const m = unwrapMessage(message) || message;
  const mentions = [];
  const {
    msg
  } = getMessagePayload(m);
  if (msg?.contextInfo?.mentionedJid) mentions.push(...msg.contextInfo.mentionedJid);
  if (m?.contextInfo?.mentionedJid) mentions.push(...m.contextInfo.mentionedJid);
  if (m?.extendedTextMessage?.contextInfo?.mentionedJid) mentions.push(...m.extendedTextMessage.contextInfo.mentionedJid);
  if (m?.interactiveMessage?.contextInfo?.mentionedJid) mentions.push(...m.interactiveMessage.contextInfo.mentionedJid);
  if (m?.interactiveResponseMessage?.contextInfo?.mentionedJid) mentions.push(...m.interactiveResponseMessage.contextInfo.mentionedJid);
  if (m?.groupMentionedMessage?.contextInfo?.mentionedJid) {
    mentions.push(...m.groupMentionedMessage.contextInfo.mentionedJid);
  }
  const text = extractMessageText(m);
  if (text) {
    mentions.push(...parseMention(text));
  }
  return [...new Set(mentions.map(j => lidToJid(decodeJid(j), sock)).filter(Boolean))];
}
export function applyButtonsToBuilder(builder, buttons = []) {
  if (!builder || !Array.isArray(buttons)) return;
  for (const b of buttons) {
    if (!b) continue;
    if (b.name && b.buttonParamsJson) {
      builder.addButton(b.name, b.buttonParamsJson);
    } else if (Array.isArray(b)) {
      const [displayText, param, type = "quick_reply", extra = false] = b;
      if (type === "cta_url") {
        builder.addUrl(displayText, param, Boolean(extra));
      } else if (type === "cta_copy") {
        builder.addCopy(displayText, param);
      } else if (type === "cta_call") {
        builder.addCall(displayText, param);
      } else if (type === "single_select") {
        builder.addSelection(displayText);
        for (const sec of param || []) {
          builder.makeSection(sec.title || "", sec.highlight_label || "");
          for (const row of sec.rows || []) {
            builder.makeRow(row.header || "", row.title || "", row.description || "", row.id || "");
          }
        }
      } else {
        builder.addReply(displayText, param || displayText);
      }
    } else if (typeof b === "object") {
      const type = b.name || b.type || (b.url ? "cta_url" : b.copy || b.copy_code ? "cta_copy" : b.phone || b.phone_number ? "cta_call" : b.sections ? "single_select" : "quick_reply");
      const displayText = b.text || b.display_text || b.displayText || b.title || "";
      if (type === "cta_url") {
        builder.addUrl(displayText, b.url, Boolean(b.webview_interaction));
      } else if (type === "cta_copy") {
        builder.addCopy(displayText, b.code || b.copy_code || b.copy);
      } else if (type === "cta_call") {
        builder.addCall(displayText, b.phone || b.phone_number || b.id);
      } else if (type === "cta_reminder") {
        builder.addReminder(displayText, b.id || displayText);
      } else if (type === "cta_cancel_reminder") {
        builder.addCancelReminder(displayText, b.id || displayText);
      } else if (type === "address_message") {
        builder.addAddress(displayText, b.id || displayText);
      } else if (type === "send_location") {
        builder.addLocation(b.params || {});
      } else if (type === "request_contact_info") {
        builder.addButton("request_contact_info", "{}");
      } else if (type === "single_select") {
        builder.addSelection(b.title || displayText || "Select Option");
        for (const sec of b.sections || []) {
          builder.makeSection(sec.title || "", sec.highlight_label || "");
          for (const row of sec.rows || []) {
            builder.makeRow(row.header || "", row.title || "", row.description || "", row.id || "");
          }
        }
      } else {
        builder.addReply(displayText, b.id || displayText);
      }
    }
  }
}

function findMediaNode(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 12) return null;
  if (Buffer.isBuffer(obj)) return obj;
  if (obj.mediaKey && (obj.directPath || obj.url || obj.fileSha256 || obj.mimetype)) {
    return obj;
  }
  const interactiveHeader = obj?.interactiveMessage?.header || obj?.header || obj?.interactiveResponseMessage?.header;
  if (interactiveHeader) {
    const headerMedia = interactiveHeader.imageMessage || interactiveHeader.videoMessage || interactiveHeader.documentMessage || interactiveHeader.locationMessage;
    if (headerMedia) {
      const found = findMediaNode(headerMedia, depth + 1);
      if (found) return found;
    }
  }
  const carouselCards = obj?.interactiveMessage?.carouselMessage?.cards || obj?.carouselMessage?.cards || obj?.cards;
  if (Array.isArray(carouselCards) && carouselCards.length > 0) {
    for (const card of carouselCards) {
      const cardMedia = card?.header?.imageMessage || card?.header?.videoMessage || card?.header?.documentMessage || card?.header;
      if (cardMedia) {
        const found = findMediaNode(cardMedia, depth + 1);
        if (found) return found;
      }
    }
  }
  const mediaKeys = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage", "ptvMessage", "documentWithCaptionMessage", "locationMessage"];
  for (const key of mediaKeys) {
    if (obj[key]) {
      const res = findMediaNode(obj[key], depth + 1);
      if (res) return res;
    }
  }
  const wrappers = ["viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension", "viewOnceMessageV3", "ephemeralMessage", "interactiveMessage", "botForwardedMessage", "groupMentionedMessage", "header", "message", "rawMessage", "msg", "media", "fakeObj"];
  for (const w of wrappers) {
    if (obj[w]) {
      const res = findMediaNode(obj[w], depth + 1);
      if (res) return res;
    }
  }
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      const res = findMediaNode(obj[k], depth + 1);
      if (res) return res;
    }
  }
  return null;
}

function resolveMediaType(node) {
  const mime = String(node?.mimetype || "").toLowerCase();
  if (node?.isAnimated !== undefined || mime.includes("webp") || mime.includes("sticker")) return "sticker";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/") || node?.ptt !== undefined || mime.includes("ogg") || mime.includes("opus")) return "audio";
  if (mime.startsWith("application/") || mime.startsWith("text/") || mime.includes("pdf")) return "document";
  return "document";
}
export const downloadMediaNode = async (target, customType = null) => {
  try {
    if (!target) return null;
    if (Buffer.isBuffer(target)) return target;
    let mediaNode = target;
    if (typeof unwrapMessage === "function") mediaNode = unwrapMessage(mediaNode) || mediaNode;
    if (typeof findMediaNode === "function") mediaNode = findMediaNode(mediaNode) || mediaNode;
    if (mediaNode?.ephemeralMessage?.message) mediaNode = mediaNode.ephemeralMessage.message;
    if (mediaNode?.viewOnceMessage?.message) mediaNode = mediaNode.viewOnceMessage.message;
    if (mediaNode?.viewOnceMessageV2?.message) mediaNode = mediaNode.viewOnceMessageV2.message;
    if (mediaNode?.viewOnceMessageV2Extension?.message) mediaNode = mediaNode.viewOnceMessageV2Extension.message;
    if (mediaNode?.viewOnceMessageV3?.message) mediaNode = mediaNode.viewOnceMessageV3.message;
    if (mediaNode?.documentWithCaptionMessage?.message) mediaNode = mediaNode.documentWithCaptionMessage.message;
    const mediaKeys = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage", "ptvMessage"];
    let detectedType = null;
    for (const key of mediaKeys) {
      if (mediaNode?.[key]) {
        detectedType = key.replace(/Message$/i, "").toLowerCase();
        mediaNode = mediaNode[key];
        break;
      }
    }
    if (!mediaNode || typeof mediaNode !== "object" || Buffer.isBuffer(mediaNode)) {
      return Buffer.isBuffer(mediaNode) ? mediaNode : null;
    }
    const hasMediaKey = Boolean(mediaNode.mediaKey || mediaNode.directPath || mediaNode.url);
    if (!hasMediaKey) {
      return null;
    }
    let downloadType = customType ? String(customType).replace(/Message$/i, "").toLowerCase() : detectedType || resolveMediaType(mediaNode);
    if (downloadType === "ptv") downloadType = "video";
    const allowedTypes = new Set(["image", "video", "audio", "sticker", "document"]);
    if (!allowedTypes.has(downloadType)) {
      const mime = (mediaNode.mimetype || "").toLowerCase();
      if (mime.startsWith("image/webp")) downloadType = "sticker";
      else if (mime.startsWith("image/")) downloadType = "image";
      else if (mime.startsWith("video/")) downloadType = "video";
      else if (mime.startsWith("audio/")) downloadType = "audio";
      else if (mime) downloadType = "document";
      else return null;
    }
    const stream = await downloadContentFromMessage(mediaNode, downloadType);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return buffer.length > 0 ? buffer : null;
  } catch (err) {
    const errMsg = err?.message || String(err);
    const isIgnored = /404|410|expired|rate-overlimit|bad decrypt|stream ended|mediaKey/i.test(errMsg);
    if (!isIgnored && global.bot?.debug) {
      console.warn(chalk.yellow(`[DownloadMedia Warning]: ${errMsg}`));
    }
    return null;
  }
};
export const detectDevice = (id = "") => {
  if (!id) return "unknown";
  if (typeof Baileys !== "undefined" && typeof Baileys.getDevice === "function") {
    const dev = Baileys.getDevice(id);
    if (dev) return dev;
  }
  if (/^3A.{18}$/.test(id)) return "ios";
  if (/^3E.{20}$/.test(id)) return "web";
  if (/^(.{21}|.{32})$/.test(id)) return "android";
  if (/^.{18}$/.test(id)) return "desktop";
  return "unknown";
};
export const detectBaileys = (id = "") => {
  if (!id) return false;
  const baileysPrefixes = ["BAE", "B1E", "3EB0", "WA"];
  const baileysLengths = [12, 16, 20, 22, 40];
  return baileysPrefixes.some(pfx => id.startsWith(pfx)) || baileysLengths.includes(id.length);
};
export const safeTokenizeCode = (code, language = "javascript") => {
  return AIRich.tokenizer(code, language).codeBlock;
};
export const extractIE = Toolkit.extractIE;
export async function appendTextMessage(sock, message, text, chatUpdate = {}) {
  const targetJid = decodeJid(message.chat || message.key?.remoteJid);
  const senderJid = decodeJid(message.sender || message.key?.participant || targetJid);
  const isGroup = isJidGroup(targetJid) || targetJid.endsWith("@g.us");
  const generated = await generateWAMessage(targetJid, {
    text: text,
    mentions: message.mentionedJid || message.mentions || [senderJid]
  }, {
    userJid: sock.user?.id ? decodeJid(sock.user.id) : sock.user?.jid,
    quoted: message.quoted && (message.quoted?.fakeObj || message.quoted)
  });
  const myJid = decodeJid(sock.user?.id || sock.user?.jid || "");
  generated.key.fromMe = areJidsSameUser(senderJid, myJid);
  generated.key.id = message.key?.id || generated.key.id;
  generated.pushName = message.pushName || message.name || message.pushname;
  if (isGroup) {
    generated.key.participant = senderJid;
    generated.participant = senderJid;
  }
  const msgObj = {
    ...chatUpdate,
    messages: [proto.WebMessageInfo.fromObject(generated)],
    type: "append"
  };
  sock.ev.emit("messages.upsert", msgObj);
}
export async function copyNForward(sock, jid, message, forwardingScore = true, options = {}, quoted = undefined) {
  if (!message) return null;
  const cleanTargetJid = Baileys.jidNormalizedUser ? Baileys.jidNormalizedUser(decodeJid(jid)) : decodeJid(jid);
  try {
    let webMsg = null;
    if (message.key && message.message) {
      webMsg = message;
    } else if (message.fakeObj || message.vM) {
      webMsg = message.fakeObj || message.vM;
    } else {
      const raw = message.rawMessage || message.message || message.msg || message;
      let constructedMessage = raw?.message || (raw?.mtype ? {
        [raw.mtype]: raw.msg || raw
      } : raw);
      if (!constructedMessage || typeof constructedMessage !== "object" || Object.keys(constructedMessage).length === 0) {
        constructedMessage = {
          conversation: message.text || message.body || " "
        };
      }
      webMsg = {
        key: message.key || {
          remoteJid: cleanTargetJid,
          id: message.id || "3EB0" + crypto.randomBytes(8).toString("hex").toUpperCase(),
          fromMe: Boolean(message.fromMe)
        },
        message: constructedMessage,
        messageTimestamp: Math.floor(Date.now() / 1e3)
      };
    }
    const validWebMessage = proto.WebMessageInfo.fromObject(webMsg);
    let forwardContent = null;
    try {
      forwardContent = await generateForwardMessageContent(validWebMessage, Boolean(forwardingScore));
    } catch {
      forwardContent = validWebMessage.message;
    }
    if (!forwardContent) return null;
    const mtype = Object.keys(forwardContent)[0];
    if (!mtype || !forwardContent[mtype]) return null;
    if (forwardContent[mtype].viewOnce) delete forwardContent[mtype].viewOnce;
    if (!forwardContent[mtype].contextInfo) forwardContent[mtype].contextInfo = {};
    Object.assign(forwardContent[mtype].contextInfo, options.contextInfo || {});
    if (forwardingScore) {
      forwardContent[mtype].contextInfo.isForwarded = true;
      forwardContent[mtype].contextInfo.forwardingScore = typeof forwardingScore === "number" ? forwardingScore : 1;
    } else if (forwardingScore === false) {
      delete forwardContent[mtype].contextInfo.isForwarded;
      delete forwardContent[mtype].contextInfo.forwardingScore;
    }
    if (forwardContent[mtype].contextInfo?.participant?.endsWith?.("@lid")) {
      delete forwardContent[mtype].contextInfo.participant;
    }
    let validQuoted = quoted?.key ? quoted : quoted || undefined;
    if (validQuoted && (!validQuoted.message || typeof validQuoted.message !== "object")) {
      validQuoted = undefined;
    }
    const finalMsg = await generateWAMessageFromContent(cleanTargetJid, forwardContent, {
      userJid: sock.user?.id ? decodeJid(sock.user.id) : sock.user?.jid,
      quoted: validQuoted,
      ephemeralExpiration: options.ephemeralExpiration || WA_DEFAULT_EPHEMERAL,
      ...options
    });
    const isInteractive = Boolean(finalMsg?.message?.viewOnceMessage?.message?.interactiveMessage || finalMsg?.message?.interactiveMessage);
    if (finalMsg?.message && finalMsg?.key?.id) {
      if (isInteractive) {
        await safeRelayInteractive(sock, cleanTargetJid, finalMsg.message, {
          messageId: finalMsg.key.id,
          ...options
        });
      } else {
        await sock.relayMessage(cleanTargetJid, finalMsg.message, {
          messageId: finalMsg.key.id,
          ...options
        });
      }
      return finalMsg;
    }
    return finalMsg;
  } catch (err) {
    console.error(chalk.red("[copyNForward Error]"), err?.message || err);
    throw err;
  }
}
export async function SerializeMessage(sock, msg) {
  if (!msg) return null;
  if (msg.key?.id) {
    global.msgStore.set(msg.key.id, {
      key: msg.key,
      message: msg.message,
      sender: msg.key?.participant || msg.participant || msg.key?.remoteJid,
      timestamp: Date.now()
    });
    if (global.msgStore.size > 2500) {
      const oldestKey = global.msgStore.keys().next().value;
      global.msgStore.delete(oldestKey);
    }
  }
  if (typeof sock.appendTextMessage !== "function") {
    sock.appendTextMessage = (m, text, update = {}) => appendTextMessage(sock, m, text, update);
  }
  if (typeof sock.copyNForward !== "function") {
    sock.copyNForward = (jid, message, forwardingScore = true, options = {}, quoted = undefined) => copyNForward(sock, jid, message, forwardingScore, options, quoted);
  }
  const botId = decodeJid(sock?.user?.id || sock?.user?.jid || "");
  const botLid = sock?.user?.lid ? decodeJid(sock?.user?.lid) : null;
  const botNumber = extractNum(botId);
  let isEdited = false;
  let rawMessage = msg.message || {};
  const isStubEdit = Boolean(msg.messageStubType === 68 || msg.stubType === 68);
  const protocolMsg = rawMessage?.protocolMessage;
  const isProtoEdit = Boolean(protocolMsg && (protocolMsg.type === 14 || protocolMsg.type === proto.ProtocolMessage?.Type?.MESSAGE_EDIT || Boolean(protocolMsg.editedMessage))) || Boolean(rawMessage?.editedMessage);
  if (isStubEdit || isProtoEdit) {
    isEdited = true;
    let unwrappedEdit = protocolMsg?.editedMessage || rawMessage?.editedMessage?.message || rawMessage?.editedMessage || null;
    if (!unwrappedEdit && msg.messageStubParameters?.[0]) {
      try {
        const parsedStub = typeof msg.messageStubParameters[0] === "string" ? JSON.parse(msg.messageStubParameters[0]) : msg.messageStubParameters[0];
        unwrappedEdit = parsedStub?.message || parsedStub;
      } catch {}
    }
    if (unwrappedEdit) {
      rawMessage = unwrappedEdit;
      msg.message = rawMessage;
      if (protocolMsg?.key) {
        msg.key = {
          ...msg.key,
          ...protocolMsg.key,
          participant: msg.key?.participant || protocolMsg.key?.participant
        };
      }
    }
  }
  const m = unwrapMessage(rawMessage) || rawMessage;
  const ctx = {};
  ctx.key = msg.key || {};
  ctx.sock = sock;
  ctx.isEdited = isEdited;
  ctx.botId = botId;
  ctx.botLid = botLid;
  ctx.botJid = botId;
  ctx.botNumber = botNumber;
  const remoteJid = msg.key?.remoteJid || "";
  const remoteJidAlt = msg.key?.remoteJidAlt || null;
  const participantJid = msg.key?.participantJid || null;
  const participantAlt = msg.key?.participantAlt || null;
  if (msg.key?.participant && participantJid) {
    global.lidPhoneCache.set(decodeJid(msg.key.participant), decodeJid(participantJid));
  }
  if (remoteJid?.endsWith("@lid") && remoteJidAlt) {
    global.lidPhoneCache.set(decodeJid(remoteJid), decodeJid(remoteJidAlt));
  }
  const isGroup = isJidGroup ? isJidGroup(remoteJid) : remoteJid.endsWith("@g.us");
  const isStatus = Boolean(remoteJid === "status@broadcast" || remoteJid.startsWith("status@"));
  const isChannel = Boolean(remoteJid.endsWith("@newsletter"));
  let rawSender = isGroup ? participantJid || msg.key?.participant || msg.participant || participantAlt || "" : remoteJidAlt || participantJid || msg.key?.participant || remoteJid;
  const rawSenderAlt = participantJid || participantAlt || remoteJidAlt || null;
  let resolvedChat = await resolveLidToJid(remoteJid, sock, remoteJidAlt);
  if (resolvedChat.endsWith("@lid") && typeof resolveLidProactively === "function") {
    const pro = await resolveLidProactively(sock, resolvedChat);
    if (pro.jid) resolvedChat = pro.jid;
  }
  ctx.id = resolvedChat;
  ctx.chat = ctx.id;
  ctx.from = ctx.id;
  ctx.group = isGroup;
  ctx.isGroup = isGroup;
  ctx.isStatus = isStatus;
  ctx.isChannel = isChannel;
  ctx.broadcast = Boolean(msg.broadcast || isStatus);
  ctx.status = msg.status ?? 2;
  ctx.messageTimestamp = msg.messageTimestamp ? parseInt(msg.messageTimestamp) : Math.floor(Date.now() / 1e3);
  let resolvedSender = await resolveLidToJid(rawSender, sock, rawSenderAlt);
  if (resolvedSender.endsWith("@lid") && typeof resolveLidProactively === "function") {
    const pro = await resolveLidProactively(sock, resolvedSender);
    if (pro.jid) resolvedSender = pro.jid;
  }
  ctx.sender = resolvedSender;
  ctx.senderAlt = rawSenderAlt ? decodeJid(rawSenderAlt) : null;
  ctx.userPhoneJid = !ctx.sender.endsWith("@lid") ? ctx.sender : ctx.senderAlt && !ctx.senderAlt.endsWith("@lid") ? ctx.senderAlt : ctx.sender;
  ctx.senderNumber = extractNum(ctx.userPhoneJid);
  if (!isGroup && ctx.chat.endsWith("@lid") && ctx.userPhoneJid && !ctx.userPhoneJid.endsWith("@lid")) {
    ctx.chat = ctx.userPhoneJid;
    ctx.id = ctx.userPhoneJid;
    ctx.from = ctx.userPhoneJid;
  }
  ctx.pushName = msg.pushName || null;
  ctx.pushname = ctx.pushName;
  ctx.fromMe = Boolean(msg.key?.fromMe);
  ctx.isFromMe = ctx.fromMe;
  ctx.isBot = areJidsSameUser(ctx.sender, botId) || botLid && areJidsSameUser(ctx.sender, botLid) || ctx.senderAlt && areJidsSameUser(ctx.senderAlt, botId) || ctx.senderAlt && botLid && areJidsSameUser(ctx.senderAlt, botLid);
  const rawOwners = [...Array.isArray(global.bot?.owner) ? global.bot.owner.flat(Infinity) : [global.bot?.owner], global.bot?.author?.number].filter(Boolean);
  const ownerNumbers = new Set();
  const ownerJids = new Set();
  for (const o of rawOwners) {
    const num = String(o).replace(/\D/g, "");
    if (num.length >= 6) {
      ownerNumbers.add(num);
      ownerJids.add(`${num}@s.whatsapp.net`);
    }
  }
  for (const num of ownerNumbers) {
    if (ctx.senderNumber === num && rawSender.endsWith("@lid")) {
      global.lidPhoneCache.set(rawSender, `${num}@s.whatsapp.net`);
      ctx.sender = `${num}@s.whatsapp.net`;
      ctx.userPhoneJid = `${num}@s.whatsapp.net`;
    }
  }
  const checkIsOwner = (candidates = []) => {
    return candidates.filter(Boolean).some(cand => {
      const cleanCand = decodeJid(cand);
      const candNum = extractNum(cleanCand);
      return ownerJids.has(cleanCand) || ownerNumbers.has(candNum) || ownerJids.has(Baileys.jidNormalizedUser(cleanCand));
    });
  };
  const isOwnerJid = checkIsOwner([ctx.sender, ctx.senderAlt, ctx.userPhoneJid, ctx.senderNumber, rawSender, rawSenderAlt]);
  const userData = global.db?.user?.[ctx.userPhoneJid] || global.db?.user?.[ctx.sender] || null;
  ctx.user = userData;
  ctx.groupData = ctx.isGroup ? global.db?.group?.[ctx.chat] || null : null;
  ctx.db = global.db || {};
  ctx.isROwner = isOwnerJid || ctx.isFromMe;
  ctx.isOwner = ctx.isFromMe || ctx.isBot || isOwnerJid || userData?.ownerAcces === true;
  ctx.isPremium = Boolean(userData?.premium?.status || ctx.isOwner);
  const {
    mtype,
    msg: parsedMsg
  } = getMessagePayload(m);
  ctx.rawMessage = rawMessage;
  ctx.message = m;
  ctx.mtype = mtype;
  ctx.msgType = mtype;
  ctx.type = mtype;
  ctx.msg = parsedMsg;
  ctx.timestamp = msg.messageTimestamp ? parseInt(msg.messageTimestamp) * 1e3 : Date.now();
  const keyId = msg.key?.id || ctx.key?.id || "";
  ctx.device = detectDevice(keyId);
  ctx.isBaileys = detectBaileys(keyId);
  ctx.text = extractMessageText(rawMessage) || extractMessageText(m) || "";
  ctx.body = ctx.text;
  ctx.mentionedJid = extractMentions(rawMessage, sock);
  ctx.mentions = ctx.mentionedJid;
  ctx.link = Array.from(new Set(ctx.text.match(/https?:\/\/[^\s]+/gi) || []));
  ctx.reaction = m.reactionMessage ? {
    emoji: m.reactionMessage.text,
    key: m.reactionMessage.key
  } : null;
  ctx.isReaction = Boolean(ctx.reaction);
  let selectedId = null;
  let selectedRowId = null;
  if (m.buttonsResponseMessage) {
    selectedId = m.buttonsResponseMessage.selectedButtonId || null;
  } else if (m.templateButtonReplyMessage) {
    selectedId = m.templateButtonReplyMessage.selectedId || null;
  } else if (m.listResponseMessage) {
    selectedRowId = m.listResponseMessage.singleSelectReply?.selectedRowId || null;
    selectedId = selectedRowId;
  } else if (m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const p = JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
      selectedId = p.id || p.selected_id || p.command || null;
    } catch {}
  }
  ctx.selectedId = selectedId;
  ctx.selectedRowId = selectedRowId;
  const prefixConfig = global.bot?.prefix || ["!", ".", "/", "#"];
  const contextInfo = m?.contextInfo || parsedMsg?.contextInfo || m?.extendedTextMessage?.contextInfo || m?.imageMessage?.contextInfo || m?.videoMessage?.contextInfo || m?.documentMessage?.contextInfo || m?.stickerMessage?.contextInfo || m?.audioMessage?.contextInfo || rawMessage?.messageContextInfo || null;
  ctx.contextInfo = contextInfo;
  ctx.quoted = null;
  if (contextInfo?.quotedMessage) {
    const rawQuoted = contextInfo.quotedMessage;
    const qMsg = unwrapMessage(rawQuoted) || rawQuoted;
    const nestedMedia = findMediaNode(qMsg);
    const {
      mtype: qMtype,
      msg: parsedQMedia
    } = getMessagePayload(qMsg);
    const qMedia = nestedMedia || (typeof parsedQMedia === "string" ? {
      text: parsedQMedia,
      conversation: parsedQMedia
    } : parsedQMedia || {});
    const qMimetype = qMedia?.mimetype || nestedMedia?.mimetype || "";
    const isMediaInQuoted = Boolean(nestedMedia || qMedia && (/image|video|sticker|audio|document|webp/.test(qMimetype) || ["imageMessage", "videoMessage", "stickerMessage", "audioMessage", "documentMessage", "ptvMessage"].includes(qMtype)));
    const qMediaType = isMediaInQuoted ? nestedMedia ? resolveMediaType(nestedMedia) : qMtype.replace(/Message/gi, "").toLowerCase() : null;
    const isQuotedAnimated = Boolean(qMsg?.stickerMessage?.isAnimated || qMedia?.isAnimated || false);
    let rawQuotedSender = contextInfo.participant || contextInfo.participantAlt || contextInfo.remoteJidAlt || contextInfo.remoteJid || "";
    const cachedQuoted = global.msgStore?.get(contextInfo.stanzaId);
    if (cachedQuoted?.sender && !cachedQuoted.sender.endsWith("@lid")) {
      rawQuotedSender = cachedQuoted.sender;
    }
    let groupParticipantsList = [];
    if (ctx.isGroup) {
      groupParticipantsList = sock?.store?.groupMetadata?.[ctx.id]?.participants || sock?.chats?.[ctx.id]?.participants || [];
    }
    let cleanQuotedSender = await resolveLidToJid(decodeJid(rawQuotedSender), sock, contextInfo.participantAlt || contextInfo.remoteJidAlt || (!ctx.isGroup ? ctx.chat : null), groupParticipantsList);
    if (cleanQuotedSender.endsWith("@lid") && typeof resolveLidProactively === "function") {
      const proQuoted = await resolveLidProactively(sock, cleanQuotedSender);
      if (proQuoted.jid) cleanQuotedSender = proQuoted.jid;
    }
    if (!ctx.isGroup && cleanQuotedSender.endsWith("@lid")) {
      const isFromBot = Boolean(cleanQuotedSender === botLid || cleanQuotedSender === botId || contextInfo.stanzaId?.startsWith("3EB0") || contextInfo.stanzaId?.startsWith("BAE5"));
      cleanQuotedSender = isFromBot ? botId : ctx.chat;
    }
    const quotedIsFromMe = cleanQuotedSender ? areJidsSameUser(cleanQuotedSender, botId) || (botLid ? areJidsSameUser(cleanQuotedSender, botLid) : false) : false;
    const quotedStanzaId = contextInfo.stanzaId || "";
    const validQMessagePayload = typeof rawQuoted === "object" && rawQuoted !== null ? rawQuoted : {
      conversation: extractMessageText(rawQuoted) || " "
    };
    const fakeObj = proto.WebMessageInfo.fromObject({
      key: {
        remoteJid: ctx.id,
        fromMe: quotedIsFromMe,
        id: quotedStanzaId,
        participant: cleanQuotedSender
      },
      message: validQMessagePayload,
      messageTimestamp: Math.floor(Date.now() / 1e3)
    });
    const innerContextInfo = qMedia?.contextInfo || qMsg?.contextInfo || rawQuoted?.contextInfo || rawQuoted?.extendedTextMessage?.contextInfo || rawQuoted?.imageMessage?.contextInfo || rawQuoted?.videoMessage?.contextInfo || rawQuoted?.documentMessage?.contextInfo || rawQuoted?.stickerMessage?.contextInfo || rawQuoted?.audioMessage?.contextInfo || null;
    let nestedQuoted = cachedQuoted?.quoted || null;
    if (!nestedQuoted) {
      const cachedMsg = cachedQuoted?.message || cachedQuoted?.rawMessage || cachedQuoted;
      const cachedUnwrapped = unwrapMessage(cachedMsg) || cachedMsg;
      const cachedPayload = getMessagePayload(cachedUnwrapped)?.msg;
      const targetInnerContext = innerContextInfo?.quotedMessage ? innerContextInfo : cachedUnwrapped?.contextInfo?.quotedMessage ? cachedUnwrapped.contextInfo : cachedPayload?.contextInfo?.quotedMessage ? cachedPayload.contextInfo : cachedMsg?.extendedTextMessage?.contextInfo?.quotedMessage ? cachedMsg.extendedTextMessage.contextInfo : null;
      if (targetInnerContext?.quotedMessage) {
        const nestedRaw = targetInnerContext.quotedMessage;
        const nestedMsg = unwrapMessage(nestedRaw) || nestedRaw;
        const nestedMediaNode = findMediaNode(nestedMsg);
        const {
          mtype: nMtype,
          msg: parsedNMedia
        } = getMessagePayload(nestedMsg);
        const nMedia = nestedMediaNode || (typeof parsedNMedia === "string" ? {
          text: parsedNMedia,
          conversation: parsedNMedia
        } : parsedNMedia || {});
        const nMimetype = nMedia?.mimetype || nestedMediaNode?.mimetype || "";
        const isNestedMedia = Boolean(nestedMediaNode || nMedia && (/image|video|sticker|audio|document|webp/.test(nMimetype) || nMtype.endsWith("Message")));
        const nMediaType = isNestedMedia ? nestedMediaNode ? resolveMediaType(nestedMediaNode) : nMtype.replace(/Message/gi, "").toLowerCase() : null;
        let nestedSenderRaw = targetInnerContext.participant || targetInnerContext.participantAlt || targetInnerContext.remoteJidAlt || targetInnerContext.remoteJid || "";
        let cleanNestedSender = await resolveLidToJid(decodeJid(nestedSenderRaw), sock, null, groupParticipantsList);
        if (cleanNestedSender.endsWith("@lid") && typeof resolveLidProactively === "function") {
          const proNested = await resolveLidProactively(sock, cleanNestedSender);
          if (proNested.jid) cleanNestedSender = proNested.jid;
        }
        const nestedIsFromMe = cleanNestedSender ? areJidsSameUser(cleanNestedSender, botId) || (botLid ? areJidsSameUser(cleanNestedSender, botLid) : false) : false;
        const nestedStanzaId = targetInnerContext.stanzaId || "";
        const nestedFakeObj = proto.WebMessageInfo.fromObject({
          key: {
            remoteJid: ctx.id,
            fromMe: nestedIsFromMe,
            id: nestedStanzaId,
            ...ctx.isGroup ? {
              participant: cleanNestedSender
            } : {}
          },
          message: nestedMsg,
          messageTimestamp: Math.floor(Date.now() / 1e3)
        });
        const nestedText = extractMessageText(nestedRaw) || "";
        const nestedSenderNumber = extractNum(cleanNestedSender);
        nestedQuoted = {
          chat: ctx.id,
          from: ctx.id,
          sender: cleanNestedSender,
          senderNumber: nestedSenderNumber,
          id: nestedStanzaId,
          device: detectDevice(nestedStanzaId),
          isBaileys: detectBaileys(nestedStanzaId),
          fromMe: nestedIsFromMe,
          isFromMe: nestedIsFromMe,
          message: nestedMsg,
          rawMessage: nestedRaw,
          fakeObj: nestedFakeObj,
          vM: nestedFakeObj,
          msgType: nMtype,
          mtype: nMtype,
          type: nMtype,
          msg: nMedia,
          media: nMedia,
          text: nestedText,
          body: nestedText,
          contextInfo: targetInnerContext,
          mimetype: nMimetype || null,
          isMedia: isNestedMedia,
          mediaType: nMediaType,
          isViewOnce: Boolean(nestedRaw?.viewOnceMessage || nestedRaw?.viewOnceMessageV2 || nestedRaw?.viewOnceMessageV2Extension || nestedRaw?.viewOnceMessageV3 || nMedia?.viewOnce),
          fileName: nMedia?.fileName || null,
          fileSize: nMedia?.fileLength ? Number(nMedia.fileLength) : null,
          key: {
            remoteJid: ctx.id,
            fromMe: nestedIsFromMe,
            id: nestedStanzaId,
            participant: cleanNestedSender
          },
          download: async () => downloadMediaNode(nMedia || nestedMsg, nMediaType || "image"),
          copyNForward: async (jid = ctx.chat, forwardingScore = true, options = {}) => copyNForward(sock, jid, nestedFakeObj, forwardingScore, options),
          delete: async () => safeSendMessage(sock, ctx.chat, {
            delete: {
              remoteJid: ctx.id,
              fromMe: nestedIsFromMe,
              id: nestedStanzaId,
              participant: cleanNestedSender
            }
          }),
          getQuotedObj: () => nestedFakeObj
        };
      }
    }
    const quotedText = extractMessageText(rawQuoted) || "";
    const quotedSenderNumber = extractNum(cleanQuotedSender);
    const isQuotedOwner = checkIsOwner([cleanQuotedSender, quotedSenderNumber]);
    const isQuotedBot = areJidsSameUser(cleanQuotedSender, botId) || botLid && areJidsSameUser(cleanQuotedSender, botLid) || detectBaileys(quotedStanzaId);
    let qPrefix = null;
    if (prefixConfig instanceof RegExp) {
      qPrefix = quotedText.match(prefixConfig)?.[0] || null;
    } else if (Array.isArray(prefixConfig)) {
      qPrefix = prefixConfig.find(p => quotedText.startsWith(p)) || null;
    } else if (typeof prefixConfig === "string" && quotedText.startsWith(prefixConfig)) {
      qPrefix = prefixConfig;
    }
    const qCleanText = qPrefix ? quotedText.slice(qPrefix.length).trim() : quotedText;
    const qParts = qCleanText.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    const isQuotedViewOnce = Boolean(rawQuoted?.viewOnceMessage || rawQuoted?.viewOnceMessageV2 || rawQuoted?.viewOnceMessageV2Extension || rawQuoted?.viewOnceMessageV3 || qMsg?.viewOnceMessage || qMsg?.viewOnceMessageV2 || qMedia?.viewOnce || false);
    ctx.quoted = {
      chat: ctx.id,
      from: ctx.id,
      sender: cleanQuotedSender,
      senderNumber: quotedSenderNumber,
      id: quotedStanzaId,
      device: detectDevice(quotedStanzaId),
      isBaileys: detectBaileys(quotedStanzaId),
      fromMe: quotedIsFromMe,
      isFromMe: quotedIsFromMe,
      isBot: Boolean(isQuotedBot),
      isOwner: Boolean(quotedIsFromMe || isQuotedOwner || isQuotedBot),
      isROwner: Boolean(isQuotedOwner || quotedIsFromMe),
      mentions: extractMentions(rawQuoted, sock),
      mentionedJid: extractMentions(rawQuoted, sock),
      prefix: qPrefix,
      command: qParts[0]?.toLowerCase() || null,
      cmd: qParts[0]?.toLowerCase() || null,
      args: qParts.slice(1),
      query: qCleanText.slice((qParts[0] || "").length).trim(),
      message: qMsg,
      rawMessage: rawQuoted,
      fakeObj: fakeObj,
      vM: fakeObj,
      quoted: nestedQuoted,
      msgType: qMtype,
      mtype: qMtype,
      type: qMtype,
      msg: qMedia,
      media: qMedia,
      text: quotedText,
      body: quotedText,
      contextInfo: innerContextInfo || contextInfo,
      mimetype: qMimetype || null,
      isMedia: isMediaInQuoted,
      mediaType: qMediaType,
      isViewOnce: isQuotedViewOnce,
      isAnimated: isQuotedAnimated,
      fileName: qMedia?.fileName || null,
      fileSize: qMedia?.fileLength ? Number(qMedia.fileLength) : null,
      key: {
        remoteJid: ctx.id,
        fromMe: quotedIsFromMe,
        id: quotedStanzaId,
        participant: cleanQuotedSender
      },
      download: async () => downloadMediaNode(qMedia || qMsg, qMediaType || "image"),
      copyNForward: async (jid = ctx.chat, forwardingScore = true, options = {}) => copyNForward(sock, jid, fakeObj, forwardingScore, options),
      delete: async () => safeSendMessage(sock, ctx.chat, {
        delete: {
          remoteJid: ctx.id,
          fromMe: quotedIsFromMe,
          id: quotedStanzaId,
          participant: cleanQuotedSender
        }
      }),
      getQuotedObj: () => nestedQuoted ? nestedQuoted : fakeObj
    };
  }
  const mediaContent = ctx.msg;
  const directMime = mediaContent?.mimetype || "";
  const directIsMedia = Boolean(mediaContent && (/image|video|sticker|audio|document|webp/.test(directMime) || ["imageMessage", "videoMessage", "stickerMessage", "audioMessage", "documentMessage", "ptvMessage"].includes(ctx.msgType)));
  const isViewOnce = Boolean(rawMessage?.viewOnceMessage || rawMessage?.viewOnceMessageV2 || rawMessage?.viewOnceMessageV2Extension || rawMessage?.viewOnceMessageV3 || m?.viewOnceMessage || m?.viewOnceMessageV2 || m?.viewOnceMessageV2Extension || mediaContent?.viewOnce || false);
  ctx.mimetype = directMime || ctx.quoted?.mimetype || null;
  ctx.isMedia = directIsMedia || (ctx.quoted?.isMedia ?? false);
  ctx.mediaType = directIsMedia ? ctx.msgType?.replace(/Message/gi, "").toLowerCase() : ctx.quoted?.mediaType || null;
  ctx.fileName = mediaContent?.fileName || ctx.quoted?.fileName || null;
  ctx.fileSize = mediaContent?.fileLength ? Number(mediaContent.fileLength) : ctx.quoted?.fileSize || null;
  ctx.isViewOnce = isViewOnce;
  ctx.isAnimated = Boolean(m?.stickerMessage?.isAnimated || mediaContent?.isAnimated || ctx.quoted?.isAnimated || false);
  ctx.media = directIsMedia ? mediaContent : ctx.quoted?.media || null;
  const text = (ctx.text || "").trim();
  let matchedPrefix = null;
  if (prefixConfig instanceof RegExp) {
    matchedPrefix = text.match(prefixConfig)?.[0] || null;
  } else if (Array.isArray(prefixConfig)) {
    matchedPrefix = prefixConfig.find(p => text.startsWith(p)) || null;
  } else if (typeof prefixConfig === "string" && text.startsWith(prefixConfig)) {
    matchedPrefix = prefixConfig;
  }
  ctx.prefix = matchedPrefix;
  if (ctx.prefix) {
    const withoutPrefix = text.slice(ctx.prefix.length).trim();
    const parts = withoutPrefix.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    ctx.cmd = parts[0]?.toLowerCase() || null;
    ctx.command = ctx.cmd;
    ctx.args = parts.slice(1);
    ctx.query = withoutPrefix.slice((parts[0] || "").length).trim();
  } else {
    const parts = text.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    ctx.cmd = parts[0]?.toLowerCase() || null;
    ctx.command = ctx.cmd;
    ctx.args = parts.slice(1);
    ctx.query = text.slice((parts[0] || "").length).trim();
  }
  ctx.groupMetadata = async () => {
    if (!ctx.isGroup) return null;
    return await sock.groupMetadata(ctx.chat).catch(() => ({}));
  };
  ctx.getAdminStatus = async () => {
    if (!ctx.isGroup) {
      return {
        isAdmin: false,
        isBotAdmin: false,
        participants: [],
        admins: []
      };
    }
    const meta = await ctx.groupMetadata();
    const participants = meta?.participants || [];
    const adminParticipants = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
    const adminJidSet = new Set();
    for (const p of adminParticipants) {
      const realP = await resolveLidToJid(p.id || p.lid || p.jid, sock, null, participants);
      if (realP) adminJidSet.add(realP);
    }
    const admins = Array.from(adminJidSet);
    const senderIdentities = [ctx.sender, ctx.senderAlt, ctx.userPhoneJid].filter(Boolean);
    const botIdentities = [botId, botLid].filter(Boolean);
    const isAdmin = adminParticipants.some(p => {
      const pIds = [p.id, p.lid, p.jid].filter(Boolean);
      return pIds.some(pId => senderIdentities.some(sId => areJidsSameUser(pId, sId)));
    });
    const isBotAdmin = adminParticipants.some(p => {
      const pIds = [p.id, p.lid, p.jid].filter(Boolean);
      return pIds.some(pId => botIdentities.some(bId => areJidsSameUser(pId, bId)));
    });
    ctx.isAdmin = isAdmin;
    ctx.isBotAdmin = isBotAdmin;
    ctx.participants = participants;
    ctx.groupAdmins = admins;
    return {
      isAdmin: isAdmin,
      isBotAdmin: isBotAdmin,
      participants: participants,
      admins: admins
    };
  };
  ctx.isAdmin = false;
  ctx.isBotAdmin = false;
  ctx.participants = [];
  ctx.groupAdmins = [];
  ctx.sendMessage = (targetJidOrContent, contentOrOptions = {}, maybeOptions = {}) => {
    if (typeof targetJidOrContent === "string") {
      return safeSendMessage(sock, targetJidOrContent, contentOrOptions, maybeOptions);
    }
    return safeSendMessage(sock, ctx.id, targetJidOrContent, contentOrOptions);
  };
  ctx.reply = (text, options = {}) => {
    if (typeof options === "number") options = {
      duration: options
    };
    const targetChat = !ctx.isGroup && ctx.chat?.endsWith("@lid") ? ctx.sender?.endsWith("@s.whatsapp.net") ? ctx.sender : ctx.chat : ctx.chat;
    const cleanText = typeof text === "string" ? text : text?.text || JSON.stringify(text);
    const detectedMentions = typeof parseMention === "function" ? parseMention(cleanText) : [];
    const mentions = [...detectedMentions, ...Array.isArray(options.mentions) ? options.mentions : [], ...Array.isArray(options.mentionedJid) ? options.mentionedJid : [], ...Array.isArray(options.contextInfo?.mentionedJid) ? options.contextInfo.mentionedJid : []].filter(Boolean);
    const uniqueMentions = [...new Set(mentions.map(j => decodeJid(j)))];
    let rawQuoted = options.quoted !== undefined ? options.quoted : msg?.key ? msg : undefined;
    let safeQuoted = cleanQuotedForTarget(rawQuoted, targetChat);
    return safeSendMessage(sock, targetChat, {
      text: cleanText,
      mentions: uniqueMentions,
      ...options
    }, {
      quoted: safeQuoted,
      mentions: uniqueMentions,
      ...options
    }).catch(() => {
      return safeSendMessage(sock, targetChat, {
        text: cleanText,
        mentions: uniqueMentions,
        ...options
      });
    });
  };
  ctx.react = (emoji, key = null) => safeSendMessage(sock, ctx.chat, {
    react: {
      text: emoji,
      key: key || msg.key
    }
  }).catch(() => null);
  ctx.delete = (customKey = null) => safeSendMessage(sock, ctx.chat, {
    delete: customKey || msg.key
  }).catch(() => null);
  ctx.edit = (text, options = {}) => safeSendMessage(sock, ctx.chat, {
    text: text,
    edit: msg.key,
    ...options
  });
  ctx.forward = (jid, options = {}) => safeSendMessage(sock, jid, {
    forward: msg,
    ...options
  });
  ctx.sendPoll = async (name = "", values = [], options = {}) => {
    try {
      const pollBuilder = new Poll(sock);
      pollBuilder.setName(name);
      const pollValues = Array.isArray(values) ? values.map(v => typeof v === "string" ? v : String(v)).filter(Boolean) : [String(values)];
      pollBuilder.addOptions(pollValues);
      if (options.selectableCount !== undefined) {
        pollBuilder.setSelectable(Number(options.selectableCount));
      } else if (options.multiSelect !== undefined) {
        pollBuilder.setMultiSelect(Boolean(options.multiSelect));
      }
      if (options.hideVoter !== undefined) pollBuilder.setHideVoter(Boolean(options.hideVoter));
      if (options.canAddOption !== undefined) pollBuilder.setCanAddOption(Boolean(options.canAddOption));
      if (options.toAnnouncementGroup !== undefined) pollBuilder.setAnnouncementGroup(Boolean(options.toAnnouncementGroup));
      if (options.endDate) pollBuilder.setEndDate(options.endDate);
      if (options.correctAnswer || options.quiz) pollBuilder.setQuiz(options.correctAnswer || options.quiz);
      const targetJid = decodeJid(options.jid || ctx.chat);
      const quotedMsg = options.quoted !== undefined ? options.quoted : msg?.key ? msg : undefined;
      return await pollBuilder.send(targetJid, {
        quoted: quotedMsg,
        ...options
      });
    } catch {
      return await safeSendMessage(sock, options.jid || ctx.chat, {
        poll: {
          name: name,
          values: Array.isArray(values) ? values : [String(values)],
          selectableCount: options.selectableCount || 1,
          toAnnouncementGroup: options.toAnnouncementGroup || false
        }
      }, {
        quoted: options.quoted || (msg?.key ? msg : undefined),
        ...options
      });
    }
  };
  ctx.sendPayment = async (amount = 1e4, currency = "IDR", note = "Payment Note", options = {}) => {
    const jid = decodeJid(options.jid || ctx.chat);
    const userJid = sock.user?.id ? decodeJid(sock.user.id) : sock.user?.jid || "";
    let backgroundFile = undefined;
    if (options.image) {
      backgroundFile = Buffer.isBuffer(options.image) ? options.image : {
        url: options.image
      };
    }
    const messageContent = proto.Message.fromObject({
      requestPaymentMessage: {
        amount: {
          currencyCode: currency,
          offset: 0,
          value: amount
        },
        expiryTimestamp: 0,
        amount1000: Math.floor(amount * 1e3),
        currencyCodeIso4217: currency,
        requestFrom: options.from || "13135550002@s.whatsapp.net",
        noteMessage: {
          extendedTextMessage: {
            text: note
          }
        },
        background: backgroundFile
      }
    });
    const messager = await generateWAMessageFromContent(jid, messageContent, {
      userJid: userJid,
      quoted: options.quoted || (msg?.key ? msg : undefined),
      upload: sock?.waUploadToServer || sock?.waUp,
      ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
      ...options
    });
    await safeRelayInteractive(sock, jid, messager.message, {
      messageId: messager.key.id,
      ...options
    });
    return messager;
  };
  ctx.sendEvent = async (name = "acara", description = "acara iya", joinLink = "https://call.whatsapp.com/voice/lRW39aOiDh96wmNtLouWyC", options = {}) => {
    const jid = decodeJid(options.jid || ctx.chat || ctx.id);
    const nowInSeconds = Math.floor(Date.now() / 1e3);
    const messageContent = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          messageContextInfo: {},
          eventMessage: {
            isCanceled: Boolean(options.isCanceled || false),
            name: String(name || "acara"),
            description: String(description || "acara iya"),
            joinLink: String(joinLink || "https://call.whatsapp.com/voice/lRW39aOiDh96wmNtLouWyC"),
            startTime: String(options.startTime || nowInSeconds + 3600),
            endTime: String(options.endTime || nowInSeconds + 10800),
            extraGuestsAllowed: options.extraGuestsAllowed !== false,
            isScheduleCall: Boolean(options.isScheduleCall || false),
            hasReminder: options.hasReminder !== false,
            reminderOffsetSec: String(options.reminderOffsetSec || 3600),
            contextInfo: {
              ...options.contextInfo
            }
          }
        }
      }
    });
    const msgEvent = await generateWAMessageFromContent(jid, messageContent, {
      quoted: options.quoted || (msg?.key ? msg : undefined),
      ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
      ...options
    });
    await safeRelayInteractive(sock, jid, msgEvent.message, {
      messageId: msgEvent.key.id,
      ...options
    });
    return msgEvent;
  };
  ctx.ctaButton = () => new Button(sock).setJid(ctx.chat);
  ctx.button = () => new Button(sock).setJid(ctx.chat);
  ctx.buttonV2 = () => new ButtonV2(sock);
  ctx.aiRich = () => new AIRich(sock);
  ctx.carousel = () => new CustomCarousel(sock);
  ctx.card = () => new Button(sock);
  ctx.poll = () => new Poll(sock);
  ctx.a2ui = (options = {}) => new A2UI(options);
  ctx.album = () => typeof sock.album === "function" ? sock.album() : null;
  ctx.event = () => typeof sock.event === "function" ? sock.event() : null;
  ctx.payment = () => typeof sock.payment === "function" ? sock.payment() : null;
  ctx.order = () => typeof sock.order === "function" ? sock.order() : null;
  ctx.sendGroupStatus = async (content, options = {}) => {
    return await sock.sendMessage(ctx.chat, {
      groupStatus: content
    }, options);
  };
  ctx.sendStatusMentions = async (content, targetJids = []) => {
    if (typeof sock.sendStatusMentions === "function") {
      return await sock.sendStatusMentions(content, targetJids);
    }
    return await sock.sendMessage("status@broadcast", content, {
      statusJidList: targetJids
    });
  };
  ctx.sendA2UI = async (a2uiInstance, options = {}) => {
    const targetChat = options.jid || ctx.chat;
    const finalQuoted = options.quoted !== undefined ? options.quoted : msg?.key ? msg : undefined;
    return await sendA2UIWidget(sock, targetChat, {
      a2ui: a2uiInstance,
      quoted: finalQuoted,
      ...options
    });
  };
  ctx.requestContact = async (body = "Harap bagikan informasi kontak Anda", options = {}) => {
    const jid = decodeJid(options.jid || ctx.chat || ctx.id);
    const btn = new Button(sock);
    btn.setBody(String(body));
    if (options.footer) btn.setFooter(options.footer);
    if (options.title) btn.setTitle(options.title);
    if (options.subtitle) btn.setSubtitle(options.subtitle);
    btn.addButton("request_contact_info", "{}");
    if (options.contextInfo) btn.setContextInfo(options.contextInfo);
    return await btn.send(jid, {
      quoted: options.quoted || (msg?.key ? msg : undefined),
      ...options
    });
  };
  ctx.sendButtonsMessage = async (params = {}) => {
    const jid = decodeJid(params.jid || ctx.chat);
    const btnV2 = new ButtonV2(sock);
    if (params.text || params.contentText) btnV2.setBody(params.text || params.contentText);
    if (params.footer || params.footerText) btnV2.setFooter(params.footer || params.footerText || global.bot?.footer || "");
    if (params.locationMessage) {
      await btnV2.setLocation(params.locationMessage.jpegThumbnail || params.locationMessage.thumbnail, params.locationMessage.name, params.locationMessage.address);
    } else if (params.imageMessage || params.image) {
      btnV2.setImage(params.imageMessage || params.image);
    } else if (params.videoMessage || params.video) {
      btnV2.setVideo(params.videoMessage || params.video);
    } else if (params.documentMessage || params.document) {
      btnV2.setDocument(params.documentMessage || params.document);
    }
    for (const b of params.buttons || []) {
      if (b.buttonId && b.buttonText) {
        btnV2.addRawButton(b);
      } else {
        btnV2.addButton(b.display_text || b.displayText || b.text || "Klik", b.id || b.buttonId);
      }
    }
    if (params.contextInfo) btnV2.setContextInfo(params.contextInfo);
    return await btnV2.send(jid, {
      quoted: params.quoted || (msg?.key ? msg : undefined),
      ...params
    });
  };
  ctx.sendButtonLocation = async (title, text, footer, location = {}, buttons = [], options = {}) => {
    const jid = decodeJid(options.jid || ctx.chat);
    const btnV2 = new ButtonV2(sock);
    btnV2.setBody(text);
    btnV2.setFooter(footer);
    await btnV2.setLocation(location.thumbnail || location.image || location.thumb || location.jpegThumbnail || location.thumbnailUrl, location.name || title || global.bot?.name || "Location Card", location.address || `📍 ${new Date().toLocaleDateString("id-ID")}`);
    for (const b of buttons || []) {
      if (b.nativeFlowInfo || b.buttonId && b.buttonText) {
        btnV2.addRawButton(b);
      } else {
        btnV2.addButton(b.display_text || b.displayText || b.text || b.title || "Klik", b.id || b.buttonId);
      }
    }
    if (options.contextInfo) btnV2.setContextInfo(options.contextInfo);
    return await btnV2.send(jid, {
      quoted: options.quoted || (msg?.key ? msg : undefined),
      ...options
    });
  };
  ctx.sendCta = async (body = "", footer = "", buttons = [], options = {}, retries = 2) => {
    const rawJid = options.jid || ctx.chat || ctx.id;
    let jid = decodeJid(rawJid);
    if (!ctx.isGroup && jid?.endsWith("@lid") && ctx.userPhoneJid && !ctx.userPhoneJid.endsWith("@lid")) {
      jid = ctx.userPhoneJid;
    }
    try {
      const btn = new Button(sock);
      if (body) btn.setBody(String(body));
      if (footer) btn.setFooter(String(footer));
      if (options.title || options.header) btn.setTitle(String(options.title || options.header || ""));
      if (options.subtitle) btn.setSubtitle(String(options.subtitle || ""));
      const loc = options.locationMessage || options.location;
      if (loc && typeof loc === "object") {
        await btn.setLocation(loc.jpegThumbnail || loc.thumbnail || loc.image || loc.thumb || loc.thumbnailUrl, loc.name || options.title || "", loc.address || "");
      } else if (options.media || options.image || options.video || options.document) {
        const mediaTarget = options.media || options.image || options.video || options.document;
        const isVideo = options.video || options.mediaType === "video" || /video/i.test(options.mime || "");
        const isDocument = options.document || options.mediaType === "document" || /document|pdf/i.test(options.mime || "");
        if (isDocument) btn.setDocument(mediaTarget);
        else if (isVideo) btn.setVideo(mediaTarget);
        else btn.setImage(mediaTarget);
      }
      applyButtonsToBuilder(btn, buttons);
      if (options.params) btn.setParams(options.params);
      const autoDetected = typeof parseMention === "function" ? parseMention(`${body} ${footer}`) : [];
      const ctaMentions = [...autoDetected, ...Array.isArray(options.mentions) ? options.mentions : [], ...Array.isArray(options.mentionedJid) ? options.mentionedJid : [], ...Array.isArray(options.contextInfo?.mentionedJid) ? options.contextInfo.mentionedJid : []].filter(Boolean);
      const uniqueCtaMentions = [...new Set(ctaMentions.map(j => decodeJid(j)))];
      const ctaContextInfo = {
        ...options.contextInfo || {},
        mentionedJid: uniqueCtaMentions
      };
      btn.setContextInfo(ctaContextInfo);
      const targetQuoted = cleanQuotedForTarget(options.quoted || (msg?.key ? msg : undefined), jid);
      return await btn.send(jid, {
        quoted: targetQuoted,
        ...options
      });
    } catch (err) {
      const errorMsg = String(err?.message || "").toLowerCase();
      const statusCode = err?.output?.statusCode || err?.status;
      if (retries > 0 && (statusCode === 428 || statusCode === 499 || statusCode === 515 || errorMsg.includes("closed") || errorMsg.includes("precondition"))) {
        await sleep(500);
        return await ctx.sendCta(body, footer, buttons, options, retries - 1);
      }
      console.error(chalk.red("[sendCta Error / Connection Issue]"), err?.message || err);
      try {
        const fallbackMentions = typeof parseMention === "function" ? parseMention(String(body || "")) : [];
        const fallbackQuoted = cleanQuotedForTarget(options.quoted || (msg?.key ? msg : undefined), jid);
        return await sock.sendMessage(jid, {
          text: `${options.title ? `*〔 ${options.title} 〕*\n\n` : ""}${body}\n\n_${footer}_`,
          mentions: fallbackMentions,
          contextInfo: {
            mentionedJid: fallbackMentions
          }
        }, {
          quoted: fallbackQuoted
        });
      } catch {
        return null;
      }
    }
  };
  ctx.sendButton = async (text = "", footer = "", media = null, buttons = [], options = {}) => {
    return await ctx.sendCta(text, footer, buttons, {
      media: media,
      ...options
    });
  };
  ctx.sendList = async (title = "", text = "", footer = "", buttonText = "Pilih Opsi", listSections = [], options = {}) => {
    return await ctx.sendLists(title, text, footer, null, buttonText, listSections, options);
  };
  ctx.sendLists = async (title = "", text = "", footer = "", media = null, buttonText = "Pilih Menu", listSections = [], options = {}) => {
    const rawJid = options.jid || ctx.chat || ctx.id;
    let jid = decodeJid(rawJid);
    if (!ctx.isGroup && jid?.endsWith("@lid") && ctx.userPhoneJid && !ctx.userPhoneJid.endsWith("@lid")) {
      jid = ctx.userPhoneJid;
    }
    const btn = new Button(sock);
    if (title) btn.setTitle(title);
    if (text) btn.setBody(text);
    if (footer) btn.setFooter(footer);
    if (media) btn.setImage(media);
    btn.addSelection(buttonText);
    let sections = [];
    if (Array.isArray(listSections?.[0]) && typeof listSections?.[0]?.[0] === "string") {
      sections = listSections.map(section => ({
        title: section?.[0] || "",
        rows: (section?.[1] || []).map(row => ({
          title: row?.[0] || "",
          id: row?.[1] || row?.[0] || "",
          description: row?.[2] || ""
        }))
      }));
    } else {
      sections = (listSections || []).map(section => ({
        title: section.title || "",
        rows: (section.rows || []).map(row => ({
          title: row.title || row.id || "",
          id: row.id || row.rowId || row.title || "",
          description: row.description || ""
        }))
      }));
    }
    for (const sec of sections) {
      btn.makeSection(sec.title || "Menu");
      for (const row of sec.rows) {
        btn.makeRow("", row.title, row.description, row.id);
      }
    }
    if (options.contextInfo) btn.setContextInfo(options.contextInfo);
    return await btn.send(jid, {
      quoted: options.quoted || (msg?.key ? msg : undefined),
      ...options
    });
  };
  ctx.sendSlide = async (text = "", footer = "", slides = [], options = {}) => {
    const carousel = new CustomCarousel(sock);
    if (text) carousel.setBody(text);
    if (footer) carousel.setFooter(footer);
    for (const item of slides) {
      if (Array.isArray(item)) {
        const [cardBody = "", cardFooter = "", header = "", mediaUrl, buttons = []] = item;
        const card = new Button(sock);
        if (header) card.setTitle(header);
        if (cardBody) card.setBody(cardBody);
        if (cardFooter) card.setFooter(cardFooter);
        if (mediaUrl) card.setImage(mediaUrl);
        else card.setImage("https://telegra.ph/file/0c42ec76100c5c4e9e048.jpg");
        applyButtonsToBuilder(card, buttons);
        const compiled = await card.toCard();
        carousel.addCard(compiled);
      } else if (item instanceof Button || item?.toCard) {
        const compiled = await item.toCard();
        carousel.addCard(compiled);
      } else {
        carousel.addCard(item);
      }
    }
    return await carousel.send(options.jid || ctx.chat, {
      quoted: options.quoted || (msg?.key ? msg : undefined),
      ...options
    });
  };
  ctx.sendCarousel = async (text = "", footer = "", text2 = "", messages = [], options = {}) => {
    if (Array.isArray(messages) && messages.length > 0) {
      const carousel = new CustomCarousel(sock);
      if (text) carousel.setTitle(text);
      if (text2) carousel.setSubtitle(text2);
      if (footer) carousel.setFooter(footer);
      for (const item of messages) {
        if (Array.isArray(item)) {
          const [cardText = "", cardFooter = "", buffer, buttons = [], copy = [], urls = [], list = []] = item;
          const card = new Button(sock);
          if (text2) card.setTitle(text2);
          if (cardText) card.setBody(cardText);
          if (cardFooter) card.setFooter(cardFooter);
          if (buffer) card.setImage(buffer);
          else card.setImage("https://telegra.ph/file/0c42ec76100c5c4e9e048.jpg");
          (buttons || []).forEach(([btnText, id]) => card.addReply(btnText, id));
          (copy || []).forEach(([copyText]) => card.addCopy("Copy", copyText));
          (urls || []).forEach(([urlText, url]) => card.addUrl(urlText, url));
          (list || []).forEach(([listTitle, sections]) => card.addList(listTitle, sections));
          const compiled = await card.toCard();
          carousel.addCard(compiled);
        } else if (item instanceof Button || item?.toCard) {
          const compiled = await item.toCard();
          carousel.addCard(compiled);
        } else {
          carousel.addCard(item);
        }
      }
      return await carousel.send(options.jid || ctx.chat, {
        quoted: options.quoted || (msg?.key ? msg : undefined),
        ...options
      });
    }
    return null;
  };
  ctx.sendButtonCta = async (messages = [], options = {}) => {
    return await ctx.sendCarousel("", "", "", messages, options);
  };
  ctx.sendCode = async (code, language = "javascript", options = {}) => {
    if (typeof language === "object" && language !== null) {
      options = language;
      language = options.language || "javascript";
    }
    let disclaimerText = "";
    let textBefore = "";
    let textAfter = "";
    let customJid = ctx.chat;
    let customQuoted = msg?.key ? msg : undefined;
    if (typeof options === "string") {
      disclaimerText = options;
    } else if (typeof options === "object" && options !== null) {
      disclaimerText = options.disclaimerText || options.disclaimer || options.title || "";
      textBefore = options.textBefore || options.header || "";
      textAfter = options.textAfter || options.footer || "";
      if (options.jid) customJid = options.jid;
      if (options.quoted) customQuoted = options.quoted;
    }
    try {
      const rich = new AIRich(sock);
      if (disclaimerText) rich.setTitle(disclaimerText);
      if (textBefore) rich.addText(textBefore);
      rich.addCode(String(language || "javascript"), String(code || ""));
      if (textAfter) rich.addText(textAfter);
      return await rich.send(customJid, {
        quoted: customQuoted,
        forwarded: options.forwarded !== false,
        ...typeof options === "object" ? options : {}
      });
    } catch (err) {
      const fallbackText = `${textBefore ? `${textBefore}\n\n` : ""}*\`\`\`${language}\n${code}\n\`\`\`*${textAfter ? `\n\n${textAfter}` : ""}`;
      return await safeSendMessage(sock, customJid, {
        text: fallbackText
      }, {
        quoted: customQuoted
      });
    }
  };
  ctx.sendRich = async (params = {}) => {
    const options = typeof params === "string" ? {
      html: params
    } : params || {};
    const {
      title = "Interactive App",
        html = "",
        trustedSources = ["shanks.dev"],
        buttonTitle = "",
        botJid = "867051314767696@bot",
        quoted = null,
        jid = ctx.chat
    } = options;
    try {
      const rawPayloadText = (html || title).trim();
      const trusted = Array.isArray(trustedSources) && trustedSources.length > 0 ? trustedSources : ["shanks.dev"];
      const displayMessageText = buttonTitle || (title ? `\n✨ *${title}*\n` : "\n✨ *Interactive View*\n");
      const rich = new AIRich(sock);
      if (title) rich.setTitle(title);
      rich.addSubmessage({
        messageType: 2,
        messageText: displayMessageText
      });
      rich.addSection(AIRich.newLayout("Single", {
        __typename: "GenAIaeacdsnwHtmlPrimitive",
        payload: rawPayloadText,
        trusted_sources: trusted
      }));
      if (options.contextInfo) rich.setContextInfo(options.contextInfo);
      return await rich.send(jid, {
        quoted: quoted || (msg?.key ? msg : undefined),
        ...options
      });
    } catch (err) {
      console.error("[ctx.sendRich Error]:", err?.message || err);
      return await ctx.reply(`*〔 ${title} 〕*\n\n${buttonTitle || html}`);
    }
  };
  ctx.sendContact = async (targetJidOrData, maybeData = null, maybeQuoted = null, options = {}) => {
    let jid = ctx.chat;
    let data = targetJidOrData;
    let quoted = maybeQuoted || (msg?.key ? msg : undefined);
    if (typeof targetJidOrData === "string" && targetJidOrData.includes("@")) {
      jid = targetJidOrData;
      data = maybeData;
    } else if (maybeData && typeof maybeData === "object" && !Array.isArray(maybeData)) {
      options = maybeData;
      quoted = options.quoted || (msg?.key ? msg : undefined);
    }
    if (!Array.isArray(data)) return null;
    if (!Array.isArray(data[0]) && typeof data[0] === "string") data = [data];
    let contacts = [];
    for (let [number, name] of data) {
      if (!number) continue;
      const cleanNumber = String(number).replace(/[^0-9]/g, "");
      const njid = cleanNumber + "@s.whatsapp.net";
      const displayName = String(name || cleanNumber);
      let biz = {};
      try {
        if (typeof sock.getBusinessProfile === "function") {
          biz = await sock.getBusinessProfile(njid) || {};
        }
      } catch {}
      let photoBase64 = "";
      if (biz.description) {
        try {
          const ppUrl = await sock.profilePictureUrl(njid, "image");
          if (ppUrl) {
            const res = await axios.get(ppUrl, {
              responseType: "arraybuffer",
              timeout: 1e4
            });
            photoBase64 = Buffer.from(res.data).toString("base64");
          }
        } catch {}
      }
      let vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${displayName.replace(/\n/g, "\\n")}`, "ORG:", `item1.TEL;waid=${cleanNumber}:+${cleanNumber}`, "item1.X-ABLabel:Ponsel", biz.email ? `item2.EMAIL;type=INTERNET:${(biz.email || "").replace(/\n/g, "\\n")}` : "", biz.email ? "item2.X-ABLabel:Email" : "", photoBase64 ? `PHOTO;BASE64:${photoBase64}` : "", biz.description ? `X-WA-BIZ-DESCRIPTION:${(biz.description || "").replace(/\n/g, "\\n")}` : "", `X-WA-BIZ-NAME:${displayName.replace(/\n/g, "\\n")}`, "END:VCARD"].filter(Boolean).join("\n").trim();
      contacts.push({
        vcard: vcard,
        displayName: displayName
      });
    }
    return await safeSendMessage(sock, jid, {
      ...options,
      contacts: {
        ...options,
        displayName: contacts.length >= 2 ? `${contacts.length} kontak` : contacts[0]?.displayName || null,
        contacts: contacts
      }
    }, {
      quoted: quoted,
      ...options
    });
  };
  ctx.download = async (customMedia = null) => {
    try {
      if (customMedia) return await downloadMediaNode(customMedia);
      if (ctx.quoted?.isMedia || ctx.quoted?.msg) {
        const qBuf = await downloadMediaNode(ctx.quoted.msg || ctx.quoted.message || ctx.quoted.rawMessage);
        if (qBuf) return qBuf;
      }
      if (ctx.isMedia || ctx.msg) {
        const mBuf = await downloadMediaNode(ctx.msg || ctx.message || ctx.rawMessage);
        if (mBuf) return mBuf;
      }
      return null;
    } catch (err) {
      console.error(chalk.red("[ctx.download Error]"), err?.message || err);
      return null;
    }
  };
  ctx.getName = (jid = ctx.sender) => {
    const id = lidToJid(decodeJid(jid || ctx.sender || ""), sock);
    if (!id) return "Unknown";
    const c = sock.contacts?.[id] || sock.store?.contacts?.[id] || sock.chats?.[id] || sock.store?.chats?.[id] || {};
    return cleanId(id) === cleanId(ctx.sender) && (ctx.pushname || ctx.pushName) || cleanId(id) === cleanId(botId) && (sock.user?.name || sock.user?.pushname) || c.name || c.notify || c.verifiedName || c.subject || extractNum(id) || "Unknown";
  };
  ctx.appendTextMessage = async (text, chatUpdate = {}) => {
    return await appendTextMessage(sock, msg, text, chatUpdate);
  };
  ctx.copyNForward = (jid = ctx.chat, targetMessage = msg, forwardingScore = true, options = {}, customQuoted = undefined) => {
    return copyNForward(sock, jid, targetMessage, forwardingScore, options, customQuoted);
  };
  const validVMPayload = ctx.rawMessage && typeof ctx.rawMessage === "object" ? ctx.rawMessage : {
    conversation: ctx.text || " "
  };
  ctx.vM = proto.WebMessageInfo.fromObject({
    key: ctx.key,
    message: validVMPayload,
    messageTimestamp: ctx.messageTimestamp
  });
  const resolveQuotedFromStore = async targetId => {
    if (!targetId) return null;
    const store = global.msgStore || null;
    if (!store) return null;
    let cached = store.get(targetId);
    if (!cached) {
      for (const [k, v] of store.entries()) {
        if (k === targetId || v?.key?.id === targetId || v?.id === targetId) {
          cached = v;
          break;
        }
      }
    }
    if (cached) {
      if (cached.quoted !== undefined && cached.sender !== undefined) {
        return cached;
      }
      const rawTarget = cached.fakeObj || cached.vM || cached.msg || (cached.key ? cached : null);
      if (rawTarget) {
        return await SerializeMessage(sock, rawTarget);
      }
    }
    return null;
  };
  ctx.getQuotedObj = async () => {
    if (!ctx.quoted?.id) return null;
    const res = await resolveQuotedFromStore(ctx.quoted.id);
    return res || ctx.quoted;
  };
  if (ctx.quoted) {
    ctx.quoted.getQuotedObj = async () => {
      if (ctx.quoted.quoted) return ctx.quoted.quoted;
      const res = await resolveQuotedFromStore(ctx.quoted.id);
      return res?.quoted || res || ctx.quoted;
    };
  }
  return ctx;
}