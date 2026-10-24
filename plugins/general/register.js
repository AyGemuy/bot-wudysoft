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

function parseGender(str = "") {
  const g = String(str).toLowerCase().trim();
  if (["laki", "laki-laki", "pria", "cowok", "cowo", "male", "l", "boy"].includes(g)) {
    return "Laki-laki";
  }
  if (["cewek", "cewe", "perempuan", "wanita", "female", "p", "girl"].includes(g)) {
    return "Perempuan";
  }
  return "Tidak Mau Menyebutkan";
}

function parseAge(str = "") {
  const a = String(str).toLowerCase().trim();
  if (["anak", "anak-anak", "bocah", "kid", "child"].includes(a)) {
    return "Anak-anak (13 th)";
  }
  if (["muda", "remaja", "youth", "teen"].includes(a)) {
    return "Muda (20 th)";
  }
  if (["tua", "dewasa", "senior", "adult", "old"].includes(a)) {
    return "Dewasa / Tua (30 th)";
  }
  const num = parseInt(a.replace(/\D/g, ""), 10);
  if (!isNaN(num) && num > 0) {
    if (num < 17) return `Anak-anak (${num} th)`;
    if (num <= 25) return `Muda (${num} th)`;
    return `Dewasa / Tua (${num} th)`;
  }
  return "Muda (20 th)";
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    const aliasMap = {
      name: ["n", "nama"],
      age: ["a", "u", "umur"],
      gender: ["g", "k", "kelamin", "jk"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
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
  name: "register",
  aliases: ["daftar", "reg", "unregister", "unreg", "regulang", "daftaran"],
  description: "Daftar pengguna bot interaktif dengan pilihan Gender, Umur, dan Card Canvas",
  category: "General",
  example: "register\nregister Davi\nregister Davi.20.cowok\nregister Davi.muda.cewek\nunregister [sn]",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = typeof ctx.prefix === "string" ? ctx.prefix : ".";
      const cmd = (ctx.command || ctx.cmd || "register").toLowerCase();
      const user = global.db?.user?.[ctx.sender];
      const botName = global.bot?.name || "Wudysoft";
      const botFooter = global.bot?.footer || `${botName} • Multi-Device`;
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
      const isRegistered = Boolean(user?.registered && user?.name && user.name !== senderNum);
      const isUnregCommand = ["unregister", "unreg"].includes(cmd) || ctx.args?.[0]?.toLowerCase() === "unreg";
      if (isUnregCommand) {
        if (!isRegistered) {
          await ctx.react("❌");
          return ctx.reply(`❌ Akun Anda belum terdaftar di sistem bot. Ketik \`${prefix}register\` untuk memulai pendaftaran.`);
        }
        let inputSn = ctx.args?.[0]?.toLowerCase() === "unreg" ? ctx.args[1] : ctx.args[0];
        inputSn = inputSn ? inputSn.trim().toUpperCase() : "";
        if (!inputSn) {
          await ctx.react("⚠️");
          const bodyUnregConfirm = `Hi ${user.name}!
Apakah Anda yakin ingin membatalkan pendaftaran (Unregister) dari database?

–  *P E R I N G A T A N*

┌  ◦  *Nama* : ${user.name}
│  ◦  *Serial (SN)* : ${user.sn || senderNum}
└  ◦  *Akibat* : Status member akan di-reset dan Anda harus mendaftar ulang.

Tekan tombol konfirmasi di bawah untuk melanjutkan:`;
          const buttonsUnreg = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "🗑️ Konfirmasi Unregister",
              id: `${prefix}unreg ${user.sn || senderNum}`
            })
          }, {
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Salin Serial Key (SN)",
              copy_code: user.sn || senderNum
            })
          }];
          const optionsUnreg = {
            title: `⚠️ ${botName} • Konfirmasi Unregister`,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • Reset Akun`,
                button_title: "Pilihan Tindakan"
              }
            },
            contextInfo: baseContextInfo,
            quoted: quotedMsg
          };
          if (typeof ctx.sendCta === "function") {
            return await ctx.sendCta(bodyUnregConfirm, botFooter, buttonsUnreg, optionsUnreg);
          } else {
            return await ctx.reply(`${bodyUnregConfirm}\n\n_Ketik \`${prefix}unreg ${user.sn}\` untuk mengonfirmasi._`);
          }
        }
        if (inputSn !== String(user.sn || "").toUpperCase() && inputSn !== senderNum) {
          await ctx.react("❌");
          return ctx.reply(`❌ Serial Key (SN) yang Anda masukkan salah!\nKetik \`${prefix}register\` untuk melihat SN akun Anda.`);
        }
        user.registered = false;
        user.name = senderNum;
        delete user.sn;
        delete user.gender;
        delete user.age;
        if (typeof db?.write === "function") {
          await db.write(global.db).catch(() => {});
        }
        await ctx.react("🗑️");
        return ctx.reply(`–  *U N R E G I S T E R  S U K S E S*\n\n` + `┌  ◦  *Status* : Berhasil Direset 🗑️\n` + `│  ◦  *User* : @${senderNum}\n` + `└  ◦  *Info* : Data registrasi Anda telah dihapus dari sistem.\n\n` + `_Ketik \`${prefix}register\` kapan saja jika Anda ingin mendaftar kembali._`, {
          mentions: [ctx.sender],
          quoted: quotedMsg
        });
      }
      if (isRegistered) {
        await ctx.react("⏳");
        const mediaCard = await generateSecurityCard(profilePic);
        const userStatus = user.ownerAcces ? "Owner" : user.premium?.status ? "Premium" : "Free User";
        const userLimit = user.ownerAcces || user.premium?.status ? "Unlimited" : user.limit ?? global.bot?.defaultLimit ?? 20;
        const regDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric"
        }) : "Member Lama";
        const bodyAlready = `Hi ${user.name}!
Akun Anda sudah terverifikasi dan aktif di dalam database sistem.

–  *M E M B E R  I N F O*

┌  ◦  *Nama* : ${user.name}
│  ◦  *Nomor* : @${senderNum}
│  ◦  *Gender* : ${user.gender || "Tidak Disebutkan"}
│  ◦  *Umur* : ${user.age || "Muda"}
│  ◦  *Status* : ${userStatus}
│  ◦  *Limit* : ${userLimit}
│  ◦  *Serial* : ${user.sn || "-"}
└  ◦  *Bergabung* : ${regDate}

Gunakan tombol navigasi di bawah untuk membuka menu atau daftar ulang.`;
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
                title: "👤 Cek Profil RPG",
                description: "Lihat level, exp, dan status petualangan",
                id: `${prefix}profile`
              }, {
                title: "🔄 Daftar Ulang (Unreg)",
                description: "Reset akun jika ingin mengubah nama/gender/umur",
                id: `${prefix}unreg ${user.sn || senderNum}`
              }]
            }]
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🔄 Daftar Ulang",
            id: `${prefix}unreg ${user.sn || senderNum}`
          })
        }, {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📋 Salin Serial Key (SN)",
            copy_code: user.sn || senderNum
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
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyAlready, botFooter, buttonsAlready, optionsAlready);
        } else {
          await sock.sendMessage(ctx.id, {
            image: typeof mediaCard === "string" ? {
              url: mediaCard
            } : mediaCard,
            caption: bodyAlready
          }, {
            quoted: quotedMsg
          });
        }
        return await ctx.react("✅");
      }
      let rawQuery = (ctx.query || ctx.text || "").trim();
      const firstWord = rawQuery.split(/\s+/)[0].toLowerCase();
      if (["register", "daftar", "reg"].some(a => firstWord.endsWith(a))) {
        rawQuery = rawQuery.slice(firstWord.length).trim();
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawQuery);
      if (!cleanPrompt && !flags.name) {
        await ctx.react("📑");
        const helpText = `Hi @${senderNum}!
Selamat datang di sistem pendaftaran anggota *${botName}*.

–  *P A N D U A N  D A F T A R*

┌  ◦  *Cara Praktis* : \`${prefix}register <nama>\`
│     _Bot akan mengirimkan menu untuk memilih Gender & Umur._
└  ◦  *Format Lengkap* : \`${prefix}register <nama>.<umur>.<gender>\`

–  *V A R I A S I  P I L I H A N*

┌  ◦  *Kategori Umur* :
│     • \`anak\` (Anak-anak < 17 tahun)
│     • \`muda\` (Remaja / Dewasa Muda 17-25 th)
│     • \`tua\` (Dewasa / Senior 26+ tahun)
│     • Atau tulis angka langsung (contoh: \`19\`)
│
└  ◦  *Pilihan Gender* :
      • \`cowok\` / \`laki\` (Laki-laki)
      • \`cewek\` / \`perempuan\` (Perempuan)
      • \`rahasia\` (Tidak ingin menyebutkan)

–  *C O N T O H  L A N G S U N G*

┌  ◦  \`${prefix}register Davi\` (Via Menu)
├  ◦  \`${prefix}register Davi.20.cowok\`
├  ◦  \`${prefix}register Davi.muda.cewek\`
└  ◦  \`${prefix}register Davi.tua.rahasia\`

_Silakan ketik perintah di atas untuk mendaftarkan akun Anda._`;
        return ctx.reply(helpText, {
          mentions: [ctx.sender],
          quoted: quotedMsg
        });
      }
      let finalName = "";
      let finalAge = "";
      let finalGender = "";
      const splitParts = cleanPrompt.includes(".") ? cleanPrompt.split(".") : cleanPrompt.includes(",") ? cleanPrompt.split(",") : cleanPrompt.includes("/") ? cleanPrompt.split("/") : [];
      if (splitParts.length >= 2) {
        finalName = splitParts[0].trim();
        finalAge = parseAge(splitParts[1].trim());
        finalGender = splitParts[2] ? parseGender(splitParts[2].trim()) : "Tidak Mau Menyebutkan";
      } else {
        finalName = flags.name || cleanPrompt;
        finalAge = flags.age ? parseAge(flags.age) : "";
        finalGender = flags.gender ? parseGender(flags.gender) : "";
      }
      if (!finalName || finalName.length < 3 || finalName.length > 20) {
        return ctx.reply("❌ Panjang nama minimal 3 dan maksimal 20 karakter.", {
          quoted: quotedMsg
        });
      }
      if (!/^[a-zA-Z0-9_ ]+$/.test(finalName)) {
        return ctx.reply("❌ Nama hanya boleh mengandung huruf, angka, spasi, dan garis bawah (_).", {
          quoted: quotedMsg
        });
      }
      if (!finalAge || !finalGender) {
        await ctx.react("📝");
        const maleRows = [{
          title: "👦 Anak-anak (< 17 th)",
          id: `${prefix}register ${finalName}.anak.laki`,
          description: "Gender: Laki-laki • Kategori: Anak-anak"
        }, {
          title: "🧑 Muda (17 - 25 th)",
          id: `${prefix}register ${finalName}.muda.laki`,
          description: "Gender: Laki-laki • Kategori: Dewasa Muda"
        }, {
          title: "👨 Dewasa / Tua (26+ th)",
          id: `${prefix}register ${finalName}.tua.laki`,
          description: "Gender: Laki-laki • Kategori: Senior / Dewasa"
        }];
        const femaleRows = [{
          title: "👧 Anak-anak (< 17 th)",
          id: `${prefix}register ${finalName}.anak.cewek`,
          description: "Gender: Perempuan • Kategori: Anak-anak"
        }, {
          title: "👩 Muda (17 - 25 th)",
          id: `${prefix}register ${finalName}.muda.cewek`,
          description: "Gender: Perempuan • Kategori: Dewasa Muda"
        }, {
          title: "👵 Dewasa / Tua (26+ th)",
          id: `${prefix}register ${finalName}.tua.cewek`,
          description: "Gender: Perempuan • Kategori: Senior / Dewasa"
        }];
        const secretRows = [{
          title: "🔒 Umur Muda (Rahasia)",
          id: `${prefix}register ${finalName}.muda.rahasia`,
          description: "Gender: Tidak Disebutkan • Kategori: Muda"
        }, {
          title: "🔒 Umur Dewasa (Rahasia)",
          id: `${prefix}register ${finalName}.tua.rahasia`,
          description: "Gender: Tidak Disebutkan • Kategori: Dewasa"
        }, {
          title: "🕶️ Skip Semua (Anonim)",
          id: `${prefix}register ${finalName}.20.rahasia`,
          description: "Gunakan setelan profil default/privat"
        }];
        const sections = [{
          title: "🚹 PROFIL: LAKI-LAKI",
          rows: maleRows
        }, {
          title: "🚺 PROFIL: PEREMPUAN",
          rows: femaleRows
        }, {
          title: "🔒 PRIVAT (TIDAK MAU MENYEBUTKAN)",
          rows: secretRows
        }];
        const promptText = `Hi @${senderNum}!
Nama akun Anda: *${finalName}*

Silakan tentukan *Gender* dan *Kategori Umur* Anda dari menu pilihan di bawah untuk menyelesaikan registrasi.`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🚻 PILIH GENDER & UMUR",
            sections: sections
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⚡ Default (Muda & Rahasia)",
            id: `${prefix}register ${finalName}.muda.rahasia`
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Profile Setup`,
              button_title: "Pilih Gender & Umur"
            }
          },
          contextInfo: baseContextInfo,
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(promptText, botFooter, buttons, options);
        } else {
          return ctx.reply(`${promptText}\n\n` + `Ketik salah satu format di bawah untuk menyelesaikan:\n` + `• \`${prefix}register ${finalName}.muda.cowok\`\n` + `• \`${prefix}register ${finalName}.muda.cewek\`\n` + `• \`${prefix}register ${finalName}.20.rahasia\``, {
            mentions: [ctx.sender],
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("⏳");
      const sn = crypto.createHash("md5").update(ctx.sender + Date.now()).digest("hex").slice(0, 16).toUpperCase();
      if (typeof db?.ensureUser === "function") {
        db.ensureUser(ctx.sender, finalName);
      }
      if (!global.db.user) global.db.user = {};
      if (!global.db.user[ctx.sender]) global.db.user[ctx.sender] = {};
      const defaultLimit = global.bot?.defaultLimit || 20;
      const uDb = global.db.user[ctx.sender];
      uDb.name = finalName;
      uDb.gender = finalGender;
      uDb.age = finalAge;
      uDb.registered = true;
      uDb.createdAt = Date.now();
      uDb.sn = sn;
      uDb.limit = (uDb.limit || 0) + defaultLimit;
      uDb.money = (uDb.money || 0) + 1e3;
      if (typeof db?.write === "function") {
        await db.write(global.db).catch(() => {});
      }
      const mediaCard = await generateSecurityCard(profilePic);
      const bodySuccess = `Hi ${finalName}!
Selamat bergabung, pendaftaran akun Anda berhasil diverifikasi.

–  *M E M B E R  P A S S*

┌  ◦  *Nama* : ${finalName}
│  ◦  *Nomor* : @${senderNum}
│  ◦  *Gender* : ${finalGender}
│  ◦  *Umur* : ${finalAge}
│  ◦  *Status* : Free Member
└  ◦  *Serial (SN)* : ${sn}

–  *S T A R T E R  B O N U S*

┌  ◦  *Limit* : +${defaultLimit}
│  ◦  *Saldo* : +Rp 1.000
│  ◦  *Level* : Lv. 1
└  ◦  *Health* : 100 / 100 HP

Gunakan menu di bawah untuk mulai menjelajahi fitur bot.`;
      const starterActions = [{
        title: "📜 MENU LENGKAP",
        id: `${prefix}menu`,
        description: "Jelajahi semua kategori dan menu perintah bot"
      }, {
        title: "👤 PROFIL SAYA",
        id: `${prefix}profile`,
        description: "Lihat status RPG, saldo, dan limit akun kamu"
      }, {
        title: "🎁 REWARD HARIAN",
        id: `${prefix}daily`,
        description: "Ambil hadiah limit dan bonus harian"
      }, {
        title: "🔄 DAFTAR ULANG (UNREG)",
        id: `${prefix}unreg ${sn}`,
        description: "Reset registrasi jika ingin mengubah profil"
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
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodySuccess, botFooter, buttonsSuccess, optionsSuccess);
      } else {
        await sock.sendMessage(ctx.id, {
          image: typeof mediaCard === "string" ? {
            url: mediaCard
          } : mediaCard,
          caption: bodySuccess
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[REGISTER ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(global.bot?.msg?.error || `❌ Registrasi gagal: ${e.message}`);
    }
  }
};