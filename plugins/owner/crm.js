import {
  simpleQuoted
} from "../../lib/quoted.js";

function serializePureRawToJs(obj, indent = 2) {
  if (!obj || typeof obj !== "object") return String(obj);
  const bufferTokens = [];
  const json = JSON.stringify(obj, (key, value) => {
    if (typeof value === "bigint") return Number(value);
    if (value && typeof value === "object" && value.constructor?.name === "Long") {
      return value.toNumber?.() ?? value.low ?? 0;
    }
    if (Buffer.isBuffer(value) || value instanceof Uint8Array || value && value.type === "Buffer" && Array.isArray(value.data)) {
      const buf = Buffer.isBuffer(value) ? value : Buffer.from(value.data || value);
      const b64 = buf.toString("base64");
      const token = `__PURE_BUF_${bufferTokens.length}__`;
      bufferTokens.push(`Buffer.from("${b64}", "base64")`);
      return token;
    }
    if (typeof value === "string" && value.length > 50 && (key.toLowerCase().includes("thumb") || key.toLowerCase().includes("media") || key === "jpegThumbnail")) {
      const cleanB64 = value.replace(/^data:image\/[a-z]+;base64,/, "").trim();
      if (/^[A-Za-z0-9+/=]+$/.test(cleanB64)) {
        const token = `__PURE_BUF_${bufferTokens.length}__`;
        bufferTokens.push(`Buffer.from("${cleanB64}", "base64")`);
        return token;
      }
    }
    if (typeof value === "undefined") return undefined;
    return value;
  }, indent);
  let outputJs = json;
  bufferTokens.forEach((code, idx) => {
    outputJs = outputJs.replace(`"__PURE_BUF_${idx}__"`, code);
  });
  return outputJs;
}
export default {
  name: "crm",
  aliases: ["extractmsg", "relayextract", "msgrelay", "compilemsg"],
  description: "Ekstrak 100% full real struktur pesan asli murni ke format sock.relayMessage",
  category: "Tools",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Relay Message`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const chatId = ctx.chat || ctx.id;
      if (!ctx.quoted) {
        await ctx.react?.("❓");
        const helpBody = `–  *C R M  E X T R A C T O R*

Mengekstrak struktur murni pesan WhatsApp untuk sock.relayMessage().

┌  ◦  *File* : ${prefix}crm (dokumen .js)
│  ◦  *Snippet* : ${prefix}crm --snippet
└  ◦  *Copy* : ${prefix}crm --copy

Balas (reply) pesan yang ingin diekstrak dengan salah satu opsi di atas.`;
        const helpButtons = [{
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Format .crm",
            copy_code: `${prefix}crm`
          })
        }, {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⚡ PILIHAN EKSTRAKSI",
            sections: [{
              title: `${botName} • Opsi Ekstraksi`,
              rows: [{
                title: "📄 Ekstrak Berkas .js",
                description: "Struktur asli murni tanpa modifikasi",
                id: `${prefix}crm`
              }, {
                title: "💻 Ekstrak Code Snippet",
                description: "Tampilkan cuplikan kode langsung di chat",
                id: `${prefix}crm --snippet`
              }, {
                title: "📋 Ekstrak Button Copy",
                description: "Salin kode relay langsung ke clipboard",
                id: `${prefix}crm --copy`
              }]
            }]
          })
        }];
        return await ctx.sendCta(helpBody, botFooter, helpButtons, {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Panduan CRM`,
              button_title: "Buka Panduan"
            }
          },
          quoted: quotedMsg
        });
      }
      await ctx.react?.("⏳");
      const q = await ctx.getQuotedObj?.() || ctx.quoted;
      const rawTargetMessage = q?.rawMessage || q?.message || q?.fakeObj?.message || ctx.quoted?.rawMessage || ctx.quoted?.message;
      if (!rawTargetMessage) {
        await ctx.react?.("❌");
        return ctx.reply("❌ Gagal membaca struktur pesan yang dibalas.");
      }
      const formattedJson = serializePureRawToJs(rawTargetMessage, 2);
      const relayCode = `await sock.relayMessage(\n  ctx.id,\n  ${formattedJson},\n  {}\n);`;
      const argsText = (ctx.query || ctx.args?.join(" ") || "").toLowerCase();
      const isSnippet = argsText.includes("--snippet") || argsText.includes("-s");
      const isCopy = argsText.includes("--copy") || argsText.includes("-c");
      if (isSnippet) {
        if (typeof ctx.aiRich === "function") {
          const ai = ctx.aiRich();
          ai.setBody("–  *C R M  S N I P P E T*");
          ai.addCode("javascript", relayCode);
          ai.setFooter("Struktur 100% murni tanpa modifikasi.");
          await ai.send(chatId, {
            quoted: quotedMsg
          });
        } else if (typeof ctx.sendCode === "function") {
          await ctx.sendCode(relayCode, "javascript", {
            disclaimerText: "CRM PURE RAW CODE",
            textBefore: "–  *C R M  S N I P P E T*",
            textAfter: "\n_Struktur 100% murni tanpa modifikasi._",
            quoted: quotedMsg
          });
        } else {
          await ctx.reply("```javascript\n" + relayCode + "\n```", {
            quoted: quotedMsg
          });
        }
        return await ctx.react?.("✅");
      }
      if (isCopy) {
        const copyBody = `–  *R E L A Y  C O D E*

┌  ◦  *Type* : ${q?.mtype || q?.msgType || Object.keys(rawTargetMessage)[0] || "Protobuf"}
└  ◦  *Length* : ${relayCode.length.toLocaleString()} Karakter

Klik tombol di bawah untuk menyalin kode relay ke clipboard.`;
        const ctaButtons = [{
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Kode Relay",
            copy_code: relayCode
          })
        }];
        await ctx.sendCta(copyBody, botFooter, ctaButtons, {
          title: `✦ Relay Code • ${q?.mtype || "Message"} ✦`,
          quoted: quotedMsg
        });
        return await ctx.react?.("✅");
      }
      const fileBuffer = Buffer.from(relayCode, "utf-8");
      const idShort = (q?.id || Date.now().toString(36)).slice(-8);
      const fileName = `crm_raw_${idShort}.js`;
      const captionText = `–  *C R M  E X T R A C T*

┌  ◦  *File* : ${fileName}
│  ◦  *Type* : ${q?.mtype || q?.msgType || Object.keys(rawTargetMessage)[0] || "Protobuf"}
└  ◦  *Size* : ${(fileBuffer.length / 1024).toFixed(2)} KB

Struktur asli murni sesuai payload Baileys relayMessage.`;
      await sock.sendMessage(chatId, {
        document: fileBuffer,
        mimetype: "application/javascript",
        fileName: fileName,
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      return await ctx.react?.("✅");
    } catch (e) {
      console.error("[CRM Error]:", e);
      await ctx.react?.("❌");
      return ctx.reply(`❌ Gagal mengekstrak pesan: ${e.message}`);
    }
  }
};