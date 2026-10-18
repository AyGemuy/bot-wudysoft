import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  AIRich,
  decodeJid
} from "../../core/serialize.js";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["search", "s", "find", "q"].includes(key)) key = "search";
    if (["contact", "c", "vcard", "v", "kontak"].includes(key)) key = "contact";
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
  name: "listowner",
  aliases: ["ownerlist", "owners", "daftarowner", "owner"],
  description: "Menampilkan daftar seluruh owner & developer bot via AIRich Directory",
  category: "Info",
  example: ".owner atau .owner -s 628xxx atau .owner -c atau .owner --help",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.bot?.footer || `${botName} • Official Directory`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const targetChat = ctx.chat || ctx.id;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["listowner", "ownerlist", "owners", "daftarowner", "owner"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (flags.help) {
        const helpText = `–  *O W N E R  D I R E C T O R Y*\n\n` + `┌  ◦  *Usage* : \`${prefix}owner [options]\`\n` + `│  ◦  *vCard* : \`${prefix}owner -c\` (Kirim kontak WA)\n` + `│  ◦  *Search* : \`${prefix}owner -s 628xxx\`\n` + `└  ◦  *Function* : Direktori resmi pengembang bot\n\n` + `_${footer}_`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const mainAuthorNum = String(global.bot?.author?.number || global.bot?.owner?.[0] || "").replace(/\D/g, "");
      const mainAuthorName = global.bot?.author?.name || global.bot?.ownerName || "Main Developer";
      const rawOwners = Array.isArray(global.bot?.owner) ? global.bot.owner.map(o => String(o).replace(/\D/g, "")).filter(Boolean) : [];
      let uniqueOwners = [...new Set([mainAuthorNum, ...rawOwners].filter(Boolean))];
      if (flags.contact) {
        const contacts = uniqueOwners.map(num => ({
          displayName: num === mainAuthorNum ? mainAuthorName : "Co-Owner Bot",
          vcard: `BEGIN:VCARD\n` + `VERSION:3.0\n` + `FN:${num === mainAuthorNum ? mainAuthorName : "Co-Owner Bot"}\n` + `ORG:${botName};\n` + `TEL;type=CELL;type=VOICE;waid=${num}:+${num}\n` + `END:VCARD`
        }));
        await sock.sendMessage(targetChat, {
          contacts: {
            displayName: `${botName} Owners`,
            contacts: contacts
          }
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const searchQuery = (typeof flags.search === "string" ? flags.search : cleanPrompt).replace(/\D/g, "");
      if (searchQuery) {
        uniqueOwners = uniqueOwners.filter(num => num.includes(searchQuery));
      }
      if (uniqueOwners.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`–  *N O T  F O U N D*\n\n` + `Nomor owner tidak ditemukan untuk query: *"${searchQuery}"*`);
      }
      let devAvatar = global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
      if (mainAuthorNum) {
        try {
          const pp = await sock.profilePictureUrl(`${mainAuthorNum}@s.whatsapp.net`, "image");
          if (pp) devAvatar = pp;
        } catch (_) {}
      }
      const rich = typeof sock?.airich === "function" ? sock.airich() : typeof ctx.aiRich === "function" ? ctx.aiRich() : new AIRich(sock);
      rich.setTitle(`✦ ${botName} • Owner & Dev Directory ✦`);
      rich.addPost({
        title: `${mainAuthorName} 👑`,
        username: `+${mainAuthorNum || "Developer"}`,
        subtitle: `${botName} • Lead Developer`,
        thumbnail_url: devAvatar,
        post_url: `https://wa.me/${mainAuthorNum}`,
        post_caption: `Pengembang & pengelola resmi sistem ${botName}. Jika Anda mengalami kendala teknis atau pertanyaan, silakan hubungi kontak resmi.`,
        source_app: "instagram",
        likes_count: 9999,
        comments_count: 777,
        shares_count: 555,
        is_verified: true
      });
      const tableRows = [
        ["No", "Nama / Alias", "Role", "Kontak WhatsApp"]
      ];
      uniqueOwners.forEach((num, idx) => {
        const isMain = num === mainAuthorNum;
        tableRows.push([String(idx + 1), isMain ? mainAuthorName : `Co-Owner #${idx}`, isMain ? "Lead Owner 👑" : "Administrator 🛡️", `+${num}`]);
      });
      rich.addTable(tableRows, `📋 Direktori Owner (${uniqueOwners.length} Kontak)`);
      if (mainAuthorNum) {
        rich.addCopyAction(`+${mainAuthorNum}`, `📋 Salin Nomor (+${mainAuthorNum})`);
      }
      rich.addFooterAction({
        text: `💬 Chat Developer (+${mainAuthorNum})`,
        url: `https://wa.me/${mainAuthorNum}?text=Halo%20${encodeURIComponent(mainAuthorName)},%20saya%20pengguna%20bot%20${encodeURIComponent(botName)}`
      });
      await rich.send(targetChat, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      console.error("[ListOwner AIRich Error]:", e?.message || e);
      await ctx.react("❌");
      const mainAuthorNum = String(global.bot?.author?.number || "").replace(/\D/g, "");
      const mainAuthorName = global.bot?.author?.name || "Main Developer";
      const rawOwners = Array.isArray(global.bot?.owner) ? global.bot.owner.map(o => String(o).replace(/\D/g, "")).filter(Boolean) : [];
      const uniqueOwners = [...new Set([mainAuthorNum, ...rawOwners].filter(Boolean))];
      let fallbackText = `–  *O W N E R  D I R E C T O R Y*\n\n` + `┌  ◦  *Developer* : ${mainAuthorName} (+${mainAuthorNum})\n`;
      const coOwners = uniqueOwners.filter(num => num !== mainAuthorNum);
      if (coOwners.length > 0) {
        fallbackText += coOwners.map((num, i) => `${i === coOwners.length - 1 ? "└" : "│"}  ◦  *Co-Owner #${i + 1}* : +${num}`).join("\n");
      } else {
        fallbackText += `└  ◦  *Status* : Verified Owner\n`;
      }
      fallbackText += `\n\n_Hubungi developer melalui tautan berikut:_\nhttps://wa.me/${mainAuthorNum}`;
      await ctx.reply(fallbackText, {
        quoted: msg
      });
    }
  }
};