import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  makeJid
} from "../../core/tools.js";
import db from "../../data/db.js";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      delete: ["del", "d", "remove", "rm", "u", "user"],
      search: ["s", "find", "q"],
      list: ["l", "all", "a", "menu"],
      help: ["h"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
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
  name: "delowner",
  aliases: ["hapusowner", "deleteowner", "delown", "rmowner"],
  description: "Hapus nomor dari daftar owner bot via CLI & CTA Bottom Sheet",
  category: "Owner",
  owner: true,
  example: "delowner -l atau delowner 628xxx atau delowner -d 628xxx atau delowner -s 628",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) {
        return ctx.reply("❌ Perintah ini hanya dapat diakses oleh Owner Bot.");
      }
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["delowner", "hapusowner", "deleteowner", "delown", "rmowner"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Owner Manager`;
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const mainAuthorNum = String(global.bot?.author?.number || "").replace(/\D/g, "");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const hasQuotedTarget = Boolean(ctx.quoted?.sender);
      const hasAction = Boolean(flags.delete || flags.search || flags.list || flags.all || cleanPrompt || hasQuotedTarget);
      if (!hasAction || flags.help) {
        return ctx.reply(`–  *D E L  O W N E R*

Silakan tentukan nomor yang ingin dicabut dari akses owner.

┌  ◦  *Direct* : ${prefix}delowner <nomor>
│  ◦  *Reply* : reply pesan + ${prefix}delowner
│  ◦  *Interactive* : ${prefix}delowner -l
└  ◦  *Example* : ${prefix}delowner 628xxx

–  *F L A G S*

┌  ◦  *-l, --list* : Menu interaktif daftar owner
│  ◦  *-d, --delete* : Cabut akses nomor tertentu
└  ◦  *-s, --search* : Cari nomor dalam database`);
      }
      let targetRaw = null;
      if (typeof flags.delete === "string") {
        targetRaw = flags.delete.replace(/\D/g, "");
      } else if (cleanPrompt && !flags.list && !flags.search) {
        targetRaw = cleanPrompt.replace(/\D/g, "");
      } else if (hasQuotedTarget && !flags.list && !flags.search) {
        targetRaw = ctx.quoted.sender.replace(/\D/g, "");
      }
      if (targetRaw && targetRaw.length >= 5) {
        const noJid = targetRaw;
        const targetJid = typeof makeJid === "function" ? makeJid(noJid) : `${noJid}@s.whatsapp.net`;
        if (noJid === mainAuthorNum) {
          return ctx.reply("❌ Tidak dapat menghapus Owner Utama / Developer bot.");
        }
        const isCurrentOwner = (global.bot?.owner || []).some(o => String(o).replace(/\D/g, "") === noJid) || Boolean(global.db?.user?.[targetJid]?.ownerAcces);
        if (!isCurrentOwner) {
          return ctx.reply(`❌ Nomor *+${noJid}* tidak ditemukan di dalam daftar owner.`);
        }
        await ctx.react("⏳");
        if (Array.isArray(global.bot?.owner)) {
          global.bot.owner = global.bot.owner.filter(v => String(v).replace(/\D/g, "") !== noJid && v !== targetJid);
        }
        if (global.db?.user?.[targetJid]) {
          global.db.user[targetJid].ownerAcces = false;
        }
        if (typeof db?.write === "function") {
          db.write(global.db);
        }
        const successText = `–  *D E L  O W N E R*

Akses owner berhasil dicabut.

┌  ◦  *Number* : +${noJid}
│  ◦  *JID* : ${targetJid}
└  ◦  *Status* : User Biasa`;
        await ctx.reply(successText);
        await ctx.react("✅");
        return;
      }
      const allOwners = Array.isArray(global.bot?.owner) ? [...new Set(global.bot.owner.map(o => String(o).replace(/\D/g, "")).filter(Boolean))] : [];
      let deletableOwners = allOwners.filter(num => num !== mainAuthorNum);
      const searchQuery = (typeof flags.search === "string" ? flags.search : cleanPrompt).replace(/\D/g, "");
      const isSearch = Boolean(searchQuery && !flags.list);
      if (isSearch) {
        deletableOwners = deletableOwners.filter(num => num.includes(searchQuery));
      }
      if (deletableOwners.length === 0) {
        await ctx.react("❌");
        if (isSearch) {
          return ctx.reply(`❌ Tidak ditemukan nomor owner yang cocok dengan keyword: *"${searchQuery}"*`);
        }
        return ctx.reply(`–  *O W N E R S*

Saat ini hanya ada Owner Utama (+${mainAuthorNum}) yang permanen.

┌  ◦  *Info* : Tidak ada owner tambahan
└  ◦  *Action* : Ketik ${prefix}listowner untuk melihat info owner`);
      }
      await ctx.react("⏳");
      const listSections = [{
        title: `${botName} • Cabut Akses Owner`,
        rows: deletableOwners.map(num => ({
          title: `[ Cabut ] +${num}`,
          id: `${prefix}delowner -d ${num}`,
          description: `Cabut status owner (+${num})`
        }))
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🗑️ PILIH OWNER (${deletableOwners.length})`,
          sections: listSections
        })
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = `Hi ${userName}!
Berikut adalah nomor pemilik bot yang dapat dicabut.

–  *O W N E R S*

┌  ◦  *Permanent* : +${mainAuthorNum}
│  ◦  *Additional* : ${deletableOwners.length} Nomor
└  ◦  *Filter* : ${searchQuery || "All"}

Pilih nomor dari menu di bawah untuk mencabut status owner.`;
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • DelOwner Manager`,
            button_title: "Pilih Nomor"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      } else {
        let listText = bodyText + "\n\n";
        deletableOwners.forEach((num, idx) => {
          listText += `${idx + 1}. \`${prefix}delowner -d ${num}\`\n`;
        });
        await ctx.reply(listText);
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[DelOwner Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ DelOwner Error: ${error?.message || error}`);
    }
  }
};