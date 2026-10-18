import {
  metaQuoted,
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "airich",
  aliases: ["richmsg", "aiui", "codeblock", "tablemsg", "latex"],
  description: "Membuat pesan interaktif AI Rich (Code, Table, LaTeX, Cards, Progress, Imagine) via Baileys Builder",
  category: "Tools",
  example: ".airich code js console.log('hello')\n.airich table\n.airich task\n.airich latex",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || "– Wudysoft • Multi-Device";
      const botContext = global.bot?.utils?.contextInfo || {};
      const args = ctx.args || [];
      const mode = (args[0] || "").toLowerCase();
      if (mode === "code") {
        const lang = args[1] || "javascript";
        const codeInput = args.slice(2).join(" ") || (ctx.quoted?.text ? ctx.quoted.text : `// Example Snippet\nasync function main() {\n  console.log("Hello from ${botName} AI!");\n}`);
        ctx.react?.("⏳");
        if (typeof sock.airich === "function") {
          await sock.airich().setTitle(`Snippet: ${lang.toUpperCase()}`).setFooter(botFooter).setContextInfo(botContext).addCode(lang, codeInput).send(ctx.id);
        } else {
          await sock.sendMessage(ctx.id, {
            aiRich: {
              language: lang,
              code: codeInput,
              header: `**Code Snippet (${lang})**`,
              footer: botFooter
            }
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react?.("✅");
      }
      if (mode === "table") {
        ctx.react?.("⏳");
        const tableData = [
          ["Fitur", "Free", "Premium", "VIP"],
          ["Limit", "20 / Hari", "Unlimited", "Unlimited"],
          ["AI Rich", "❌", "✅", "✅"],
          ["Group Security", "❌", "✅", "✅"],
          ["Kecepatan", "Normal", "Prioritas", "Ultra Fast"]
        ];
        if (typeof sock.airich === "function") {
          await sock.airich().setTitle("Paket Langganan Bot").setFooter(botFooter).setContextInfo(botContext).addTable(tableData).addSuggest(["Upgrade Premium", "Hubungi Owner"]).send(ctx.id);
        } else {
          await sock.sendMessage(ctx.id, {
            aiRich: {
              table: ["Paket Langganan Bot", ...tableData],
              footer: botFooter
            }
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react?.("✅");
      }
      if (mode === "task" || mode === "progress") {
        ctx.react?.("⏳");
        if (typeof sock.airich === "function") {
          await sock.airich().setTitle("Pipeline Automation Server").setFooter(botFooter).setContextInfo(botContext).addThinkingStatus("Memverifikasi kredensial akun...", "WEB_SEARCH").addTask({
            taskId: "t1",
            title: "Autentikasi Session",
            subtitle: "Turso & SQLite Keyv",
            status: "DONE"
          }).addTask({
            taskId: "t2",
            title: "Sinkronisasi Chat & Kontak",
            subtitle: "Mengambil history...",
            status: "RUNNING"
          }).addTask({
            taskId: "t3",
            title: "Pembersihan Cache Kedaluwarsa",
            status: "PENDING"
          }).addProgressStatus("Sistem beroperasi optimal (85%)", true).send(ctx.id);
          return ctx.react?.("✅");
        }
      }
      if (mode === "latex") {
        ctx.react?.("⏳");
        const formulaImg = "https://server.wallpaperalchemy.com/storage/wallpapers/121/4k-anime-wallpaper-starry-night-adventure.jpg";
        if (typeof sock.airich === "function") {
          await sock.airich().setTitle("Persamaan Fisika Kuantum").setFooter(botFooter).setContextInfo(botContext).addText("Rumus Kesetaraan Massa dan Energi (Einstein):").addLatex({
            expression: "E = mc^2",
            imageUrl: formulaImg,
            width: 300,
            height: 60
          }).send(ctx.id);
          return ctx.react?.("✅");
        }
      }
      if (mode === "imagine") {
        ctx.react?.("⏳");
        const prompt = args.slice(1).join(" ") || "Anime girl starry night 4k masterpiece";
        if (typeof sock.airich === "function") {
          await sock.airich().setTitle("Meta AI Imagine Engine").setFooter(botFooter).setContextInfo(botContext).addText(`🎨 *Prompt*: \`${prompt}\``).addImagine({
            mediaType: "image",
            status: "GENERATING",
            estimatedMs: 4e3
          }).send(ctx.id);
          return ctx.react?.("✅");
        }
      }
      const help = `–  *A I  R I C H  B U I L D E R*

Rancang pesan interaktif kaya fitur langsung via Baileys API:

┌  ◦  *Code Block* : \`${prefix}airich code <lang> <syntax>\`
│  ◦  *Tabel Interaktif* : \`${prefix}airich table\`
│  ◦  *Progress & Task* : \`${prefix}airich task\`
│  ◦  *Rumus LaTeX* : \`${prefix}airich latex\`
└  ◦  *Imagine AI Card* : \`${prefix}airich imagine <prompt>\`

_${botFooter}_`;
      return await sock.sendMessage(ctx.id, {
        text: help,
        contextInfo: botContext
      }, {
        quoted: quotedMsg
      });
    } catch (err) {
      console.error("[AIRICH Error]:", err);
      ctx.react?.("❌");
      ctx.reply(`❌ Gagal: ${err?.message || err}`);
    }
  }
};