import {
  normalizeMessageContent,
  proto,
  jidNormalizedUser,
  areJidsSameUser
} from "@whiskeysockets/baileys";
import {
  decodeJid,
  resolveLidToJid,
  SerializeMessage
} from "../../core/serialize.js";
import {
  UpsertMsgHandle
} from "../../core/handler.js";
import {
  createDecipheriv,
  createHmac
} from "crypto";
import chalk from "chalk";
const GCM_TAG_LENGTH = 128 >> 3;

function toBinarySafe(b) {
  if (!b) return Buffer.alloc(0);
  if (Buffer.isBuffer(b)) return b;
  if (b instanceof Uint8Array) return Buffer.from(b);
  if (typeof b === "string") {
    if (b.length === 64 && /^[0-9a-fA-F]+$/.test(b)) return Buffer.from(b, "hex");
    return Buffer.from(b, "base64");
  }
  if (b && typeof b === "object" && Array.isArray(b.data)) return Buffer.from(b.data);
  return Buffer.from(b);
}

function hmacSign(buffer, key, variant = "sha256") {
  return createHmac(variant, toBinarySafe(key)).update(toBinarySafe(buffer)).digest();
}

function aesDecryptGCM(ciphertext, key, iv, additionalData) {
  const encBuf = toBinarySafe(ciphertext);
  const decipher = createDecipheriv("aes-256-gcm", toBinarySafe(key), toBinarySafe(iv));
  const enc = encBuf.subarray(0, encBuf.length - GCM_TAG_LENGTH);
  const tag = encBuf.subarray(encBuf.length - GCM_TAG_LENGTH);
  if (additionalData && additionalData.length > 0) {
    decipher.setAAD(toBinarySafe(additionalData));
  }
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}
export function decryptMessageEdit({
  encPayload,
  encIv
}, {
  origMsgId,
  origMsgSenderJid,
  editorJid,
  msgEncKey
}) {
  const secretKey = toBinarySafe(msgEncKey);
  if (!encPayload || !encIv || !secretKey.length) {
    throw new Error("Missing data required to decrypt secretEncryptedMessage");
  }
  const toBinary = txt => Buffer.from(String(txt));
  const sign = Buffer.concat([toBinary(origMsgId), toBinary(origMsgSenderJid), toBinary(editorJid), toBinary("Message Edit"), new Uint8Array([1])]);
  const key0 = hmacSign(secretKey, new Uint8Array(32), "sha256");
  const decKey = hmacSign(sign, key0, "sha256");
  const decrypted = aesDecryptGCM(encPayload, decKey, encIv, new Uint8Array(0));
  return proto.Message.decode(decrypted);
}

