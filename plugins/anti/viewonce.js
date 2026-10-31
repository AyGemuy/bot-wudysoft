import {
  areJidsSameUser
} from "@whiskeysockets/baileys";
import {
  decodeJid,
  resolveLidToJid,
  copyNForward
} from "../../core/serialize.js";
import chalk from "chalk";
export default {
  name: "antiviewonce",
  aliases: ["antivo", "viewonce", "antisekalilihat", "vo"],
  description: "Mendeteksi dan meneruskan kembali pesan sekali lihat (View-Once) secara otomatis",
  category: "Handler",
  execute: async () => {},
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isGroup = ctx.isGroup;
      if (!isGroup) return;
      const groupData = global.db?.group?.[ctx.chat] || {};
      const isAntiViewOnce = groupData?.antiviewonce === true || global.bot?.antiviewonce === true;
      if (!isAntiViewOnce) return;
      const rawMsgObj = msg?.message || ctx.rawMessage || {};
      const innerMessage = rawMsgObj?.ephemeralMessage?.message || rawMsgObj?.viewOnceMessage?.message || rawMsgObj?.viewOnceMessageV2?.message || rawMsgObj?.viewOnceMessageV2Extension?.message || rawMsgObj?.viewOnceMessageV3?.message || rawMsgObj;
      const mediaNode = innerMessage?.imageMessage || innerMessage?.videoMessage || innerMessage?.audioMessage || rawMsgObj?.imageMessage || rawMsgObj?.videoMessage || rawMsgObj?.audioMessage;
      const isViewOnceFlag = Boolean(rawMsgObj?.viewOnceMessage || rawMsgObj?.viewOnceMessageV2 || rawMsgObj?.viewOnceMessageV2Extension || rawMsgObj?.viewOnceMessageV3 || innerMessage?.viewOnceMessage || innerMessage?.viewOnceMessageV2 || innerMessage?.viewOnceMessageV3 || mediaNode?.viewOnce === true || ctx.isViewOnce === true);
      if (!isViewOnceFlag || !mediaNode) return;
      const senderJid = msg?.key?.participant || msg?.key?.remoteJid || ctx.sender;
      const myId = sock.user?.id || sock.user?.jid || "";
      const isFromMe = Boolean(msg?.key?.fromMe || ctx.isFromMe || senderJid && myId && areJidsSameUser(senderJid, myId));
      if (isFromMe) return;
      console.log(chalk.green(`[ ANTI VIEW-ONCE ] Mendeteksi media sekali lihat dari ${senderJid} di grup ${ctx.chat}`));
      let targetJid = ctx.chat || ctx.id || msg?.key?.remoteJid;
      targetJid = decodeJid(targetJid);
      if (!targetJid) return;
      const senderNum = senderJid ? senderJid.split("@")[0] : "User";
      await sock.sendMessage(targetJid, {
        text: `–  *A N T I - V I E W - O N C E*\n\nTerdeteksi media sekali lihat dari @${senderNum}:`,
        mentions: [senderJid]
      }, {
        quoted: msg
      }).catch(() => {});
      const forwardFn = copyNForward || global.copyNForward || sock.copyNForward;
      if (typeof forwardFn === "function") {
        await forwardFn(sock, targetJid, rawMsgObj, false, {}, msg);
      } else {
        await sock.sendMessage(targetJid, {
          forward: rawMsgObj
        }, {
          quoted: msg
        });
      }
      return true;
    } catch (e) {
      console.error("[ANTI VIEW-ONCE ERROR]", e);
    }
  }
};