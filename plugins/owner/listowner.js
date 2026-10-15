import {
  simpleQuoted
} from "../../lib/quoted.js";

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
  description: "Menampilkan daftar seluruh owner bot via CLI & CTA Bottom Sheet",
  category: "Info",
  example: "owner atau owner -s 628xxx atau owner -c atau owner --help",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
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
        const helpText = `– *O W N E R*\n\n` + `┌ ◦ *Usage* : ${prefix}owner [options]\n` + `│ ◦ *Contact* : ${prefix}owner -c (Kirim vCard)\n` + `└ ◦ *Function* : Menampilkan direktori kontak pengelola bot\n\n` + `– *E X A M P L E*\n\n` + `┌ ◦ *Menu* : ${prefix}owner\n` + `│ ◦ *Search* : ${prefix}owner -s 628xxx\n` + `└ ◦ *vCard* : ${prefix}owner -c\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const mainAuthorNum = String(global.bot?.author?.number || "").replace(/\D/g, "");
      const mainAuthorName = global.bot?.author?.name || "Main Developer";
      const rawOwners = Array.isArray(global.bot?.owner) ? global.bot.owner.map(o => String(o).replace(/\D/g, "")).filter(Boolean) : [];
      let uniqueOwners = [...new Set([mainAuthorNum, ...rawOwners].filter(Boolean))];
      if (flags.contact) {
        const contacts = uniqueOwners.map(num => ({
          displayName: num === mainAuthorNum ? mainAuthorName : "Co-Owner Bot",
          vcard: `BEGIN:VCARD\n` + `VERSION:3.0\n` + `FN:${num === mainAuthorNum ? mainAuthorName : "Co-Owner Bot"}\n` + `ORG:${botName};\n` + `TEL;type=CELL;type=VOICE;waid=${num}:+${num}\n` + `END:VCARD`
        }));
        await sock.sendMessage(ctx.id, {
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
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
      }
      const coOwners = uniqueOwners.filter(num => num !== mainAuthorNum);
      let bodyText = `– *O W N E R*\n\n` + `┌ ◦ *Developer* : ${mainAuthorName} (+${mainAuthorNum})\n`;
      if (coOwners.length > 0) {
        bodyText += coOwners.map((num, i) => {
          const isLast = i === coOwners.length - 1;
          return `${isLast ? "└" : "│"} ◦ *Co-Owner #${i + 1}* : +${num}`;
        }).join("\n") + "\n\n";
      } else {
        bodyText = bodyText.replace("┌ ◦", "└ ◦") + "\n";
      }
      bodyText += `_Pilih kontak atau salin nomor melalui tombol di bawah:_\n\n` + `${footer}`;
      const buttons = [];
      if (mainAuthorNum) {
        buttons.push({
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: `Salin Nomor (+${mainAuthorNum})`,
            id: "copy_dev_num",
            copy_code: `+${mainAuthorNum}`
          })
        });
      }
      const listSections = [{
        title: `${botName} • Owner & Developer`,
        rows: uniqueOwners.map((num, i) => {
          const isMain = num === mainAuthorNum;
          const ownerLabel = isMain ? `${mainAuthorName} (Main)` : `Co-Owner #${i}`;
          return {
            title: ownerLabel.slice(0, 24),
            id: `${prefix}owner -s ${num}`,
            description: `+${num} | Status: ${isMain ? "Owner Utama" : "Co-Owner"}`
          };
        })
      }];
      buttons.push({
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `DAFTAR OWNER (${uniqueOwners.length})`,
          sections: listSections
        })
      });
      const websiteUrl = global.bot?.utils?.source_urls || "https://github.com";
      buttons.push({
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "Saluran Resmi",
          url: websiteUrl
        })
      });
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Kontak Owner`,
            button_title: "Buka Menu Owner"
          },
          limited_time_offer: {
            text: `✦ ${botName} - Official Directory ✦`,
            url: "",
            copy_code: "",
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Directory`, buttons, options);
      } else {
        await ctx.reply(bodyText);
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[ListOwner Error]:", e?.message || e);
      await ctx.react("❌");
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${e?.message || e}\n` + `└ ◦ *Command* : ${ctx.command || "owner"}\n\n` + `${footer}`);
    }
  }
};