function getEditedText(msg) {
  if (!msg) return "";
  const unwrapped = normalizeMessageContent(msg) || msg;
  return (unwrapped.conversation || unwrapped.extendedTextMessage?.text || unwrapped.imageMessage?.caption || unwrapped.videoMessage?.caption || unwrapped.documentMessage?.caption || "").trim();
}
export default {
  name: "editedcmd",
  aliases: ["editcmd", "onedit"],
  description: "Mendeteksi pesan yang diedit menjadi perintah bot secara otomatis",
  category: "Handler",
  execute: async () => {},
  before: async (m, {
    sock,
    ctx,
    cmd
  }) => {
    try {
      const content = normalizeMessageContent(m.message || ctx.message);
      const secMsg = content?.secretEncryptedMessage;
      const protocolMsg = content?.protocolMessage;
      const isEditEvent = Boolean(secMsg) || protocolMsg?.type === 14 || protocolMsg?.type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT || Boolean(protocolMsg?.editedMessage);
      if (!isEditEvent) return;
      const targetKey = secMsg?.targetMessageKey || protocolMsg?.key;
      const targetId = targetKey?.id;
      if (!targetId) return;
      const chatId = decodeJid(ctx.chat || ctx.id || m.key?.remoteJid || targetKey?.remoteJid);
      if (!chatId) return;
      const myId = jidNormalizedUser(sock.authState?.creds?.me?.id || sock.user?.id || "");
      const myLid = sock.authState?.creds?.me?.lid ? jidNormalizedUser(sock.authState.creds.me.lid) : sock.user?.lid ? jidNormalizedUser(sock.user.lid) : null;
      const candidateSet = new Set();
      if (m.key.fromMe) {
        if (myId) candidateSet.add(myId);
        if (myLid) candidateSet.add(myLid);
      } else {
        if (m.key.participant) candidateSet.add(jidNormalizedUser(m.key.participant));
        if (m.key.remoteJid && !m.key.remoteJid.endsWith("@g.us")) candidateSet.add(jidNormalizedUser(m.key.remoteJid));
        if (m.key.participantAlt) candidateSet.add(jidNormalizedUser(m.key.participantAlt));
        if (targetKey.participant && !targetKey.participant.endsWith("@g.us")) candidateSet.add(jidNormalizedUser(targetKey.participant));
        if (ctx.sender && !ctx.sender.endsWith("@g.us")) candidateSet.add(jidNormalizedUser(ctx.sender));
      }
      if (typeof sock.signalRepository?.lidMapping?.getPNForLID === "function") {
        for (const jid of [...candidateSet]) {
          if (jid.endsWith("@lid")) {
            const pn = await sock.signalRepository.lidMapping.getPNForLID(jid).catch(() => null);
            if (pn) candidateSet.add(jidNormalizedUser(pn));
          } else if (jid.endsWith("@s.whatsapp.net") && typeof sock.signalRepository?.lidMapping?.getLIDForPN === "function") {
            const lid = await sock.signalRepository.lidMapping.getLIDForPN(jid).catch(() => null);
            if (lid) candidateSet.add(jidNormalizedUser(lid));
          }
        }
      }
      const candidates = [...candidateSet];
      let newText = "";
      if (secMsg?.encPayload && secMsg?.encIv) {
        let origMsg = global.msgStore?.get(targetId);
        if (!origMsg && global.store?.messages?.[chatId]) {
          const list = global.store.messages[chatId]?.array || Object.values(global.store.messages[chatId] || {});
          origMsg = list.find(v => v?.key?.id === targetId);
        }
        let msgEncKey = origMsg?.message?.messageContextInfo?.messageSecret || origMsg?.rawMessage?.messageContextInfo?.messageSecret || origMsg?.messageContextInfo?.messageSecret || m.message?.messageContextInfo?.messageSecret;
        if (msgEncKey) {
          for (const authorJid of candidates) {
            try {
              const decoded = decryptMessageEdit(secMsg, {
                origMsgId: targetId,
                origMsgSenderJid: authorJid,
                editorJid: authorJid,
                msgEncKey: msgEncKey
              });
              if (decoded) {
                newText = getEditedText(decoded);
                break;
              }
            } catch (_) {}
          }
        }
      }
      if (!newText && protocolMsg?.editedMessage) {
        newText = getEditedText(protocolMsg.editedMessage);
      }
      if (!newText) return;
      const prefixes = Array.isArray(global.bot?.prefix) ? global.bot.prefix : typeof global.bot?.prefix === "string" ? [global.bot.prefix] : [".", "!", "/", "#"];
      const hasPrefix = prefixes.some(p => newText.startsWith(p));
      const firstWord = newText.split(/\s+/)[0]?.toLowerCase() || "";
      const isNoPrefixCmd = Boolean(global.bot?.noprefix && (cmd?.getCommand?.(firstWord) || global.loader?.getCommand?.(firstWord)));
      if (!hasPrefix && !isNoPrefixCmd) return;
      global.botEventLocks = global.botEventLocks || new Set();
      const lockKey = `edit_cmd_lock:${targetId}_${newText}`;
      if (global.botEventLocks.has(lockKey)) return true;
      global.botEventLocks.add(lockKey);
      setTimeout(() => global.botEventLocks.delete(lockKey), 3e3);
      let activeSender = candidates[0] || ctx.sender;
      if (activeSender && activeSender.endsWith("@lid")) {
        const resolved = await resolveLidToJid(activeSender, sock, null, ctx.participants || []).catch(() => null);
        if (resolved && !resolved.endsWith("@lid")) activeSender = resolved;
      }
      const senderNum = (activeSender || "").split("@")[0] || "User";
      console.log(chalk.gray(`[ EDIT CMD ] `) + chalk.cyan(`@${senderNum}`) + chalk.gray(` mengedit pesan menjadi: `) + chalk.yellowBright.bold(`"${newText}"`));
      const isFromMe = areJidsSameUser(activeSender, sock.user?.id);
      const fakeMsg = {
        key: {
          remoteJid: chatId,
          fromMe: isFromMe,
          id: `${targetId}_EDIT_${Date.now().toString(36)}`,
          participant: chatId.endsWith("@g.us") ? activeSender : undefined
        },
        message: {
          extendedTextMessage: {
            text: newText
          }
        },
        pushName: ctx.pushName || m.pushName || "User",
        messageTimestamp: Math.floor(Date.now() / 1e3)
      };
      const fakeCtx = await SerializeMessage(sock, fakeMsg);
      if (fakeCtx) {
        fakeCtx.loader = cmd || global.loader;
        fakeCtx.isEdited = true;
        fakeCtx.text = newText;
        fakeCtx.body = newText;
        UpsertMsgHandle(sock, fakeMsg, fakeCtx, {
          cmd: cmd || global.loader
        }).catch(err => {
          console.error(chalk.red("[EDIT EXEC ERROR]"), err.message);
        });
      }
      return true;
    } catch (e) {
      console.error(chalk.red("[ONEDIT HANDLER ERROR]"), e);
    }
  }
};