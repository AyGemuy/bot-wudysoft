import crypto from "crypto";
import axios from "axios";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
async function generateSecurityCard(avatarUrl) {
  const defaultBg = global.bot?.media?.banner1 || global.bot?.media?.banner2 || global.bot?.media?.thumb || "https://files.catbox.moe/8ugr9a.jpg";
  try {
    const payload = {
      avatar: avatarUrl,
      background: defaultBg,
      borderColor: "f0f0f0",
      locale: "en",
      overlayOpacity: .9,
      userTime: 6048e5,
      suspectTime: 6048e5
    };
    const response = await axios.post(`${global.bot?.api?.wudysoft}/api/canvas/canvafy/security?t=${Date.now()}`, payload, {
      responseType: "arraybuffer",
      timeout: 15e3,
      headers: {
        "Content-Type": "application/json"
      }
    });
    return Buffer.from(response.data);
  } catch (err) {
    console.warn("[CANVAFY SECURITY ERROR, using Fallback]:", err.message);
    return defaultBg;
  }
}
export default {
  name: "register",
  aliases: ["daftar", "reg"],
  description: "Daftar sebagai pengguna bot via Interactive Membership Card & CTA Sheet",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const user = global.db?.user?.[ctx.sender];
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || "Wudysoft • Multi-Device";
      const channelUrl = global.bot?.link || "https://whatsapp.com/channel/0029VaF5pWj59PwcGj4F4v2w";
      const senderNum = ctx.sender.split("@")[0];
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let profilePic = global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
      try {
        profilePic = await sock.profilePictureUrl(ctx.sender, "image");
      } catch {}
      const baseContextInfo = {
        mentionedJid: [ctx.sender],
        ...global.bot?.utils?.contextInfo || {
          forwardingScore: 999,
          isForwarded: true
        }
      };
      if (user?.name && user.name !== senderNum && user.registered) {
        await ctx.react("⏳");
        const mediaCard = await generateSecurityCard(profilePic);
        const userStatus = user.ownerAcces ? "Owner" : user.premium?.status ? "Premium" : "Free User";
        const userLimit = user.ownerAcces || user.premium?.status ? "Unlimited" : user.limit ?? global.bot?.defaultLimit ?? 20;
        const regDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric"
        }) : "Lama";
        const bodyAlready = `Hi ${user.name}!
Akun Anda sudah terverifikasi dan aktif di dalam database sistem.

–  *M E M B E R*

┌  ◦  *Name* : ${user.name}
│  ◦  *Number* : @${senderNum}
│  ◦  *Status* : ${userStatus}
│  ◦  *Limit* : ${userLimit}
│  ◦  *Serial* : ${user.sn || "-"}
└  ◦  *Joined* : ${regDate}

Gunakan tombol di bawah untuk membuka menu navigasi akun.`;
        const footerAlready = `${botFooter}`;
        const buttonsAlready = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⚡ NAVIGASI AKUN",
            sections: [{
              title: `${botName} • SHORTCUT MENU`,
              rows: [{
                title: "🏠 Menu Utama",
                description: "Buka menu dan daftar semua kategori bot",
                id: `${prefix}menu`
              }, {
                title: "📜 Semua Fitur",
                description: "Buka seluruh katalog perintah bot",
                id: `${prefix}allmenu`
              }, {
                title: "👤 Cek Profil",
                description: "Lihat status RPG, saldo, dan atribut kamu",
                id: `${prefix}profile`
              }, {
                title: "🎁 Klaim Daily Reward",
                description: "Ambil hadiah limit dan EXP harian",
                id: `${prefix}daily`
              }]
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏠 Menu Utama",
            id: `${prefix}menu`
          })
        }, {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Serial Key (SN)",
            copy_code: user.sn || ctx.sender
          })
        }];
        const optionsAlready = {
          image: mediaCard,
          title: `✦ ${botName} • Membership Card ✦`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Status Member`,
              button_title: "Navigasi Akun"
            },
            limited_time_offer: {
              text: `👑 MEMBER RESMI ${botName.toUpperCase()} AKTIF 24/7! 👑`,
              url: channelUrl,
              copy_code: `${prefix}daily`,
              expiration_time: Date.now() + 24 * 3600 * 1e3
            }
          },
          contextInfo: baseContextInfo,
          quoted: quotedMsg
        };
        await ctx.sendCta(bodyAlready, footerAlready, buttonsAlready, optionsAlready);
        return await ctx.react("✅");
      }
      const name = ctx.query?.trim();
      if (!name) {
        return ctx.reply(`Hi @${senderNum}!
Silakan tentukan nama kamu untuk mendaftar ke sistem bot.

–  *R E G I S T E R*

┌  ◦  *Format* : ${prefix}register <nama>
└  ◦  *Example* : ${prefix}register ${botName}`, {
          mentions: [ctx.sender],
          quoted: quotedMsg
        });
      }
      if (name.length < 3 || name.length > 20) {
        return ctx.reply("❌ Panjang nama minimal 3 dan maksimal 20 karakter.", {
          quoted: quotedMsg
        });
      }
      if (!/^[a-zA-Z0-9_ ]+$/.test(name)) {
        return ctx.reply("❌ Nama hanya boleh mengandung huruf, angka, spasi, dan garis bawah (_).", {
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const sn = crypto.createHash("md5").update(ctx.sender + Date.now()).digest("hex").slice(0, 16).toUpperCase();
      if (typeof db?.ensureUser === "function") {
        db.ensureUser(ctx.sender, name);
      }
      if (!global.db.user[ctx.sender]) {
        global.db.user[ctx.sender] = {};
      }
      const defaultLimit = global.bot?.defaultLimit || 20;
      global.db.user[ctx.sender].name = name;
      global.db.user[ctx.sender].registered = true;
      global.db.user[ctx.sender].createdAt = Date.now();
      global.db.user[ctx.sender].sn = sn;
      global.db.user[ctx.sender].limit = (global.db.user[ctx.sender].limit || 0) + defaultLimit;
      global.db.user[ctx.sender].money = (global.db.user[ctx.sender].money || 0) + 1e3;
      if (typeof db?.write === "function") {
        await db.write(global.db).catch(() => {});
      }
      const mediaCard = await generateSecurityCard(profilePic);
      const bodySuccess = `Hi ${name}!
Selamat bergabung, pendaftaran akun Anda berhasil disimpan ke database.

–  *M E M B E R*

┌  ◦  *Name* : ${name}
│  ◦  *Number* : @${senderNum}
│  ◦  *Status* : Free User
└  ◦  *Serial* : ${sn}

–  *B O N U S*

┌  ◦  *Limit* : +${defaultLimit}
│  ◦  *Balance* : +Rp 1.000
│  ◦  *Level* : Lv. 1
└  ◦  *Health* : 100 / 100 HP

Gunakan menu di bawah untuk mulai menjelajahi fitur.`;
      const footerSuccess = `${botFooter}`;
      const starterActions = [{
        title: "📜 MENU LENGKAP",
        id: `${prefix}menu`,
        description: "Jelajahi semua kategori dan menu perintah bot"
      }, {
        title: "📂 SEMUA KATALOG",
        id: `${prefix}allmenu`,
        description: "Buka seluruh daftar fitur secara komprehensif"
      }, {
        title: "👤 PROFIL SAYA",
        id: `${prefix}profile`,
        description: "Lihat status RPG, saldo, dan limit akun kamu"
      }, {
        title: "🎁 REWARD HARIAN",
        id: `${prefix}daily`,
        description: "Ambil hadiah limit dan bonus harian"
      }];
      const buttonsSuccess = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🚀 LANGKAH AWAL",
          sections: [{
            title: `${botName} • MULAI PETUALANGAN`,
            rows: starterActions
          }]
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🏠 Menu Utama",
          id: `${prefix}menu`
        })
      }, {
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin Serial Key (SN)",
          copy_code: sn
        })
      }];
      const optionsSuccess = {
        image: mediaCard,
        title: `✦ ${botName} • Registration Pass ✦`,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Registrasi Sukses`,
            button_title: "Mulai Sekarang"
          },
          limited_time_offer: {
            text: `🎁 KLAIM BONUS ANGGOTA BARU +${defaultLimit} LIMIT & 1.000 KOIN! 🎁`,
            url: channelUrl,
            copy_code: sn,
            expiration_time: Date.now() + 48 * 3600 * 1e3
          }
        },
        contextInfo: baseContextInfo,
        quoted: quotedMsg
      };
      await ctx.sendCta(bodySuccess, footerSuccess, buttonsSuccess, optionsSuccess);
      await ctx.react("✅");
    } catch (e) {
      console.error("[REGISTER ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(global.bot?.msg?.error || `❌ Registrasi gagal: ${e.message}`);
    }
  }
};