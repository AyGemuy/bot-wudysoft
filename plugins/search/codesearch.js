import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const codeCache = new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      select: ["s", "sel", "pilih", "set"],
      page: ["p", "pg", "halaman"],
      limit: ["l", "perpage", "max"],
      type: ["t", "mode", "sendtype"],
      lang: ["languange", "bahasa"],
      repo: ["repository", "r"],
      path: ["dir", "folder"]
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
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
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
async function fetchFullRawCode(rawUrl, fallbackCode = "") {
  if (!rawUrl) return fallbackCode;
  try {
    const res = await axios.get(rawUrl, {
      timeout: 15e3,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    if (typeof res.data === "string" && res.data.trim().length > 0) {
      return res.data;
    }
    return typeof res.data === "object" ? JSON.stringify(res.data, null, 2) : fallbackCode;
  } catch (err) {
    console.error("[CodeSearch] Gagal mengambil raw code, menggunakan fallback:", err.message);
    return fallbackCode;
  }
}
async function sendFullCodeResult(sock, ctx, item, query, sendType, footer, quotedMsg) {
  const fileName = item.file?.name || item.path?.split("/").pop() || "CodeFile.txt";
  const repoName = item.repository?.full_name || item.repo || "Unknown Repo";
  const author = item.author?.username || item.repository?.owner || "Unknown";
  const fileUrl = item.file?.raw_url || `https://raw.githubusercontent.com/${repoName}/${item.branch || "main"}/${item.path || fileName}`;
  const language = item.file?.extension || item.language || "javascript";
  const totalMatches = item.total_matches || item.snippets?.length || 0;
  let initialPreview = (item.preview_code || "").trim();
  if (!initialPreview && item.snippets?.length > 0) {
    initialPreview = item.snippets.map(s => s.code).join("\n");
  }
  const fullCode = await fetchFullRawCode(fileUrl, initialPreview || "// Kode tidak dapat dimuat.");
  const headerText = `– *C O D E  S E A R C H  I N F O*\n\n` + `┌ ◦ *Query* : ${query}\n` + `├ ◦ *File Path* : ${item.file?.path || item.path || fileName}\n` + `├ ◦ *Repository* : ${repoName}\n` + `├ ◦ *Author* : @${author}\n` + `├ ◦ *Total Matches* : ${totalMatches} Baris\n` + `└ ◦ *Raw URL* : ${fileUrl}`;
  if (sendType === "doc" || sendType === "document") {
    const fileBuffer = Buffer.from(fullCode, "utf-8");
    return await sock.sendMessage(ctx.id, {
      document: fileBuffer,
      fileName: fileName,
      mimetype: "text/plain",
      caption: headerText
    }, {
      quoted: quotedMsg
    });
  }
  try {
    return await sock.sendMessage(ctx.id, {
      aiRich: {
        language: language,
        code: fullCode,
        header: headerText,
        footer: footer
      }
    }, {
      quoted: quotedMsg
    });
  } catch (e) {
    console.log("[CodeSearch] Fallback dari direct sendMessage aiRich...", e?.message);
  }
  if (typeof sock.airich === "function") {
    const rich = sock.airich();
    rich.setTitle("C O D E  S E A R C H");
    rich.setFooter(footer);
    rich.addMetadata(`GitHub Code Search Result`);
    rich.addText(headerText);
    rich.addCode(language, fullCode);
    return await rich.send(ctx.id, {
      quoted: quotedMsg
    });
  }
  const bodyText = `${headerText}\n\n\`\`\`${language}\n${fullCode}\n\`\`\`\n\n${footer}`;
  return await sock.sendMessage(ctx.id, {
    text: bodyText
  }, {
    quoted: quotedMsg
  });
}
export default {
  name: "codesearch",
  aliases: ["searchcode", "ghcode", "gitcode", "caricode"],
  description: "Cari potongan kode di GitHub via Wudysoft API dengan CTA List, auto raw code, dan opsi kirim AIRich / Dokumen",
  category: "Search",
  limit: true,
  example: "codesearch aygemuy atau codesearch --select 1",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const botName = global.bot?.name || "WudysoftBot";
    const footer = global.footer || global.bot?.footer || `_${botName}_`;
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["codesearch", "searchcode", "ghcode", "gitcode", "caricode"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const userCached = codeCache.get(senderId);
      if (flags.select !== undefined && userCached?.results) {
        const selectIdx = Number(flags.select) - 1;
        const selectedItem = userCached.results[selectIdx];
        if (!selectedItem) {
          await ctx.react("❌");
          return ctx.reply(`❌ File #${flags.select} tidak ditemukan. Pilihan tersedia: 1 - ${userCached.results.length}`);
        }
        if (flags.type) {
          await ctx.react("⏳");
          await sendFullCodeResult(sock, ctx, selectedItem, userCached.query, flags.type, footer, quotedMsg);
          await ctx.react("✅");
          return;
        }
        const fileName = selectedItem.file?.name || selectedItem.path?.split("/").pop() || "Code File";
        const repoName = selectedItem.repository?.full_name || selectedItem.repo || "Unknown Repo";
        const typeButtons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💬 Send AIRich Code Block",
            id: `${prefix}codesearch "${userCached.query}" --select ${flags.select} --type rich`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📄 Send File Document",
            id: `${prefix}codesearch "${userCached.query}" --select ${flags.select} --type doc`
          })
        }];
        const bodyOptions = `– *O P S I  P E N G I R I M A N  K O D E*\n\n` + `┌ ◦ *File* : ${fileName}\n` + `└ ◦ *Repo* : ${repoName}\n\n` + `Pilih format pengiriman yang diinginkan:`;
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyOptions, footer, typeButtons, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(bodyOptions, {
            quoted: quotedMsg
          });
        }
        return;
      }
      const query = cleanPrompt || userCached?.query;
      if (!query) {
        const helpText = `– *C O D E  S E A R C H*\n\n` + `┌ ◦ *Usage* : ${prefix}codesearch <keyword>\n` + `├ ◦ *Pilih File* : ${prefix}codesearch --select <nomor>\n` + `└ ◦ *Pagination* : ${prefix}codesearch <keyword> --page <nomor>\n\n` + `${footer}`;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      let results = [];
      let total = 0;
      const page = Number(flags.page) || 1;
      const limit = Number(flags.limit) || 10;
      if (userCached && userCached.query === query.toLowerCase() && userCached.results?.length > 0 && !Object.keys(flags).some(k => !["page", "limit", "select", "type"].includes(k))) {
        results = userCached.results;
        total = userCached.total || results.length;
      } else {
        const payload = {
          query: query,
          page: page,
          limit: flags.limit || 30,
          ...flags
        };
        const {
          data
        } = await axios.post(`${global.bot?.api?.wudysoft}/api/search/code/v2`, payload, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        if (!data || data.status !== "success" && !data.status || !data.results || data.results.length === 0) {
          await ctx.react("❌");
          return ctx.reply(`– *E R R O R*\n\n` + `┌ ◦ *Status* : Kode tidak ditemukan\n` + `└ ◦ *Query* : "${query}"\n\n` + `${footer}`);
        }
        results = data.results;
        total = data.total || results.length;
        if (codeCache.size > 50) codeCache.clear();
        codeCache.set(senderId, {
          query: query.toLowerCase(),
          results: results,
          total: total
        });
      }
      const totalPages = Math.ceil(results.length / limit) || 1;
      const currentPage = page < 1 ? 1 : page > totalPages ? totalPages : page;
      const startIndex = (currentPage - 1) * limit;
      const currentPageItems = results.slice(startIndex, startIndex + limit);
      const listRows = currentPageItems.map((item, idx) => {
        const realIndex = startIndex + idx + 1;
        const fileName = item.file?.name || item.path?.split("/").pop() || `File #${realIndex}`;
        const repoName = item.repository?.full_name || item.repo || "Unknown Repo";
        const author = item.author?.username || item.repository?.owner || "Unknown";
        return {
          title: `${realIndex}. ${fileName}`.slice(0, 24),
          id: `${prefix}codesearch "${query}" --select ${realIndex}`,
          description: `Repo: ${repoName} • By: ${author}`.slice(0, 60)
        };
      });
      const listSections = [{
        title: `📂 HASIL PENCARIAN (Hal ${currentPage}/${totalPages})`,
        rows: listRows
      }];
      const bodyText = `– *C O D E  S E A R C H*\n\n` + `┌ ◦ *Query* : ${query}\n` + `├ ◦ *Total Hasil* : ${total} File\n` + `└ ◦ *Halaman* : ${currentPage} / ${totalPages}\n\n` + `Pilih file dari menu daftar di bawah ini untuk mengunduh kode penuh atau menampilkannya dalam format AIRich.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 PILIH FILE KODE",
          sections: listSections
        })
      }];
      if (currentPage > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${currentPage - 1}`,
            id: `${prefix}codesearch "${query}" -p ${currentPage - 1}`
          })
        });
      }
      if (currentPage < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${currentPage + 1}`,
            id: `${prefix}codesearch "${query}" -p ${currentPage + 1}`
          })
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footer, buttons, {
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Code Search Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.message;
      ctx.reply(`– *E R R O R*\n\n┌ ◦ *Info* : ${errMsg}\n└ ◦ *Command* : ${ctx.command || "codesearch"}\n\n${footer}`);
    }
  }
};