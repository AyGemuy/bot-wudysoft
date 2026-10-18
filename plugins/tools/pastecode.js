import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = `${global.bot?.api?.wudysoft}/api/tools/paste/v1`;

function parseCli(rawInput = "") {
  const tokens = rawInput.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(t => t.replace(/^["']|["']$/g, "")) || [];
  const cli = {
    action: null,
    key: null,
    search: null,
    page: 1,
    title: "Code Snippet",
    syntax: "javascript",
    expire: null,
    body: null,
    freeArgs: []
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    if (["--get", "-g", "get", "read"].includes(lower)) {
      cli.action = "get";
      if (tokens[i + 1] && !tokens[i + 1].startsWith("-")) cli.key = tokens[++i];
    } else if (["--delete", "--del", "-d", "delete", "del"].includes(lower)) {
      cli.action = "delete";
      if (tokens[i + 1] && !tokens[i + 1].startsWith("-")) cli.key = tokens[++i];
    } else if (["--clear", "-c", "clear"].includes(lower)) {
      cli.action = "clear";
    } else if (["--list", "-l", "list"].includes(lower)) {
      cli.action = "list";
      if (tokens[i + 1] && !isNaN(tokens[i + 1])) cli.page = parseInt(tokens[++i], 10);
    } else if (["--search", "--find", "-s", "-f", "search", "find"].includes(lower)) {
      cli.action = "search";
      if (tokens[i + 1] && !tokens[i + 1].startsWith("-")) cli.search = tokens[++i];
    } else if (["--page", "-p"].includes(lower) && tokens[i + 1]) {
      cli.page = parseInt(tokens[++i], 10) || 1;
    } else if (["--title", "-t"].includes(lower) && tokens[i + 1]) {
      cli.title = tokens[++i];
    } else if (["--syntax", "--lang"].includes(lower) && tokens[i + 1]) {
      cli.syntax = tokens[++i].toLowerCase();
    } else if (["--key", "-k"].includes(lower) && tokens[i + 1]) {
      cli.key = tokens[++i];
    } else if (["--expire", "-e"].includes(lower) && tokens[i + 1]) {
      cli.expire = parseInt(tokens[++i], 10);
    } else if (["--body", "-b", "--data"].includes(lower) && tokens[i + 1]) {
      cli.body = tokens[++i];
    } else {
      cli.freeArgs.push(token);
    }
  }
  return cli;
}
async function callPasteApi(bodyPayload) {
  const response = await axios.post(API_BASE, bodyPayload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    timeout: 3e4,
    validateStatus: status => status < 500
  });
  return response.data;
}
export default {
  name: "pastecode",
  aliases: ["paste", "pastebin", "hastebin", "getpaste", "pastelist", "pastesearch"],
  description: "CLI Cloud Pastebin dengan Search, Pagination & Interactive CTA",
  category: "Tools",
  limit: true,
  example: ".pastecode --list -p 2 | .pastecode --search query | .pastecode -t 'Judul' -b 'kode'",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    try {
      let quotedText = (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || "").trim();
      if (!quotedText && (ctx.isMedia || ctx.quoted?.isMedia)) {
        try {
          const downloadFn = ctx.quoted?.download || ctx.download;
          const buffer = typeof downloadFn === "function" ? await downloadFn.call(ctx.quoted || ctx) : null;
          if (buffer && Buffer.isBuffer(buffer)) {
            quotedText = buffer.toString("utf-8").trim();
          }
        } catch {}
      }
      const rawInput = (ctx.args ? ctx.args.join(" ") : ctx.query || "").trim();
      const cli = parseCli(rawInput);
      if (ctx.command === "getpaste") cli.action = "get";
      if (ctx.command === "pastelist") cli.action = "list";
      if (ctx.command === "pastesearch") cli.action = "search";
      if (cli.action === "get") {
        const pasteKey = cli.key || cli.freeArgs[0];
        if (!pasteKey) {
          return ctx.reply(`– *P A S T E  C O D E*\n\n` + `┌ ◦ *Usage* : ${prefix}pastecode --get <key>\n` + `└ ◦ *Example* : ${prefix}pastecode --get AbCd123\n\n` + `${footer}`);
        }
        await ctx.react("⏳");
        const data = await callPasteApi({
          action: "get",
          key: pasteKey
        });
        if (!data || data.error) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Tidak ditemukan\n` + `└ ◦ *Info* : ${data?.error || "Paste tidak ditemukan atau telah kedaluwarsa."}\n\n` + `${footer}`);
        }
        const rawUrl = `${API_BASE}?action=get&key=${data.key}&raw=true`;
        const createdAt = data.createdAt ? new Date(data.createdAt).toLocaleString("id-ID") : "-";
        const bodyText = `– *P A S T E  C O D E*\n\n` + `┌ ◦ *Title* : ${data.title || "Untitled"}\n` + `│ ◦ *Key* : ${data.key}\n` + `│ ◦ *Syntax* : ${data.syntax || "text"}\n` + `│ ◦ *Created* : ${createdAt}\n` + `└ ◦ *Raw URL* : ${rawUrl}\n\n` + `\`\`\`${data.syntax || "text"}\n${data.content}\n\`\`\`\n\n` + `${footer}`;
        const buttons = [{
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "Salin Isi Kode",
            copy_code: String(data.content || "")
          })
        }, {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "Buka Raw Link",
            url: rawUrl
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "Hapus Paste",
            id: `${prefix}pastecode --delete ${data.key}`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "Lihat Daftar",
            id: `${prefix}pastecode --list`
          })
        }];
        await ctx.react("✅");
        return await ctx.sendCta(bodyText, `${botName} • Pastebin Reader`, buttons, {
          quoted: quotedMsg
        });
      }
      if (cli.action === "delete") {
        const pasteKey = cli.key || cli.freeArgs[0];
        if (!pasteKey) {
          return ctx.reply(`– *P A S T E  C O D E*\n\n` + `┌ ◦ *Usage* : ${prefix}pastecode --delete <key>\n` + `└ ◦ *Example* : ${prefix}pastecode --delete AbCd123\n\n` + `${footer}`);
        }
        await ctx.react("⏳");
        const data = await callPasteApi({
          action: "delete",
          key: pasteKey
        });
        if (!data || data.error) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal menghapus\n` + `└ ◦ *Info* : ${data?.error || "Gagal menghapus paste."}\n\n` + `${footer}`);
        }
        const bodyText = `– *P A S T E  C O D E*\n\n` + `┌ ◦ *Status* : Berhasil Dihapus\n` + `└ ◦ *Key* : ${pasteKey}\n\n` + `${footer}`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "Kembali ke Daftar",
            id: `${prefix}pastecode --list`
          })
        }];
        await ctx.react("✅");
        return await ctx.sendCta(bodyText, `${botName} • Delete Paste`, buttons, {
          quoted: quotedMsg
        });
      }
      if (cli.action === "clear") {
        await ctx.react("⏳");
        const data = await callPasteApi({
          action: "clear"
        });
        await ctx.react("✅");
        return ctx.reply(`– *P A S T E  C O D E*\n\n` + `┌ ◦ *Status* : Seluruh Paste Dibersihkan\n` + `└ ◦ *Info* : ${data?.message || "Seluruh data pastebin telah direset."}\n\n` + `${footer}`);
      }
      if (cli.action === "list" || cli.action === "search") {
        await ctx.react("⏳");
        const data = await callPasteApi({
          action: "list"
        });
        let pasteList = Array.isArray(data) ? data : [];
        if (pasteList.length === 0) {
          await ctx.react("✅");
          return ctx.reply(`– *P A S T E  C O D E*\n\n` + `┌ ◦ *Status* : Daftar Paste Kosong\n` + `└ ◦ *Action* : Buat baru dengan ${prefix}pastecode -t "Judul" -b "kode"\n\n` + `${footer}`);
        }
        const searchQuery = cli.search || (cli.action === "search" ? cli.freeArgs.join(" ") : "");
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          pasteList = pasteList.filter(p => (p.title || "").toLowerCase().includes(q) || (p.key || "").toLowerCase().includes(q) || (p.syntax || "").toLowerCase().includes(q));
        }
        if (pasteList.length === 0) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Tidak ditemukan\n` + `└ ◦ *Query* : "${searchQuery}"\n\n` + `${footer}`);
        }
        const itemsPerPage = 10;
        const totalItems = pasteList.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        let page = cli.page || 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        const startIndex = (page - 1) * itemsPerPage;
        const currentPageItems = pasteList.slice(startIndex, startIndex + itemsPerPage);
        const pasteRows = currentPageItems.map((p, i) => ({
          title: (p.title || "Untitled").slice(0, 24),
          description: `Key: ${p.key} | Syntax: ${p.syntax || "text"}`,
          id: `${prefix}pastecode --get ${p.key}`
        }));
        const listSections = [{
          title: `DAFTAR SNIPPET (Hal ${page}/${totalPages})`,
          rows: pasteRows
        }];
        const bodyText = `– *P A S T E  C O D E  -  ${searchQuery ? "S E A R C H" : "L I S T"}*\n\n` + (searchQuery ? `┌ ◦ *Query* : "${searchQuery}"\n` : "┌ ◦ *Dashboard* : Pastebin CLI\n") + `│ ◦ *Total* : ${totalItems} Snippet\n` + `└ ◦ *Page* : ${page} / ${totalPages}\n\n` + `_Pilih snippet pada menu di bawah untuk membaca isi kode:_\n\n` + `${footer}`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "PILIH SNIPPET",
            sections: listSections
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: searchQuery ? `${prefix}pastecode --search "${searchQuery}" -p ${page - 1}` : `${prefix}pastecode --list -p ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: searchQuery ? `${prefix}pastecode --search "${searchQuery}" -p ${page + 1}` : `${prefix}pastecode --list -p ${page + 1}`
            })
          });
        }
        await ctx.react("✅");
        return await ctx.sendCta(bodyText, `${botName} • Snippet Manager`, buttons, {
          quoted: quotedMsg
        });
      }
      let content = cli.body || quotedText || cli.freeArgs.join(" ").trim();
      if (/^https?:\/\/[^\s]+$/i.test(content)) {
        try {
          const res = await axios.get(content, {
            responseType: "text",
            timeout: 15e3
          });
          content = typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
        } catch {}
      }
      if (!content) {
        const helpText = `– *P A S T E  C O D E*\n\n` + `┌ ◦ *Usage* : ${prefix}pastecode <flags> [code]\n` + `│ ◦ *Quoted* : Balas teks/file dokumen kode program\n` + `└ ◦ *Function* : CLI Cloud Pastebin & Code Sharing\n\n` + `– *C O M M A N D S*\n\n` + `┌ ◦ *Create* : ${prefix}pastecode -t "Judul" --syntax js -b "code"\n` + `│ ◦ *Get* : ${prefix}pastecode --get <key>\n` + `│ ◦ *List* : ${prefix}pastecode --list -p 1\n` + `│ ◦ *Search* : ${prefix}pastecode --search <query>\n` + `└ ◦ *Delete* : ${prefix}pastecode --delete <key>\n\n` + `${footer}`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "Lihat Semua List",
            id: `${prefix}pastecode --list`
          })
        }];
        return await ctx.sendCta(helpText, `${botName} • Pastebin Helper`, buttons, {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const data = await callPasteApi({
        action: "create",
        title: String(cli.title || "Code Snippet"),
        content: String(content),
        syntax: String(cli.syntax || "javascript"),
        ...cli.key && {
          key: String(cli.key)
        },
        ...cli.expire && {
          expireIn: parseInt(cli.expire, 10)
        }
      });
      if (!data || data.error || !data.key) {
        await ctx.react("❌");
        return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Gagal membuat paste\n` + `└ ◦ *Info* : ${data?.error || "Terjadi kesalahan pada server."}\n\n` + `${footer}`);
      }
      const rawUrl = `${API_BASE}?action=get&key=${data.key}&raw=true`;
      const createdAt = new Date(data.createdAt || Date.now()).toLocaleString("id-ID");
      const bodyText = `– *P A S T E  C O D E*\n\n` + `┌ ◦ *Title* : ${data.title}\n` + `│ ◦ *Key* : ${data.key}\n` + `│ ◦ *Syntax* : ${data.syntax}\n` + `│ ◦ *Created* : ${createdAt}\n` + (data.expiresAt ? `│ ◦ *Expired* : ${new Date(data.expiresAt).toLocaleString("id-ID")}\n` : "") + `└ ◦ *Raw URL* : ${rawUrl}\n\n` + `${footer}`;
      const buttons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "Salin Key Paste",
          copy_code: String(data.key)
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Baca Paste",
          id: `${prefix}pastecode --get ${data.key}`
        })
      }, {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "Buka Raw Link",
          url: rawUrl
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "Hapus Paste",
          id: `${prefix}pastecode --delete ${data.key}`
        })
      }];
      await ctx.react("✅");
      return await ctx.sendCta(bodyText, `${botName} • Paste Created`, buttons, {
        quoted: quotedMsg
      });
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Info* : ${errMsg}\n` + `└ ◦ *Command* : ${ctx.command || "pastecode"}\n\n` + `${footer}`);
    }
  }
};