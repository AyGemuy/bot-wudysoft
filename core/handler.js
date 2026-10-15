import chalk from "chalk";
import axios from "axios";
import {
  jidNormalizedUser,
  areJidsSameUser,
  proto,
  generateWAMessageFromContent,
  generateMessageID,
  prepareWAMessageMedia
} from "@whiskeysockets/baileys";
import {
  getExpNeeded
} from "./tools.js";
import {
  contactQuoted,
  metaQuoted
} from "../lib/quoted.js";
import {
  badwordList
} from "../lib/badword.js";
import db from "../data/db.js";
import {
  extractMessageText,
  getBody,
  resolveLidToJid,
  resolveLidProactively,
  decodeJid,
  extractNum,
  safeSendMessage,
  unwrapMessage,
  resizeImage,
  applyButtonsToBuilder,
  Button,
  ButtonV2,
  Carousel,
  AIRich,
  Poll,
  Toolkit
} from "./serialize.js";
const WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
const cooldowns = new Map();
const userSpamMap = new Map();
let isMigratingLid = false;

function sanitizeMentions(list = []) {
  if (!Array.isArray(list)) return [];
  return list.filter(Boolean).map(j => decodeJid(String(j).trim())).filter(j => j.endsWith("@s.whatsapp.net") && !j.endsWith("@lid"));
}

function sanitizeQuotedMessage(msg, targetJid, isGroup) {
  if (!msg || !msg.key) return msg;
  const cleanMsg = {
    ...msg,
    key: {
      ...msg.key,
      remoteJid: !isGroup ? targetJid : msg.key.remoteJid
    }
  };
  if (!isGroup) {
    delete cleanMsg.key.participant;
    delete cleanMsg.key.participantAlt;
    delete cleanMsg.key.remoteJidAlt;
  }
  return cleanMsg;
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1e3 % 60);
  const min = Math.floor(ms / (1e3 * 60) % 60);
  const hrs = Math.floor(ms / (1e3 * 60 * 60) % 24);
  const days = Math.floor(ms / (1e3 * 60 * 60 * 24));
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hrs) parts.push(`${hrs}h`);
  if (min) parts.push(`${min}m`);
  if (sec || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(" ");
}

