import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["action", "a", "act"].includes(key)) key = "action";
    if (["target", "t", "jid", "id", "chat"].includes(key)) key = "target";
    if (["list", "l", "all", "daftar"].includes(key)) key = "list";
    if (["ban", "b"].includes(key)) {
      key = "action";
      val = "ban";
    }
    if (["unban", "un", "u"].includes(key)) {
      key = "action";
      val = "unban";
    }
    if (["search", "s", "find"].includes(key)) key = "search";
    if (["help", "h"].includes(key)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "setchat",
  aliases: ["banchat", "unbanchat", "groupban", "bangroup", "unbangroup", "chatban"],
  description: "Atur status ban/unban chat atau grup bot via CLI & CTA Bottom Sheet",
  category: "Owner",
  owner: true,
  example: "setchat ban atau setchat unban atau setchat --list atau setchat -a ban -t 123456@g.us",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) {
        return ctx.reply("❌ Perintah ini hanya dapat diakses oleh Owner bot.");
      }
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["setchat", "banchat", "unbanchat", "groupban", "bangroup", "unbangroup", "chatban"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Paimon-bot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Chat Access & Ban Manager`;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const freeTokens = cleanPrompt.split(/\s+/).filter(Boolean);
      let action = flags.action || null;
      if (!action && freeTokens[0]) {
        const first = freeTokens[0].toLowerCase();
        if (["ban", "unban", "list"].includes(first)) {
          action = first;
        }
      }
      let targetJid = flags.target || null;
      if (!targetJid) {
        const potentialJid = freeTokens.find(t => t.includes("@g.us") || /\d{10,}/.test(t) && t !== action);
        if (potentialJid) {
          targetJid = potentialJid.includes("@") ? potentialJid : `${potentialJid}@g.us`;
        } else if (ctx.id?.endsWith("@g.us")) {
          targetJid = ctx.id;
        }
      }
      const hasAction = Boolean(action || flags.list || flags.search || targetJid && targetJid !== ctx.id);
      if (!hasAction && !flags.list && flags.help) {
        return ctx.reply(`–  *C H A T  M A N A G E R*

Silakan tentukan aksi dan target chat yang ingin dikelola.

┌  ◦  *Ban Chat Ini* : ${prefix}setchat ban
│  ◦  *Unban Chat Ini* : ${prefix}setchat unban
│  ◦  *Kelola List CTA* : ${prefix}setchat --list
└  ◦  *Target Spesifik* : ${prefix}setchat -a ban -t <jid>

–  *F L A G S*

┌  ◦  *-a, --action* : Aksi \`ban\` atau \`unban\`
│  ◦  *-t, --target* : ID JID chat/grup target
│  ◦  *-l, --list*   : Buka menu daftar chat ter-ban
│  ◦  *-s, --search* : Cari chat ter-ban berdasarkan ID
└  ◦  *-h, --help*   : Menampilkan panduan bantuan ini`);
      }
      if (!global.db.group) global.db.group = {};
      if (flags.list || action === "list" || !action && targetJid) {
        if (typeof ctx.react === "function") await ctx.react("⏳");
        const bannedEntries = Object.entries(global.db.group).filter(([, d]) => d?.bans === true);
        const bannedJids = bannedEntries.map(([jid]) => jid);
        const currentChatBanned = targetJid && global.db.group[targetJid]?.bans === true;
        const actionRows = [];
        if (targetJid) {
          if (currentChatBanned) {
            actionRows.push({
              title: `✅ Unban Chat Ini (${targetJid.split("@")[0].slice(0, 15)})`,
              id: `${prefix}setchat -a unban -t ${targetJid}`,
              description: "Aktifkan kembali bot pada chat/grup ini"
            });
          } else {
            actionRows.push({
              title: `🚫 Ban Chat Ini (${targetJid.split("@")[0].slice(0, 15)})`,
              id: `${prefix}setchat -a ban -t ${targetJid}`,
              description: "Nonaktifkan respon bot pada chat/grup ini"
            });
          }
        }
        const bannedRows = bannedJids.slice(0, 15).map(jid => ({
          title: `🔓 Unban: ${jid.split("@")[0]}`.slice(0, 24),
          id: `${prefix}setchat -a unban -t ${jid}`,
          description: `ID: ${jid}`
        }));
        const listSections = [];
        if (actionRows.length > 0) {
          listSections.push({
            title: "⚡ AKSI CEPAT (CHAT SAAT INI)",
            rows: actionRows
          });
        }
        if (bannedRows.length > 0) {
          listSections.push({
            title: `🚫 DAFTAR CHAT TER-BAN (${bannedJids.length})`,
            rows: bannedRows
          });
        } else if (!actionRows.length) {
          listSections.push({
            title: "📋 INFO STATUS",
            rows: [{
              title: "✨ Tidak Ada Chat Diban",
              id: `${prefix}setchat --help`,
              description: "Semua grup dan chat berjalan normal"
            }]
          });
        }
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🚫 KELOLA BAN (${bannedJids.length} Terban)`,
            sections: listSections
          })
        }];
        const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
        const bodyText = `–  *C H A T  M A N A G E R*

┌  ◦  *Target Chat* : \`${targetJid || "Tidak ada"}\`
│  ◦  *Status Chat* : ${currentChatBanned ? "Ter-Ban 🚫" : "Normal / Aktif ✅"}
└  ◦  *Total Ter-Ban* : ${bannedJids.length} Chat / Grup

Silakan pilih tindakan pada tombol menu di bawah untuk mengelola status akses chat bot.`;
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Chat Ban Manager`,
              button_title: "Kelola Akses Chat"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          let listText = bodyText + "\n\n";
          if (bannedJids.length) {
            listText += "*Daftar Ter-ban:*\n" + bannedJids.map((j, i) => `${i + 1}. \`${j}\``).join("\n");
          }
          await ctx.reply(listText, {
            quoted: quotedMsg
          });
        }
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (!targetJid) {
        return ctx.reply("❌ Target ID chat/grup tidak ditemukan. Harap sertakan ID grup atau gunakan command di dalam grup.");
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (typeof db.ensureGroup === "function") {
        db.ensureGroup(targetJid);
      } else if (!global.db.group[targetJid]) {
        global.db.group[targetJid] = {
          from: targetJid,
          config: {},
          bans: false
        };
      }
      if (action === "ban") {
        global.db.group[targetJid].bans = true;
        if (typeof db?.write === "function") db.write(global.db);
        const banText = `–  *C H A T  B A N N E D*

┌  ◦  *Target JID* : \`${targetJid}\`
│  ◦  *Status Bot* : Dinonaktifkan (Muted)
└  ◦  *Otoritas* : Owner Level

Bot tidak akan merespon perintah apapun di dalam chat atau grup ini.`;
        await sock.sendMessage(ctx.id, {
          text: banText
        }, {
          quoted: quotedMsg
        });
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      if (action === "unban") {
        global.db.group[targetJid].bans = false;
        if (typeof db?.write === "function") db.write(global.db);
        const unbanText = `–  *C H A T  U N B A N N E D*

┌  ◦  *Target JID* : \`${targetJid}\`
│  ◦  *Status Bot* : Diaktifkan Kembali (Normal)
└  ◦  *Otoritas* : Owner Level

Bot telah diaktifkan kembali dan dapat merespon perintah seperti biasa.`;
        await sock.sendMessage(ctx.id, {
          text: unbanText
        }, {
          quoted: quotedMsg
        });
        if (typeof ctx.react === "function") await ctx.react("✅");
        return;
      }
      return ctx.reply(`❌ Aksi tidak dikenali: *"${action}"*. Gunakan opsi \`ban\` atau \`unban\`.`);
    } catch (e) {
      console.error("[SetChat Error]:", e?.message || e);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ SetChat Error: ${e?.message || e}`);
    }
  }
};