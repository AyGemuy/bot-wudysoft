import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "setprofile",
  aliases: ["setbotname", "setbio", "setppbot", "delppbot"],
  description: "Ubah Nama, Bio/Status, Foto Profil, atau Hapus Foto Profil Bot",
  category: "Owner",
  owner: true,
  example: ".setbotname Bot Baru | .setbio Available 24/7 | .setppbot (reply foto)",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const cmd = ctx.command?.toLowerCase();
    const text = (ctx.query || ctx.args?.join(" ") || "").trim();
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (cmd === "setbotname") {
        if (!text) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *S E T  N A M E*

Silakan masukkan nama baru untuk bot.

┌  ◦  *Format* : ${prefix}setbotname <nama>
└  ◦  *Example* : ${prefix}setbotname Paimon Bot v2`);
        }
        await sock.updateProfileName(text);
        if (typeof ctx.react === "function") await ctx.react("✅");
        return ctx.reply(`–  *S E T  N A M E*

┌  ◦  *Status* : Sukses
└  ◦  *Nama Baru* : ${text}

Nama tampilan bot telah berhasil diperbarui.`, {
          quoted: quotedMsg
        });
      }
      if (cmd === "setbio") {
        if (!text) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *S E T  B I O*

Silakan masukkan teks bio/status baru untuk bot.

┌  ◦  *Format* : ${prefix}setbio <teks>
└  ◦  *Example* : ${prefix}setbio Available 24/7 • Fast Response`);
        }
        await sock.updateProfileStatus(text);
        if (typeof ctx.react === "function") await ctx.react("✅");
        return ctx.reply(`–  *S E T  B I O*

┌  ◦  *Status* : Sukses
└  ◦  *Bio Baru* : ${text}

Status/tentang bot telah berhasil diperbarui.`, {
          quoted: quotedMsg
        });
      }
      if (cmd === "setppbot") {
        const target = ctx.quoted || ctx;
        if (!target.isMedia && !/image/i.test(target.mimetype || "")) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`–  *S E T  P P  B O T*

Silakan balas (reply) gambar atau kirim gambar dengan caption perintah.

┌  ◦  *Format* : ${prefix}setppbot (reply gambar)
└  ◦  *Tipe Media* : Image/Foto`);
        }
        const buffer = await target.download();
        if (!buffer) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh berkas media gambar.");
        }
        const botJid = sock.user?.id ? sock.user.id.includes(":") ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : sock.user.id : sock.user?.jid;
        await sock.updateProfilePicture(botJid, buffer);
        if (typeof ctx.react === "function") await ctx.react("✅");
        return ctx.reply(`–  *S E T  P P  B O T*

┌  ◦  *Status* : Sukses
└  ◦  *Aksi* : Update Foto Profil

Foto profil bot telah berhasil diperbarui.`, {
          quoted: quotedMsg
        });
      }
      if (cmd === "delppbot") {
        const botJid = sock.user?.id ? sock.user.id.includes(":") ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : sock.user.id : sock.user?.jid;
        await sock.removeProfilePicture(botJid);
        if (typeof ctx.react === "function") await ctx.react("✅");
        return ctx.reply(`–  *D E L  P P  B O T*

┌  ◦  *Status* : Sukses
└  ◦  *Aksi* : Hapus Foto Profil

Foto profil bot telah berhasil dihapus.`, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
      return ctx.reply(`–  *S E T  P R O F I L E*

Silakan pilih opsi pengaturan profil bot yang ingin Anda gunakan:

┌  ◦  *Ganti Nama* : \`${prefix}setbotname <nama>\`
│  ◦  *Ganti Bio* : \`${prefix}setbio <teks>\`
│  ◦  *Ganti Foto* : \`${prefix}setppbot\` (reply foto)
└  ◦  *Hapus Foto* : \`${prefix}delppbot\``, {
        quoted: quotedMsg
      });
    } catch (e) {
      console.error("[SETPROFILE ERROR]", e);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Gagal memperbarui profil bot: ${e.message}`);
    }
  }
};