function getRankTitle(level) {
  if (level >= 100) return "🌟 Mythic Overlord";
  if (level >= 75) return "👑 Grandmaster";
  if (level >= 50) return "⚔️ Master";
  if (level >= 35) return "💎 Diamond Hero";
  if (level >= 20) return "🛡️ Platinum Knight";
  if (level >= 10) return "🥉 Gold Warrior";
  if (level >= 5) return "🥈 Silver Adventurer";
  return "🌱 Novice Traveler";
}
async function sendInteractiveViewOnce(sock, jid, {
  title = "",
  subtitle = "",
  body = "",
  footer = "",
  media = null,
  buttons = [],
  mentions = []
}, quoted = undefined) {
  const cleanJid = decodeJid(jid);
  const safeMentions = sanitizeMentions(mentions);
  try {
    const btn = new Button(sock);
    if (body) btn.setBody(body);
    if (footer) btn.setFooter(footer);
    if (title) btn.setTitle(title);
    if (subtitle) btn.setSubtitle(subtitle);
    if (media) btn.setImage(media);
    applyButtonsToBuilder(btn, buttons);
    if (safeMentions.length > 0) {
      btn.setContextInfo({
        mentionedJid: safeMentions
      });
    }
    return await btn.send(cleanJid, {
      quoted: quoted || undefined,
      mentions: safeMentions
    });
  } catch (err) {
    const fallbackCaption = `–  *${(title || subtitle || "I N F O").toUpperCase()}*\n\n${body}\n\n_${footer}_`.trim();
    try {
      if (media) {
        const mediaObj = Buffer.isBuffer(media) ? media : typeof media === "string" ? {
          url: media
        } : media;
        return await safeSendMessage(sock, cleanJid, {
          image: mediaObj,
          caption: fallbackCaption,
          mentions: safeMentions
        }, {
          quoted: quoted || undefined
        });
      }
      return await safeSendMessage(sock, cleanJid, {
        text: fallbackCaption,
        mentions: safeMentions
      }, {
        quoted: quoted || undefined
      });
    } catch (_) {
      return await safeSendMessage(sock, cleanJid, {
        text: fallbackCaption.replace(/@\d+/g, "")
      }, {
        quoted: quoted || undefined
      }).catch(() => {});
    }
  }
}
export async function migrateLidToJid(dbData, sock = null) {
  if (!dbData?.user || isMigratingLid) return;
  isMigratingLid = true;
  try {
    const users = dbData.user;
    let changed = false;
    for (const key of Object.keys(users)) {
      if (!key.endsWith("@lid")) continue;
      let realJid = sock ? await resolveLidToJid(key, sock) : null;
      if (realJid?.endsWith("@lid") && typeof resolveLidProactively === "function") {
        const pro = await resolveLidProactively(sock, realJid);
        if (pro.jid) realJid = pro.jid;
      }
      const jidKey = realJid && !realJid.endsWith("@lid") ? realJid : null;
      if (jidKey) {
        users[jidKey] = users[jidKey] ? {
          ...users[key],
          ...users[jidKey]
        } : users[key];
        delete users[key];
        changed = true;
      }
    }
    if (changed) {
      await db.write(dbData);
      console.log(chalk.green("[TURSO MIGRATE] Migrasi user LID selesai."));
    }
  } catch (e) {
    console.error(chalk.red("[MIGRATE ERROR]:"), e.message);
  } finally {
    isMigratingLid = false;
  }
}
async function normalizeLidCtx(ctx, sock = null) {
  const groupPtcp = ctx.participants || [];
  const botLid = sock?.user?.lid ? decodeJid(sock.user.lid) : null;
  const botJid = sock?.user?.id ? jidNormalizedUser(decodeJid(sock.user.id)) : null;
  if (ctx.sender?.endsWith("@lid")) {
    if (botLid && areJidsSameUser(ctx.sender, botLid)) {
      ctx.sender = botJid;
    } else {
      let resolved = await resolveLidToJid(ctx.sender, sock, ctx.senderAlt || ctx.userPhoneJid, groupPtcp);
      if (resolved.endsWith("@lid") && typeof resolveLidProactively === "function") {
        const pro = await resolveLidProactively(sock, resolved);
        if (pro.jid) resolved = pro.jid;
      }
      ctx.sender = resolved;
    }
  }
  if (ctx.chat?.endsWith("@lid") && !ctx.isGroup) {
    let resolvedChat = ctx.sender?.endsWith("@s.whatsapp.net") ? ctx.sender : await resolveLidToJid(ctx.chat, sock, null, groupPtcp);
    if (resolvedChat.endsWith("@lid") && typeof resolveLidProactively === "function") {
      const pro = await resolveLidProactively(sock, resolvedChat);
      if (pro.jid) resolvedChat = pro.jid;
    }
    ctx.chat = resolvedChat;
    ctx.id = ctx.chat;
    ctx.from = ctx.chat;
  }
  if (ctx.userPhoneJid?.endsWith("@lid")) {
    let resolvedUserPhone = await resolveLidToJid(ctx.userPhoneJid, sock, ctx.senderAlt, groupPtcp);
    if (resolvedUserPhone.endsWith("@lid") && typeof resolveLidProactively === "function") {
      const pro = await resolveLidProactively(sock, resolvedUserPhone);
      if (pro.jid) resolvedUserPhone = pro.jid;
    }
    ctx.userPhoneJid = resolvedUserPhone;
    ctx.senderNumber = extractNum(ctx.userPhoneJid);
  }
  if (ctx.botId && !ctx.botId.endsWith("@lid")) {
    ctx.botJid = jidNormalizedUser(ctx.botId);
  }
  if (ctx.quoted) {
    let quotedParticipant = ctx.quoted.sender || ctx.contextInfo?.participant;
    let quotedIsFromMe = ctx.quoted.isFromMe ?? ctx.quoted.fromMe ?? false;
    ctx.quoted.chat = ctx.chat;
    ctx.quoted.from = ctx.chat;
    if (quotedParticipant) {
      if (botLid && areJidsSameUser(quotedParticipant, botLid)) {
        quotedParticipant = botJid;
        quotedIsFromMe = true;
      } else if (botJid && areJidsSameUser(quotedParticipant, botJid)) {
        quotedParticipant = botJid;
        quotedIsFromMe = true;
      } else if (quotedParticipant.endsWith("@lid")) {
        let cleanQ = await resolveLidToJid(quotedParticipant, sock, null, groupPtcp);
        if (cleanQ.endsWith("@lid") && typeof resolveLidProactively === "function") {
          const proQ = await resolveLidProactively(sock, cleanQ);
          if (proQ.jid) cleanQ = proQ.jid;
        }
        quotedParticipant = cleanQ;
      }
    } else {
      quotedParticipant = quotedIsFromMe ? botJid : ctx.chat;
    }
    ctx.quoted.sender = quotedParticipant;
    ctx.quoted.senderNumber = extractNum(quotedParticipant);
    ctx.quoted.isFromMe = quotedIsFromMe;
    ctx.quoted.fromMe = quotedIsFromMe;
    ctx.quoted.isBot = quotedIsFromMe || areJidsSameUser(quotedParticipant, botJid);
    if (ctx.quoted.key) {
      ctx.quoted.key.remoteJid = ctx.chat;
      ctx.quoted.key.participant = ctx.isGroup ? quotedParticipant : undefined;
      ctx.quoted.key.fromMe = quotedIsFromMe;
    }
    if (ctx.quoted.fakeObj?.key) {
      ctx.quoted.fakeObj.key.remoteJid = ctx.chat;
      ctx.quoted.fakeObj.key.participant = ctx.isGroup ? quotedParticipant : undefined;
      ctx.quoted.fakeObj.key.fromMe = quotedIsFromMe;
    }
  }
}
async function generateLevelUpCard({
  avatar,
  username = "Player",
  currentLevel = 1,
  nextLevel = 2,
  userData = {},
  model
}) {
  try {
    const baseApi = (global.bot?.api?.wudysoft || "").replace(/\/+$/, "");
    const now = new Date();
    const estDate = `EST. ${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    const selectedModel = model ?? Math.floor(Math.random() * 5) + 1;
    const payload = {
      sub_title: "PROTOCOL: LEVEL_UP_EVOLUTION",
      title_l: "LEVEL",
      title_r: `.${nextLevel}`,
      version: "RPG ENGINE V3.0",
      est: estDate,
      users: `Lv. ${nextLevel}`,
      u_title: getRankTitle(nextLevel),
      desc_title: "Character Evolution",
      desc: `Selamat kepada ${username}! Status karakter kamu berhasil meningkat ke Level ${nextLevel}. Pertahankan ritme bertualangmu!`,
      tag_a: `LVL_${nextLevel}`,
      tag_b: "EXP_BOOST",
      tag_c: "RANK_UP",
      adm_title: "Player Profile",
      adm_name: `@${username.replace(/\s+/g, "_").slice(0, 10)}`,
      adm_stat: "ACTIVE",
      cr_name: "HP +20",
      cr_stat: "BUFF",
      ds_name: "ATK +3",
      ds_stat: "BUFF",
      act_title: "Attributes Load",
      avg_title: "MAX_HP",
      avg_count: String(userData.hpMax || 120),
      msg_title: "ATK",
      msg_count: String(userData.atk || 13),
      file_title: "DEF",
      file_count: String(userData.def || 7),
      avatar: avatar || "https://picsum.photos/seed/cyber/200/200",
      model: Number(selectedModel)
    };
    const response = await axios.post(`${baseApi}/api/maker/grup/v1`, payload, {
      responseType: "arraybuffer",
      headers: {
        "Content-Type": "application/json",
        Accept: "image/*, application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 3e4,
      validateStatus: status => status >= 200 && status < 400
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
export async function UpsertMsgHandle(sock, msg, ctx, {
  cmd
}) {
  if (!ctx || !msg) return;
  global.cmd = cmd;
  global.loader = cmd;
  global.msgStore = global.msgStore || new Map();
  const keyId = msg.key?.id || ctx.key?.id;
  if (keyId) {
    const existingCache = global.msgStore.get(keyId);
    global.msgStore.set(keyId, {
      ...typeof existingCache === "object" && existingCache !== null ? existingCache : {},
      ...ctx,
      msg: msg,
      rawMessage: msg.message || ctx.rawMessage,
      message: msg.message || ctx.rawMessage,
      sender: ctx.sender || msg.key?.participant || msg.key?.remoteJid,
      chat: ctx.id || ctx.chat || msg.key?.remoteJid,
      text: ctx.text || extractMessageText(msg.message || msg) || "",
      isEdited: Boolean(ctx.isEdited),
      isFromMe: Boolean(msg.key?.fromMe || ctx.isFromMe),
      quoted: ctx.quoted || null,
      timestamp: Date.now()
    });
    if (global.msgStore.size > 2500) {
      const oldestKey = global.msgStore.keys().next().value;
      global.msgStore.delete(oldestKey);
    }
  }
  const rawSender = ctx.sender || msg.key?.participant || msg.key?.remoteJid;
  const rawSenderAlt = msg.key?.participantAlt || msg.key?.remoteJidAlt || ctx.senderAlt;
  let sender = await resolveLidToJid(decodeJid(rawSender), sock, rawSenderAlt);
  if (sender.endsWith("@lid") && typeof resolveLidProactively === "function") {
    const pro = await resolveLidProactively(sock, sender);
    if (pro.jid) sender = pro.jid;
  }
  const senderAlt = rawSenderAlt ? decodeJid(rawSenderAlt) : null;
  const rawChatId = decodeJid(ctx.id || ctx.chat || msg.key?.remoteJid);
  const isGroup = rawChatId?.endsWith("@g.us") || Boolean(ctx.group || ctx.isGroup);
  if (!sender || sender === "status@broadcast" || sender.endsWith("@newsletter")) return;
  const userPhoneJid = !sender.endsWith("@lid") ? sender : senderAlt && !senderAlt.endsWith("@lid") ? senderAlt : sender;
  const senderNumber = extractNum(userPhoneJid);
  let chatId = isGroup ? rawChatId : userPhoneJid && !userPhoneJid.endsWith("@lid") ? userPhoneJid : sender;
  db.ensureUser(userPhoneJid, ctx.pushname || senderNumber);
  let groupData = null;
  if (isGroup && chatId) {
    db.ensureGroup(chatId);
    groupData = global.db?.group?.[chatId];
  }
  const isFromMe = Boolean(msg.key?.fromMe || ctx.isFromMe);
  const botId = decodeJid(sock.user?.id || sock.user?.jid || "");
  const botLid = sock.user?.lid ? decodeJid(sock.user.lid) : null;
  const botJid = jidNormalizedUser(botId || "");
  const isBot = isFromMe || areJidsSameUser(sender, botJid) || botLid && areJidsSameUser(sender, botLid) || senderAlt && areJidsSameUser(senderAlt, botJid) || senderAlt && botLid && areJidsSameUser(senderAlt, botLid) || Boolean(ctx.isBot) || Boolean(ctx.isBaileys);
  if ((isFromMe || isBot) && !global.bot?.selfbot && isFromMe) return;
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
  const checkIsOwner = (candidates = []) => {
    return candidates.filter(Boolean).some(cand => {
      const cleanCand = decodeJid(cand);
      const candNum = extractNum(cleanCand);
      return ownerJids.has(cleanCand) || ownerNumbers.has(candNum) || ownerJids.has(jidNormalizedUser(cleanCand));
    });
  };
  let isOwnerJid = checkIsOwner([sender, senderAlt, userPhoneJid, ctx.sender, ctx.senderAlt, ctx.userPhoneJid, ctx.senderNumber, rawSender, rawSenderAlt]);
  let isOwner = isOwnerJid || isFromMe && global.bot?.selfbot === true || ctx.isOwner === true;
  let isROwner = isOwnerJid || isFromMe && global.bot?.selfbot === true || ctx.isROwner === true;
  const userData = global.db?.user?.[userPhoneJid] || global.db?.user?.[ctx.sender];
  if (userData && userData.limit === undefined) {
    userData.limit = global.bot?.limit?.free || global.bot?.defaultLimit || 20;
  }
  if (userData?.ownerAcces === true) isOwner = true;
  let isPremium = Boolean(userData?.premium?.status || isOwner);
  if (userData && ctx.pushname && userData.name !== ctx.pushname) {
    userData.name = ctx.pushname;
  }
  ctx.sock = sock;
  ctx.sender = userPhoneJid;
  ctx.senderAlt = senderAlt;
  ctx.userPhoneJid = userPhoneJid;
  ctx.senderNumber = senderNumber;
  ctx.chat = chatId;
  ctx.from = chatId;
  ctx.id = chatId;
  ctx.isGroup = isGroup;
  ctx.isFromMe = isFromMe;
  ctx.isBot = isBot;
  ctx.botId = botId;
  ctx.botLid = botLid;
  ctx.isOwner = isOwner;
  ctx.isROwner = isROwner;
  ctx.isPremium = isPremium;
  ctx.user = userData;
  ctx.groupData = isGroup ? groupData : null;
  ctx.db = global.db;
  ctx.botJid = botJid;
  await normalizeLidCtx(ctx, sock);
  let textBody = (ctx.selectedId || ctx.selectedRowId || typeof ctx.text === "string" && ctx.text.trim() || getBody(ctx.rawMessage || msg?.message || msg) || "").trim();
  ctx.text = textBody;
  ctx.body = textBody;
  if (isGroup) {
    try {
      let cachedMeta = global.groupCache?.get(chatId)?.data;
      if (!cachedMeta) {
        cachedMeta = await sock.groupMetadata(chatId).catch(() => null);
        if (cachedMeta) {
          global.groupCache?.set(chatId, {
            data: cachedMeta,
            time: Date.now()
          });
        }
      }
      if (cachedMeta) {
        ctx.groupMetadata = async () => cachedMeta;
      }
      if (typeof ctx.getAdminStatus === "function") {
        await ctx.getAdminStatus();
      }
      await normalizeLidCtx(ctx, sock);
      if (!isOwner) {
        isOwnerJid = checkIsOwner([ctx.sender, ctx.senderAlt, ctx.userPhoneJid, ctx.senderNumber, sender, userPhoneJid]);
        isOwner = isOwnerJid || isFromMe && global.bot?.selfbot === true || ctx.isOwner || userData?.ownerAcces === true;
        isROwner = isOwnerJid || isFromMe && global.bot?.selfbot === true || ctx.isROwner;
        isPremium = Boolean(userData?.premium?.status || isOwner);
        ctx.isOwner = isOwner;
        ctx.isROwner = isROwner;
        ctx.isPremium = isPremium;
      }
    } catch (_) {}
  }
  const isAntiBotActive = global.bot?.antiBot === true || isGroup && groupData?.antibot === true;
  if (isAntiBotActive && (ctx.isBaileys || ctx.isBot) && !isFromMe && !isOwner) {
    if (isGroup) {
      if (ctx.isBotAdmin) {
        await ctx.delete().catch(() => {});
      }
      const antiBotNotice = `–  *A N T I - B O T*\n\n` + `Terdeteksi aktivitas bot lain terkirim di dalam grup.\n\n` + `┌  ◦  *User* : @${senderNumber}\n` + `└  ◦  *Status* : Bot Unauthorized\n\n` + `_Pilih tindakan di bawah untuk mengeluarkan bot ini._`;
      const prefix = ctx.prefix || ".";
      const buttons = [{
        name: "quick_reply",
        display_text: "Kick Bot",
        id: `${prefix}kick ${senderNumber}`
      }, {
        name: "quick_reply",
        display_text: "Abaikan",
        id: `${prefix}rules`
      }];
      await sendInteractiveViewOnce(sock, chatId, {
        title: "Security • Anti-Bot Protection",
        subtitle: "Anti-Bot Alert",
        body: antiBotNotice,
        footer: global.bot?.name || "Neoxr Bot",
        buttons: buttons,
        mentions: [userPhoneJid]
      });
      return;
    } else {
      return;
    }
  }
  const isAfkCmd = /^[!./#]?\s*(afk|away)(\s+.*)?$/i.test(textBody.trim());
  if (userData?.afk?.afkTime && !isAfkCmd) {
    const afkDuration = formatDuration(Date.now() - userData.afk.afkTime);
    const reason = userData.afk.reason || "Tanpa alasan";
    delete userData.afk;
    db.write(global.db).catch(() => {});
    await ctx.reply(`–  *A F K  -  D O N E*\n\n` + `Selamat datang kembali! Kamu telah berhenti AFK.\n\n` + `┌  ◦  *Reason* : ${reason}\n` + `└  ◦  *Duration* : ${afkDuration}`);
  }
  if (ctx.mentionedJid?.length > 0) {
    for (const jid of ctx.mentionedJid) {
      let phoneJid = await resolveLidToJid(decodeJid(jid), sock, null, ctx.participants || []);
      if (phoneJid.endsWith("@lid") && typeof resolveLidProactively === "function") {
        const pro = await resolveLidProactively(sock, phoneJid);
        if (pro.jid) phoneJid = pro.jid;
      }
      const targetUser = global.db?.user?.[phoneJid];
      if (targetUser?.afk?.afkTime) {
        const afkDuration = formatDuration(Date.now() - targetUser.afk.afkTime);
        await ctx.reply(`–  *A F K  -  M O D E*\n\n` + `Jangan tag pengguna ini, dia sedang tidak aktif!\n\n` + `┌  ◦  *User* : @${extractNum(phoneJid)}\n` + `│  ◦  *Reason* : ${targetUser.afk.reason || "Tanpa alasan"}\n` + `└  ◦  *Since* : ${afkDuration} lalu`, {
          mentions: [phoneJid]
        });
      }
    }
  }
  if (isGroup && groupData?.antilink && !isOwner && !ctx.isAdmin) {
    const linkRegex = /(https?:\/\/)?(chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}|whatsapp\.com\/channel\/[0-9A-Za-z]{20,24})/i;
    if (linkRegex.test(textBody)) {
      if (ctx.isBotAdmin) {
        await ctx.delete().catch(() => {});
      }
      return ctx.reply(`–  *A N T I - L I N K*\n\n` + `Maaf @${senderNumber}, dilarang membagikan link grup atau channel di grup ini!`, {
        mentions: [userPhoneJid]
      });
    }
  }
  const validBadwords = Array.isArray(badwordList) ? badwordList : [];
  if (isGroup && groupData?.antitoxic && !isOwner && !ctx.isAdmin && validBadwords.length > 0) {
    const isToxic = validBadwords.some(w => {
      const regex = new RegExp(`\\b${w}\\b`, "i");
      return regex.test(textBody.toLowerCase());
    });
    if (isToxic) {
      if (ctx.isBotAdmin) await ctx.delete().catch(() => {});
      return ctx.reply(`–  *A N T I - T O X I C*\n\n` + `Harap menjaga tutur kata dan tata krama dalam chat @${senderNumber}!`, {
        mentions: [userPhoneJid]
      });
    }
  }
  if (isGroup && groupData?.bans === true && !isOwner && !ctx.isAdmin) return;
  if (isGroup && groupData?.mute === true && !isOwner && !ctx.isAdmin) return;
  if (global.bot?.self === true && !isOwner) return;
  if (global.bot?.maintenance === true && !isOwner) {
    return ctx.reply(`–  *M A I N T E N A N C E*\n\nSistem sedang dalam tahap pemeliharaan. Silakan coba kembali beberapa saat lagi.`);
  }
  if (userData?.banned === true && !isOwner) {
    return ctx.reply(`–  *B A N N E D*\n\n` + `Akses kamu telah ditangguhkan!\n\n` + `┌  ◦  *Reason* : ${userData?.banReason || "Melanggar terms of service bot."}\n` + `└  ◦  *Contact* : Hubungi owner untuk banding.`);
  }
  const spamKey = `${userPhoneJid}_spam`;
  const lastSpamTime = userSpamMap.get(spamKey) || 0;
  if (Date.now() - lastSpamTime < 500 && !isOwner) {
    return;
  }
  userSpamMap.set(spamKey, Date.now());
  const beforeHandlers = cmd?.getBeforeHandlers?.() || [];
  for (const {
      fn
    }
    of beforeHandlers) {
    try {
      if (typeof fn === "function") {
        const stop = await fn(msg, {
          sock: sock,
          ctx: ctx,
          cmd: cmd,
          db: {
            data: global.db?.cmd || {}
          },
          isOwner: isOwner,
          isROwner: isROwner,
          isPremium: isPremium
        });
        if (stop) return;
      }
    } catch (e) {
      console.error(chalk.red("[BEFORE HANDLER ERROR]"), e.message);
    }
  }
  let command = null;
  const groupPrefix = isGroup && groupData?.prefix ? [groupData.prefix] : null;
  const prefixConfig = groupPrefix || global.bot?.prefix || ["!", ".", "/", "#"];
  let matchedPrefix = null;
  if (prefixConfig instanceof RegExp) {
    matchedPrefix = textBody.match(prefixConfig)?.[0] || null;
  } else if (Array.isArray(prefixConfig)) {
    matchedPrefix = prefixConfig.find(p => textBody.startsWith(p)) || null;
  } else if (typeof prefixConfig === "string" && textBody.startsWith(prefixConfig)) {
    matchedPrefix = prefixConfig;
  }
  if (matchedPrefix) {
    const rawWithoutPrefix = textBody.slice(matchedPrefix.length).trim();
    const parts = rawWithoutPrefix.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    const cmdName = (parts[0] || "").toLowerCase();
    const findCmd = cmd?.getCommand?.(cmdName);
    if (findCmd) {
      ctx.prefix = matchedPrefix;
      ctx.cmd = cmdName;
      ctx.command = cmdName;
      ctx.args = parts.slice(1);
      ctx.query = rawWithoutPrefix.slice((parts[0] || "").length).trim();
      command = findCmd;
    }
  }
  if (!command && (global.bot?.noprefix || !matchedPrefix) && textBody) {
    const parts = textBody.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    const firstWord = (parts[0] || "").toLowerCase();
    const directCmd = cmd?.getCommand?.(firstWord);
    if (directCmd) {
      ctx.prefix = "";
      ctx.cmd = firstWord;
      ctx.command = firstWord;
      ctx.args = parts.slice(1);
      ctx.query = textBody.slice((parts[0] || "").length).trim();
      command = directCmd;
    }
  }
  if (!command && textBody) {
    command = cmd?.getCommandByRegex?.(textBody);
    if (command) {
      const parts = textBody.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
      ctx.cmd = command.name || parts[0]?.toLowerCase() || "";
      ctx.command = ctx.cmd;
      ctx.args = parts.slice(1);
      ctx.query = textBody;
    }
  }
  if (!ctx.cmd || !command) return;
  if (global.bot?.autoRead !== false && msg.key) {
    sock.readMessages([msg.key]).catch(() => {});
  }
  if (global.bot?.autoTyping && chatId) {
    const cleanPresenceChat = jidNormalizedUser(chatId);
    if (!cleanPresenceChat.endsWith("@lid")) {
      const activity = Math.random() > .5 ? "composing" : "recording";
      sock?.sendPresenceUpdate(activity, cleanPresenceChat).catch(() => {});
      setTimeout(() => {
        sock?.sendPresenceUpdate("paused", cleanPresenceChat).catch(() => {});
      }, 3e4);
    }
  }
  const cdTime = (command.cooldown || global.bot?.cooldown || 3) * 1e3;
  const userCdKey = `${userPhoneJid}_${command.name || ctx.cmd}`;
  const now = Date.now();
  if (cooldowns.has(userCdKey) && !isOwner && !ctx.isEdited) {
    const expirationTime = cooldowns.get(userCdKey) + cdTime;
    if (now < expirationTime) {
      const timeLeft = ((expirationTime - now) / 1e3).toFixed(1);
      return ctx.reply(`Hold on *${timeLeft}s* before using this command again.`);
    }
  }
  cooldowns.set(userCdKey, now);
  setTimeout(() => cooldowns.delete(userCdKey), cdTime);
  const time = new Date().toLocaleTimeString("id-ID", {
    hour12: false
  });
  const typeTag = isGroup ? chalk.black.bgBlue(" GROUP ") : chalk.black.bgMagenta(" PRIVATE ");
  const editTag = ctx.isEdited ? chalk.black.bgYellow(" EDIT ") : "";
  const userName = ctx.pushname || ctx.pushName || "Unknown";
  const userText = chalk.white(userName) + chalk.gray(` (${senderNumber})`);
  const chatText = isGroup ? chalk.cyan(ctx.groupMetadata?.subject || groupData?.subject || "Group") : chalk.green("Private Chat");
  const commandText = chalk.yellowBright.bold(`${ctx.prefix || ""}${ctx.cmd}`);
  console.log(`${chalk.gray(`[ ${time} ]`)} ${typeTag}${editTag} ➔ ${commandText} ${chalk.gray("from")} ${userText} ${chalk.gray("in")} ${chatText}`);
  const msgs = global.bot?.msg || {};
  const inAppButtons = [{
    name: "inapp_signup",
    buttonParamsJson: "{}"
  }];
  const replyInApp = (text, title = "A C C E S S  D E N I E D") => {
    return ctx.reply(text, {
      title: title,
      footer: global.bot?.footer || global.bot?.watermark || "– Wudysoft • Multi-Device",
      interactiveButtons: inAppButtons,
      mentions: [ctx.sender]
    });
  };
  if (command.owner && !isOwner) {
    return replyInApp(msgs.owner || `–  *A C C E S S  D E N I E D*\n\nPerintah ini khusus untuk *Owner Bot*.`, "OWNER ONLY");
  }
  if (command.premium && !isPremium) {
    return replyInApp(msgs.premium || `–  *P R E M I U M  O N L Y*\n\nFitur ini dikhususkan untuk user *Premium*.`, "PREMIUM ONLY");
  }
  if (command.register && !isOwner) {
    const isRegistered = userData?.registered === true || userData?.name && userData.name !== senderNumber;
    if (!isRegistered) {
      return replyInApp(msgs.unreg || `–  *U N R E G I S T E R E D*\n\nKamu belum terdaftar di database!\nKetik *${ctx.prefix || "."}register <nama>* untuk mendaftar.`, "REGISTRATION");
    }
  }
  if (command.group && !isGroup) {
    return replyInApp(msgs.group || `–  *G R O U P  O N L Y*\n\nPerintah ini hanya dapat digunakan di dalam grup.`, "GROUP ONLY");
  }
  if (command.private && isGroup) {
    return replyInApp(msgs.private || `–  *P R I V A T E  C H A T*\n\nPerintah ini hanya dapat digunakan di private chat.`, "PRIVATE ONLY");
  }
  if (command.admin && !ctx.isAdmin && !isOwner) {
    return replyInApp(msgs.admin || `–  *A D M I N  O N L Y*\n\nPerintah ini hanya dapat dijalankan oleh Admin Grup.`, "ADMIN ONLY");
  }
  if (command.botAdmin && !ctx.isBotAdmin) {
    return replyInApp(msgs.botAdmin || `–  *B O T  N O T  A D M I N*\n\nJadikan bot sebagai admin untuk menggunakan fitur ini.`, "BOT NOT ADMIN");
  }
  if (command.nsfw && isGroup && groupData?.nsfw !== true && !isOwner) {
    return replyInApp(`–  *N S F W  D I S A B L E D*\n\nMode NSFW (+18) dinonaktifkan di grup ini.`, "NSFW RESTRICTION");
  }
  if (command.limit && !isOwner && !isPremium) {
    const userLimit = userData?.limit ?? 0;
    if (userLimit <= 0) {
      return replyInApp(msgs.limit || `–  *O U T  O F  L I M I T*\n\nLimit harian kamu telah habis. Limit akan di-reset setiap pukul 00.00 WIB.`, "LIMIT EXCEEDED");
    }
    userData.limit = userLimit - 1;
    db.write(global.db).catch(() => {});
  }
  const execFn = command.execute || command.run || command.handler || command.default || (typeof command === "function" ? command : null);
  if (!execFn || typeof execFn !== "function") {
    console.error(chalk.redBright(`[EXEC ERROR] Command "${ctx.cmd}" tidak memiliki handler fungsi yang valid.`));
    return ctx.reply(`–  *E R R O R*\n\nFormat plugin *${ctx.cmd}* tidak valid (fungsi run/execute tidak ditemukan).`);
  }
  try {
    const extra = {
      sock: sock,
      msg: msg,
      ctx: ctx,
      args: ctx.args || [],
      text: ctx.query || "",
      query: ctx.query || "",
      command: ctx.cmd,
      prefix: ctx.prefix || "",
      isOwner: ctx.isOwner,
      isROwner: ctx.isROwner,
      isPremium: ctx.isPremium,
      isAdmin: ctx.isAdmin,
      isBotAdmin: ctx.isBotAdmin,
      button: () => new Button(sock).setJid(ctx.chat),
      buttonV2: () => new ButtonV2(sock),
      carousel: () => new Carousel(sock),
      aiRich: () => new AIRich(sock),
      poll: () => new Poll(sock)
    };
    await execFn.call(command, sock, ctx, msg, extra);
    global.db.stats = global.db.stats || {};
    global.db.stats[ctx.cmd] = (global.db.stats[ctx.cmd] || 0) + 1;
    global.db.totalHits = (global.db.totalHits || 0) + 1;
    if (userData) {
      const multiplier = isPremium ? 2 : 1;
      userData.exp = (userData.exp || 0) + (Math.floor(Math.random() * 15) + 5) * multiplier;
      userData.money = (userData.money || 0) + (Math.floor(Math.random() * 10) + 2) * multiplier;
      db.write(global.db).catch(() => {});
    }
  } catch (err) {
    console.error(chalk.redBright(`[COMMAND ERROR : ${ctx.cmd}]`), err);
    return ctx.reply(`–  *E R R O R*\n\n\`\`\`${err?.message || err}\`\`\``);
  }
  if (userData && groupData?.autolevelup !== false) {
    try {
      userData.level = Number(userData.level) || 1;
      userData.exp = Number(userData.exp) || 0;
      userData.hpMax = Number(userData.hpMax) || 100;
      userData.manaMax = Number(userData.manaMax) || 50;
      userData.atk = Number(userData.atk) || 10;
      userData.def = Number(userData.def) || 5;
      let needed = typeof getExpNeeded === "function" ? getExpNeeded(userData.level) : 1e3;
      let hasLeveledUp = false;
      while (needed > 0 && userData.exp >= needed) {
        hasLeveledUp = true;
        const oldLevel = userData.level;
        userData.exp -= needed;
        userData.level += 1;
        const newLevel = userData.level;
        userData.hpMax += 20;
        userData.manaMax += 10;
        userData.atk += 3;
        userData.def += 2;
        userData.hp = userData.hpMax;
        userData.mana = userData.manaMax;
        const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof contactQuoted === "function" ? contactQuoted(ctx) : msg?.key ? sanitizeQuotedMessage(msg, chatId, isGroup) : undefined;
        const rankName = getRankTitle(newLevel);
        const botName = global.bot?.name || "Neoxr Bot";
        const prefix = ctx.prefix || ".";
        const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
        const bodyText = `–  *L E V E L  U P*\n\n` + `“ Selamat kepada @${senderNumber}, level karakter kamu berhasil meningkat! ”\n\n` + `┌  ◦  *User* : @${senderNumber}\n` + `│  ◦  *Level* : Lv. ${oldLevel} ➔ *Lv. ${newLevel}*\n` + `│  ◦  *Role/Rank* : \`${rankName}\`\n` + `└  ◦  *Progress* : +${needed} EXP\n\n` + `–  *A T T R I B U T E S*\n\n` + `┌  ◦  *Max HP* : +20 (${userData.hpMax})\n` + `│  ◦  *Max Mana* : +10 (${userData.manaMax})\n` + `│  ◦  *Attack* : +3 (${userData.atk})\n` + `└  ◦  *Defense* : +2 (${userData.def})\n\n` + `_Gunakan tombol di bawah untuk memeriksa profil status atau petualangan kamu._`;
        const listSections = [{
          title: `– MENU RPG (${rankName.toUpperCase()})`,
          rows: [{
            title: "👤 Profil Karakter",
            description: "Lihat statistik, tier rank, dan exp kamu",
            id: `${prefix}profile`
          }, {
            title: "🎒 Buka Inventory",
            description: "Periksa item, senjata, dan armor milikmu",
            id: `${prefix}inv`
          }, {
            title: "🏆 Leaderboard RPG",
            description: "Cek posisi peringkat pemain di server",
            id: `${prefix}lb`
          }]
        }, {
          title: "– AKTIVITAS PETUALANGAN",
          rows: [{
            title: "🌲 Mulai Adventure",
            description: "Jelajahi dungeon & kumpulkan exp",
            id: `${prefix}adventure`
          }, {
            title: "🏰 Masuk Dungeon",
            description: "Lawan monster level tinggi dan dapatkan loot",
            id: `${prefix}dungeon`
          }]
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 DAFTAR AKSI (LV. ${newLevel})`,
            sections: listSections
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "👤 Profile",
            id: `${prefix}profile`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎒 Inventory",
            id: `${prefix}inv`
          })
        }];
        let userPic = null;
        try {
          userPic = await sock.profilePictureUrl(userPhoneJid, "image").catch(() => null);
        } catch (_) {}
        const cardBuffer = await generateLevelUpCard({
          avatar: userPic,
          username: userName,
          currentLevel: oldLevel,
          nextLevel: newLevel,
          userData: userData
        });
        const bannerImage = cardBuffer || userPic || "https://picsum.photos/seed/cyber/800/400";
        const options = {
          image: bannerImage,
          title: `– ${botName} • Level Up (Lv. ${newLevel})`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Level Up`,
              button_title: `Lihat Pilihan Aksi`
            },
            limited_time_offer: {
              text: `👑 BONUS STATUS BARU EVOLUSI LV.${newLevel} TELAH AKTIF! 👑`,
              url: channelUrl,
              copy_code: `CLAIM_BUFF_LV${newLevel}`,
              expiration_time: Date.now() + 3600 * 1e3
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            mentionedJid: sanitizeMentions([userPhoneJid])
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, `${botName} • RPG System`, buttons, options);
        } else {
          await sendInteractiveViewOnce(sock, ctx.id || ctx.chat, {
            title: `– ${botName} • Level Up (Lv. ${newLevel})`,
            body: bodyText,
            footer: `${botName} • RPG System`,
            media: bannerImage,
            buttons: buttons,
            mentions: [userPhoneJid]
          }, quotedMsg);
        }
        needed = typeof getExpNeeded === "function" ? getExpNeeded(userData.level) : 1e3;
      }
      if (hasLeveledUp) {
        db.write(global.db).catch(() => {});
      }
    } catch (lvlErr) {
      console.error(chalk.red("[RPG LEVEL UP ERROR]"), lvlErr.message);
    }
  }
}