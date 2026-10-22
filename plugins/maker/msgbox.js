import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["t", "title", "judul"].includes(lowerKey)) key = "title";
    if (["b", "btn", "buttons", "tombol"].includes(lowerKey)) key = "buttons";
    if (["text", "msg", "message", "pesan"].includes(lowerKey)) key = "text";
    if (["ico", "icon"].includes(lowerKey)) key = "icon";
    if (["f", "font"].includes(lowerKey)) key = "font";
    if (["w", "width", "lebar"].includes(lowerKey)) key = "width";
    if (["wincolor", "winbg", "windowcolor"].includes(lowerKey)) key = "winColor";
    if (["barstart", "barstartcolor"].includes(lowerKey)) key = "barStart";
    if (["barend", "barendcolor"].includes(lowerKey)) key = "barEnd";
    if (["bartext", "bartextcolor"].includes(lowerKey)) key = "barText";
    if (["btntext", "buttontextcolor"].includes(lowerKey)) key = "btnText";
    if (["btnbg", "buttonbgcolor"].includes(lowerKey)) key = "btnBg";
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
export default {
  name: "msgbox",
  aliases: ["messagebox", "retrobox", "winbox"],
  description: "Membuat dialog retro Windows Message Box via Wudysoft API",
  category: "Maker",
  limit: true,
  example: "msgbox chatbot --title Setuju --buttons gak;iy",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["msgbox", "messagebox", "retrobox", "winbox"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText) {
        return ctx.reply(`–  *W I N D O W S  M S G B O X*

Gunakan fitur ini untuk membuat dialog pop-up Windows retro.

┌  ◦  *Format* :
│  \`${prefix}msgbox <pesan> --title <judul> --buttons <btn1;btn2>\`
│
├  ◦  *Helper Flags (Opsional)* :
│  ◦ \`--icon <icon_id>\`
│  ◦ \`--font <font_name>\` (default: tahoma)
│  ◦ \`--width <px>\` (default: 300)
│  ◦ \`--winColor <hex>\` (default: #c0c0c0)
│  ◦ \`--barStart <hex>\` | \`--barEnd <hex>\` | \`--barText <hex>\`
│  ◦ \`--btnBg <hex>\` | \`--btnText <hex>\`
│
└  ◦  *Contoh* :
   \`${prefix}msgbox chatbot --title Setuju --buttons gak;iy\`
   \`${prefix}msgbox "Simpan file ini?" --title "Konfirmasi" --buttons "Ya;Tidak;Batal" --winColor #008080\``);
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const text = flags.text || cleanPrompt;
      const title = flags.title || "Message";
      const buttons = flags.buttons || "OK";
      if (!text) {
        return ctx.reply("❌ Parameter teks/pesan tidak boleh kosong.");
      }
      await ctx.react?.("⏳");
      const payload = {
        text: text,
        title: title,
        buttons: buttons,
        icon: flags.icon || "",
        font: flags.font || "tahoma",
        width: flags.width || "300",
        winColor: flags.winColor || "#c0c0c0",
        barStart: flags.barStart || "#000080",
        barEnd: flags.barEnd || "#1084d0",
        barText: flags.barText || "#ffffff",
        btnText: flags.btnText || "#000000",
        btnBg: flags.btnBg || "#c0c0c0",
        ...flags
      };
      const endpoint = `${global.bot?.api?.wudysoft}/api/maker/message`;
      const response = await axios.post(endpoint, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        responseType: "arraybuffer",
        timeout: 3e4
      });
      const buffer = response?.data;
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error("Gagal menerima gambar dari API.");
      }
      const captionText = `–  *W I N D O W S  M S G B O X*

┌  ◦  *Title* : ${title}
│  ◦  *Message* : ${text}
└  ◦  *Buttons* : ${String(buttons).split(";").join(" | ")}`;
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(buffer),
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      await ctx.react?.("✅");
    } catch (error) {
      await ctx.react?.("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        try {
          const parsed = JSON.parse(Buffer.from(error.response.data).toString("utf-8"));
          errMsg = parsed.error || parsed.message || errMsg;
        } catch (_) {
          errMsg = error.message;
        }
      }
      ctx.reply(`❌ MsgBox Error: ${errMsg}`);
    }
  }
};