import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "fakeytcomment",
  aliases: ["fakeyt", "ytcomment", "ytc"],
  description: "Membuat gambar fake komentar YouTube",
  category: "Maker",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      const comment = (ctx.args?.join(" ") || ctx.query || ctx.quoted?.text || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!comment) {
        return ctx.reply(`–  *F A K E  Y O U T U B E  C O M M E N T*

Silakan masukkan teks komentar yang ingin dibuat.

┌  ◦  *Format* : \`${prefix}fakeytcomment <teks komentar>\`
└  ◦  *Contoh* : \`${prefix}fakeytcomment Kontennya bagus banget bang!\``);
      }
      ctx.react?.("⏳");
      const senderJid = ctx.sender || msg.key?.participant || msg.key?.remoteJid;
      let avatarUrl = "https://i.ibb.co/m5xGqMD/avatar-default.png";
      try {
        if (senderJid && typeof sock.profilePictureUrl === "function") {
          avatarUrl = await sock.profilePictureUrl(senderJid, "image");
        }
      } catch {}
      const username = ctx.pushname || ctx.name || "User";
      const response = await axios.get("https://some-random-api.com/canvas/misc/youtube-comment", {
        params: {
          avatar: avatarUrl,
          username: username,
          comment: comment
        },
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!response.data) {
        throw new Error("Gagal menerima hasil gambar komentar YouTube.");
      }
      const captionText = `–  *F A K E  Y O U T U B E  C O M M E N T*

┌  ◦  *User* : ${username}
└  ◦  *Komentar* : "${comment}"`;
      await sock.sendMessage(ctx.id, {
        image: Buffer.from(response.data),
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      ctx.react?.("✅");
    } catch (error) {
      ctx.react?.("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Fake YT Comment Error: ${errMsg}`);
    }
  }
};