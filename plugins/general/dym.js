import similarity from "similarity";
import db from "../../data/db.js";

function initDB() {
  if (!global.db) global.db = {};
  if (!global.db.dym) global.db.dym = {};
  if (!global.db.user) global.db.user = {};
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}
export default {
  name: "didyoumean",
  aliases: ["dym"],
  description: "Mendeteksi salah ketik perintah satu kata dengan rekomendasi hingga 5 pilihan (Full DB)",
  category: "Handler",
  execute: async () => {},
  before: async (msg, {
    sock,
    ctx,
    cmd
  }) => {
    try {
      if (!ctx || ctx.isFromMe || ctx.isBot) return;
      const rawText = (ctx.text || ctx.body || "").trim();
      if (!rawText) return;
      const prefixConfig = global.bot?.prefix || ["!", ".", "/", "#"];
      let usedPrefix = ctx.prefix || "";
      let hasPrefix = Boolean(usedPrefix);
      if (!hasPrefix) {
        if (prefixConfig instanceof RegExp) {
          const match = rawText.match(prefixConfig);
          if (match && rawText.startsWith(match[0])) {
            usedPrefix = match[0];
            hasPrefix = true;
          }
        } else if (Array.isArray(prefixConfig)) {
          for (const p of prefixConfig) {
            if (rawText.startsWith(p)) {
              usedPrefix = p;
              hasPrefix = true;
              break;
            }
          }
        } else if (typeof prefixConfig === "string" && rawText.startsWith(prefixConfig)) {
          usedPrefix = prefixConfig;
          hasPrefix = true;
        }
      }
      const textToParse = hasPrefix ? rawText.slice(usedPrefix.length).trim() : rawText;
      const parts = textToParse.split(/\s+/).filter(Boolean);
      if (parts.length !== 1) return;
      const inputCmd = parts[0].toLowerCase().trim();
      const cleanInput = inputCmd.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (!cleanInput || cleanInput.length < 2 || cleanInput.length > 25 || /^\d+$/.test(cleanInput)) {
        return;
      }
      if (/^(.)\1{2,}$/.test(cleanInput)) return;
      if (/^https?:\/\//i.test(inputCmd)) return;
      const loaderObj = cmd || global.cmd || global.loader;
      if (!loaderObj) return;
      const commandMap = new Map();
      if (typeof loaderObj.getCommandsByCategory === "function") {
        const cats = loaderObj.getCommandsByCategory();
        for (const list of Object.values(cats)) {
          for (const c of list || []) {
            const name = (c?.name || c)?.toLowerCase?.();
            if (name) {
              commandMap.set(name, name);
              if (Array.isArray(c?.aliases)) {
                for (const a of c.aliases) commandMap.set(a.toLowerCase(), name);
              }
            }
          }
        }
      } else if (loaderObj.commands instanceof Map) {
        for (const [k, v] of loaderObj.commands.entries()) {
          commandMap.set(k.toLowerCase(), k.toLowerCase());
          if (Array.isArray(v?.aliases)) {
            for (const a of v.aliases) commandMap.set(a.toLowerCase(), k.toLowerCase());
          }
        }
      } else if (typeof loaderObj.commands === "object" && loaderObj.commands !== null) {
        for (const [k, v] of Object.entries(loaderObj.commands)) {
          commandMap.set(k.toLowerCase(), k.toLowerCase());
          if (Array.isArray(v?.aliases)) {
            for (const a of v.aliases) commandMap.set(a.toLowerCase(), k.toLowerCase());
          }
        }
      }
      if (commandMap.has(inputCmd) || commandMap.has(cleanInput)) return;
      const allTargets = Array.from(commandMap.keys());
      if (allTargets.length === 0) return;
      const chatId = ctx.chat || ctx.id;
      const sender = ctx.sender;
      if (!chatId || !sender) return;
      initDB();
      const cooldownKey = `${chatId}_${sender}`;
      const now = Date.now();
      const lastTime = global.db.dym[cooldownKey] || 0;
      if (now - lastTime < 3500) return;
      const minSimilarity = hasPrefix ? .58 : .65;
      const matches = [];
      for (const target of allTargets) {
        const cleanTarget = target.replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (!cleanTarget || cleanTarget.length < 2) continue;
        if (cleanInput[0] !== cleanTarget[0]) continue;
        const score = similarity(cleanInput, cleanTarget);
        if (score >= minSimilarity && score < 1) {
          matches.push({
            target: target,
            canonical: commandMap.get(target),
            rating: score
          });
        }
      }
      if (matches.length === 0) return;
      global.db.dym[cooldownKey] = now;
      saveDB();
      matches.sort((a, b) => b.rating - a.rating);
      const uniqueMatches = [];
      const seen = new Set();
      for (const m of matches) {
        if (!seen.has(m.target)) {
          seen.add(m.target);
          uniqueMatches.push(m);
        }
        if (uniqueMatches.length >= 5) break;
      }
      if (uniqueMatches.length === 0) return;
      const best = uniqueMatches[0];
      const displayPrefix = hasPrefix ? usedPrefix : global.bot?.noprefix ? "" : ".";
      if (typeof ctx.react === "function") await ctx.react("🤔").catch(() => {});
      const mentionTag = `@${sender.split("@")[0]}`;
      const formattedInput = `${hasPrefix ? usedPrefix : ""}${inputCmd}`;
      const bestMatchAccuracy = `${(best.rating * 100).toFixed(0)}%`;
      const bodyText = `Hi ${mentionTag}!
Perintah *${formattedInput}* tidak terdaftar di sistem.

–  *D I D  Y O U  M E A N ?*

┌  ◦  *Input* : ${formattedInput}
│  ◦  *Did You Mean* : ${displayPrefix}${best.target}
│  ◦  *Accuracy* : ${bestMatchAccuracy}
└  ◦  *Options* : ${uniqueMatches.length} Saran Perintah

Pilih perintah yang sesuai melalui menu di bawah.`;
      const footerText = global.bot?.footer || global.bot?.name || "WhatsApp Bot";
      let sent = false;
      const rows = uniqueMatches.map(item => ({
        id: `${displayPrefix}${item.target}`,
        title: `${displayPrefix}${item.target}`,
        description: `Tingkat kecocokan: ${(100 * item.rating).toFixed(0)}%`
      }));
      if (typeof ctx.sendCta === "function") {
        try {
          const buttons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⚡ Jalankan ${displayPrefix}${best.target}`,
              id: `${displayPrefix}${best.target}`
            })
          }, {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🔍 Rekomendasi Perintah",
              sections: [{
                title: "DAFTAR SARAN PERINTAH",
                rows: rows
              }]
            })
          }];
          await ctx.sendCta(bodyText, footerText, buttons, {
            jid: chatId,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: "Menu Saran Perintah",
                button_title: `Saran Perintah (${uniqueMatches.length})`
              }
            },
            contextInfo: {
              mentionedJid: [sender],
              ...global.bot?.utils?.contextInfo || {}
            },
            quoted: msg
          });
          sent = true;
        } catch (_) {}
      }
      if (!sent) {
        const treeLines = uniqueMatches.map((s, idx) => {
          const isLast = idx === uniqueMatches.length - 1;
          const branch = isLast ? "└" : "│";
          return `${branch}  ◦  *${displayPrefix}${s.target}* (${(s.rating * 100).toFixed(0)}%)`;
        }).join("\n");
        const fallbackText = `Hi ${mentionTag}!
Perintah *${formattedInput}* tidak terdaftar di sistem.

–  *D I D  Y O U  M E A N ?*

${treeLines}

Ketik salah satu perintah yang disarankan di atas.`;
        await ctx.reply(fallbackText, {
          quoted: msg,
          mentions: [sender]
        });
      }
      return true;
    } catch (_) {}
  }
};