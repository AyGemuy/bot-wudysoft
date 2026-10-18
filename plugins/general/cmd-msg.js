import {
  copyNForward,
  decodeJid
} from "../../core/serialize.js";
import db from "../../data/db.js";
global.db = global.db || {};
global.db.customMsg = global.db.customMsg || {};

function extractPageNumber(query = "", args = []) {
  const match = query.match(/--page[=\s]+(\d+)/i) || query.match(/--p[=\s]+(\d+)/i);
  if (match) return parseInt(match[1]);
  for (const arg of args) {
    if (!isNaN(arg) && parseInt(arg) > 0) return parseInt(arg);
  }
  return 1;
}
export default {
  name: "custommsg",
  aliases: ["addmsg", "delmsg", "listmsg", "setmsg", "deletemsg", "getmsg"],
  description: "Simpan semua jenis pesan/media dan panggil kembali secara otomatis via kata kunci",
  category: "Tools",
  example: "Reply pesan/media dengan .addmsg <kata_kunci> | .delmsg <kata_kunci> | .listmsg",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      if (!ctx || ctx.isFromMe || ctx.isBot) return;
      const customMsgDb = global.db?.customMsg || {};
      const keys = Object.keys(customMsgDb);
      if (!keys.length) return;
      const fullText = (ctx.text || ctx.body || "").trim();
      if (!fullText) return;
      const lowerFull = fullText.toLowerCase();
      const cleanText = lowerFull.replace(/^[!./#\s]+/, "").trim();
      const firstWord = cleanText.split(/\s+/)[0];
      const matchedKey = keys.find(k => {
        const cleanK = k.toLowerCase().replace(/^[!./#\s]+/, "").trim();
        return cleanK === cleanText || cleanK === lowerFull || k.toLowerCase() === lowerFull || cleanK === firstWord;
      });
      if (matchedKey && customMsgDb[matchedKey]) {
        const item = customMsgDb[matchedKey];
        if (item?.message) {
          let targetJid = ctx.chat || ctx.id;
          if (!ctx.isGroup && targetJid?.endsWith("@lid")) {
            targetJid = ctx.sender?.endsWith("@s.whatsapp.net") ? ctx.sender : targetJid;
          }
          targetJid = decodeJid(targetJid);
          try {
            if (typeof copyNForward === "function") {
              await copyNForward(sock, targetJid, item.message, false, {}, msg);
            } else {
              await sock.sendMessage(targetJid, {
                forward: item.message,
                force: false
              }, {
                quoted: msg
              });
            }
          } catch (fwdErr) {
            try {
              await sock.sendMessage(targetJid, {
                forward: item.message,
                force: false
              });
            } catch (err2) {
              console.error("[CustomMsg Forward Fallback Error]:", err2?.message || err2);
            }
          }
          return true;
        }
      }
    } catch (err) {
      console.error("[CustomMsg Before Error]:", err?.message || err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const alias = (ctx.cmd || ctx.command || "custommsg").toLowerCase();
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Custom Message`;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      global.db.customMsg = global.db.customMsg || {};
      if (alias === "getmsg") {
        const targetKeyword = rawQuery.toLowerCase().replace(/^[.!/#]/, "").trim();
        if (!targetKeyword) {
          return ctx.reply(`–  *G E T  M S G*

Silakan tentukan kata kunci pesan yang ingin dipanggil.

┌  ◦  *Format* : ${prefix}getmsg <kata_kunci>
└  ◦  *Example* : ${prefix}getmsg donasi`);
        }
        const item = global.db.customMsg[targetKeyword];
        if (!item || !item.message) {
          return ctx.reply(`❌ Pesan dengan kata kunci *"${targetKeyword}"* tidak ditemukan di database.`);
        }
        let targetJid = ctx.chat || ctx.id;
        if (!ctx.isGroup && targetJid?.endsWith("@lid")) {
          targetJid = ctx.sender?.endsWith("@s.whatsapp.net") ? ctx.sender : targetJid;
        }
        targetJid = decodeJid(targetJid);
        try {
          if (typeof copyNForward === "function") {
            await copyNForward(sock, targetJid, item.message, false, {}, msg);
          } else {
            await sock.sendMessage(targetJid, {
              forward: item.message,
              force: false
            }, {
              quoted: msg
            });
          }
        } catch (_) {
          await sock.sendMessage(targetJid, {
            forward: item.message,
            force: false
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (alias === "listmsg" || rawQuery.startsWith("--list")) {
        const list = Object.values(global.db.customMsg);
        if (!list.length) {
          return ctx.reply(`–  *M E S S A G E  L I S T*

Belum ada pesan yang tersimpan di dalam database.

┌  ◦  *Action* : Reply pesan/media lalu ketik ${prefix}addmsg <kata_kunci>
└  ◦  *Example* : ${prefix}addmsg donasi`);
        }
        const perPage = 10;
        const totalPages = Math.ceil(list.length / perPage) || 1;
        let page = extractPageNumber(rawQuery, ctx.args || []);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        const startIndex = (page - 1) * perPage;
        const currentItems = list.slice(startIndex, startIndex + perPage);
        const currentItemsText = currentItems.map((item, i) => {
          const globalIndex = startIndex + i + 1;
          const isLast = i === currentItems.length - 1;
          const branch = isLast ? "└" : "│";
          return `${branch}  ◦  *${globalIndex}.* ${item.keyword} [${(item.type || "msg").toUpperCase()}]`;
        }).join("\n");
        const rows = currentItems.map((item, idx) => {
          const globalIndex = startIndex + idx + 1;
          const uNum = item.creatorNumber || item.creator?.split("@")[0]?.replace(/\D/g, "") || "Unknown";
          const uName = item.creatorName || (typeof ctx.getName === "function" ? ctx.getName(item.creator) : "User");
          const creatorLabel = uName && uName !== uNum ? `${uName} (${uNum})` : uNum;
          const typeLabel = (item.type || "msg").toUpperCase();
          return {
            header: `Pesan #${globalIndex} [${typeLabel}]`,
            title: `[ ${item.keyword} ]`,
            description: `Oleh: ${creatorLabel}`.slice(0, 50),
            id: `${prefix}getmsg ${item.keyword}`
          };
        });
        const sections = [{
          title: `📦 DAFTAR PESAN (Hal ${page}/${totalPages})`,
          rows: rows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📑 BUKA PESAN (Hal ${page}/${totalPages})`,
            sections: sections
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}listmsg --page ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}listmsg --page ${page + 1}`
            })
          });
        }
        const bodyText = `Hi ${userName}!
Berikut adalah daftar pesan kustom yang tersimpan di sistem.

–  *M E S S A G E  L I S T*

┌  ◦  *Total* : ${list.length} Pesan
│  ◦  *Page* : ${page} / ${totalPages}
└  ◦  *Prefix* : [ ${prefix} ]

–  *K E Y W O R D S*

${currentItemsText}

Pilih pesan melalui menu di bawah atau ketik langsung kata kuncinya di chat.`;
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, {
            jid: ctx.id,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • Koleksi Pesan`,
                button_title: `Buka Hal ${page}`
              }
            },
            quoted: msg
          });
        }
        return await ctx.reply(bodyText, {
          quoted: msg
        });
      }
      if (alias === "delmsg" || alias === "deletemsg" || rawQuery.startsWith("--del")) {
        let foundKey = null;
        let targetKey = rawQuery.replace(/^--del\s*/i, "").trim().toLowerCase();
        targetKey = targetKey.replace(/^[.!/#]/, "").trim();
        if (targetKey && global.db.customMsg[targetKey]) {
          foundKey = targetKey;
        }
        if (!foundKey && targetKey) {
          const matchEntry = Object.entries(global.db.customMsg).find(([k, v]) => k.toLowerCase() === targetKey || v.keyword?.toLowerCase() === targetKey);
          if (matchEntry) foundKey = matchEntry[0];
        }
        if (!foundKey) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *D E L  M S G*

Pesan tidak ditemukan di dalam database.

┌  ◦  *Format* : ${prefix}delmsg <kata_kunci>
└  ◦  *Example* : ${prefix}delmsg donasi

Lihat daftar lengkap kata kunci di *${prefix}listmsg*.`);
        }
        const deletedName = global.db.customMsg[foundKey]?.keyword || foundKey;
        delete global.db.customMsg[foundKey];
        if (typeof db?.write === "function") db.write(global.db);
        if (typeof ctx.react === "function") await ctx.react("🗑️");
        return ctx.reply(`–  *D E L  M S G*

Pesan dengan kata kunci *"${deletedName}"* berhasil dihapus dari database.`);
      }
      if (alias === "addmsg" || alias === "setmsg" || rawQuery.startsWith("--add")) {
        let keyword = rawQuery.replace(/^--add\s*/i, "").trim().toLowerCase();
        keyword = keyword.replace(/^[.!/#]/, "").trim();
        if (!keyword) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *A D D  M S G*

Silakan balas (reply) pesan/media dan tentukan kata kuncinya.

┌  ◦  *Format* : ${prefix}addmsg <kata_kunci>
└  ◦  *Example* : reply pesan + ${prefix}addmsg donasi`);
        }
        if (!ctx.quoted) {
          if (typeof ctx.react === "function") await ctx.react("⚠️");
          return ctx.reply("⚠️ Silakan balas (reply) pesan, stiker, gambar, video, atau audio yang ingin disimpan.");
        }
        if (typeof ctx.react === "function") await ctx.react("⏳");
        const rawTargetMsg = ctx.quoted.fakeObj || ctx.quoted.vM || ctx.quoted.rawMessage || ctx.quoted.message || ctx.quoted;
        let cleanMessage = JSON.parse(JSON.stringify(rawTargetMsg));
        if (cleanMessage.message?.viewOnceMessage) {
          cleanMessage.message = cleanMessage.message.viewOnceMessage.message;
        }
        if (cleanMessage.message?.viewOnceMessageV2) {
          cleanMessage.message = cleanMessage.message.viewOnceMessageV2.message;
        }
        if (cleanMessage.message?.viewOnceMessageV2Extension) {
          cleanMessage.message = cleanMessage.message.viewOnceMessageV2Extension.message;
        }
        const messageType = ctx.quoted.mediaType || ctx.quoted.mtype?.replace(/Message$/i, "") || "text";
        const isUpdate = Boolean(global.db.customMsg[keyword]);
        const creatorNumber = ctx.senderNumber || ctx.sender?.split("@")[0]?.replace(/\D/g, "") || "Unknown";
        const creatorName = ctx.pushname || ctx.pushName || (typeof ctx.getName === "function" ? ctx.getName(ctx.sender) : "User");
        global.db.customMsg[keyword] = {
          keyword: keyword,
          type: messageType,
          message: cleanMessage,
          creator: ctx.sender,
          creatorName: creatorName,
          creatorNumber: creatorNumber,
          updatedAt: Date.now(),
          createdAt: global.db.customMsg[keyword]?.createdAt || Date.now()
        };
        if (typeof db?.write === "function") db.write(global.db);
        if (typeof ctx.react === "function") await ctx.react("✅");
        const statusText = isUpdate ? "diperbarui" : "disimpan";
        return ctx.reply(`–  *A D D  M S G*

Pesan kustom berhasil ${statusText}.

┌  ◦  *Keyword* : ${keyword}
│  ◦  *Type* : ${(messageType || "msg").toUpperCase()}
│  ◦  *Author* : ${creatorName} (${creatorNumber})
└  ◦  *Status* : Active

Ketik kata *${keyword}* di chat untuk memunculkannya.`);
      }
      const helperBody = `Hi ${userName}!
Sistem penyimpanan pesan kustom otomatis berbasis kata kunci.

–  *C U S T O M  M S G*

┌  ◦  *Save* : Reply media + ${prefix}addmsg <keyword>
│  ◦  *Delete* : ${prefix}delmsg <keyword>
│  ◦  *List* : ${prefix}listmsg
└  ◦  *Get* : ${prefix}getmsg <keyword>

Gunakan tombol di bawah untuk melihat seluruh daftar pesan yang tersimpan.`;
      const helperButtons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "📑 Buka Daftar Pesan",
          id: `${prefix}listmsg`
        })
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(helperBody, botFooter, helperButtons, {
          jid: ctx.id,
          quoted: msg
        });
      }
      return await ctx.reply(helperBody, {
        quoted: msg
      });
    } catch (error) {
      console.error("[CustomMsg Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`Error: ${error?.message || error}`);
    }
  }
};