import fs from "fs";
import path from "path";
import db from "../../data/db.js";
import {
  runtime
} from "../../core/tools.js";
import {
  startJadiBot,
  deleteJadiBot,
  getJadiBotsList,
  cleanJadibotSession
} from "../../core/jadibot.js";
global.jadibotTimers = global.jadibotTimers || new Map();

function initDB(jid = null, name = "") {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.jadibot) global.db.jadibot = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      name: name || "",
      money: 1e4,
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}
async function clearJadibotSession(sock, targetKey, autoDelete = true) {
  initDB();
  if (global.jadibotTimers.has(targetKey)) {
    const timer = global.jadibotTimers.get(targetKey);
    clearTimeout(timer);
    global.jadibotTimers.delete(targetKey);
  }
  const session = global.db.jadibot[targetKey];
  if (!session) return;
  if (autoDelete && session.msgKey && sock) {
    try {
      await sock.sendMessage(session.chatId || `${targetKey}@s.whatsapp.net`, {
        delete: session.msgKey
      });
    } catch (_) {}
  }
  delete global.db.jadibot[targetKey];
  saveDB();
}

function formatDate(timestamp) {
  if (!timestamp) return "Tidak diketahui";
  return new Date(timestamp).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "medium"
  }) + " WIB";
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
export default {
  name: "jadibot",
  aliases: ["subbot", "listjadibot", "deljadibot", "stopjadibot", "infojadibot", "cleanbot"],
  description: "Manajemen Jadibot Full DB Interactive via CTA Single List",
  category: "Tools",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      initDB();
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const senderNum = sender?.split("@")[0]?.replace(/\D/g, "");
      if (!senderNum || !global.db.jadibot[senderNum]) return false;
      const session = global.db.jadibot[senderNum];
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const userText = (ctx?.text || ctx?.body || msg?.message?.conversation || "").trim().toLowerCase();
      const isQuoting = quotedStanzaId && session.msgKey?.id === quotedStanzaId;
      if ((isQuoting || session.chatId === ctx.chat) && ["batal", "cancel", "stop", "exit"].includes(userText)) {
        await clearJadibotSession(sock, senderNum, true);
        await deleteJadiBot(senderNum);
        if (typeof ctx?.react === "function") await ctx.react("🛑");
        await ctx.reply(`–  *C A N C E L L E D*\n\nSesi penautan Jadibot untuk @${senderNum} berhasil dibatalkan dan pesan pairing telah dibersihkan.`, {
          mentions: [`${senderNum}@s.whatsapp.net`]
        });
        return true;
      }
      return false;
    } catch (e) {
      console.error("[JADIBOT BEFORE ERROR]:", e);
      return false;
    }
  },
  execute: async (sock, ctx, msg, opt = {}) => {
    initDB();
    const args = opt.args || ctx.args || [];
    const command = (opt.command || ctx.command || "jadibot").toLowerCase();
    const isOwner = Boolean(opt.isOwner ?? ctx.isOwner ?? false);
    const subCmd = (args[0] || "").toLowerCase();
    const prefix = ctx.prefix || ".";
    const myNum = (ctx.senderNumber || ctx.sender || "").split("@")[0].replace(/\D/g, "");
    let targetNum = myNum;
    if (ctx.quoted?.sender) {
      targetNum = ctx.quoted.sender.split("@")[0].replace(/\D/g, "");
    } else if (ctx.mentionedJid && ctx.mentionedJid.length > 0) {
      targetNum = ctx.mentionedJid[0].split("@")[0].replace(/\D/g, "");
    } else if (args[1] && args[1].replace(/\D/g, "").length >= 7) {
      targetNum = args[1].replace(/\D/g, "");
    } else if (subCmd && subCmd.replace(/\D/g, "").length >= 7) {
      targetNum = subCmd.replace(/\D/g, "");
    }
    if (targetNum.startsWith("0")) {
      targetNum = "62" + targetNum.slice(1);
    }
    const targetPrivateJid = `${targetNum}@s.whatsapp.net`;
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Jadibot Manager`;
    if (["clean", "cleansession", "cs"].includes(subCmd) || command === "cleanbot") {
      let cleanTarget = targetNum;
      if (!isOwner && cleanTarget !== myNum) {
        cleanTarget = myNum;
      }
      const sessionPath = path.join(process.cwd(), "session_jadibot", cleanTarget);
      if (!fs.existsSync(sessionPath)) {
        return ctx.reply(`❌ Folder session untuk sub-bot *@${cleanTarget}* tidak ditemukan.`, {
          mentions: [`${cleanTarget}@s.whatsapp.net`]
        });
      }
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const keepFiles = ["creds.json", "app-state-sync-version-", "pre-key-", "session-", "sender-key-", "app-state-sync-key-", "lid-mapping-"];
      let deleted = 0;
      let corrupted = 0;
      let freedBytes = 0;
      const files = fs.readdirSync(sessionPath);
      for (const file of files) {
        const filePath = path.join(sessionPath, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.size === 0) {
            fs.unlinkSync(filePath);
            deleted++;
            corrupted++;
            continue;
          }
          const shouldKeep = keepFiles.some(p => p.endsWith("-") ? file.startsWith(p) : file === p);
          if (!shouldKeep) {
            const hoursOld = (Date.now() - stats.mtimeMs) / (1e3 * 60 * 60);
            if (hoursOld > 24) {
              freedBytes += stats.size;
              fs.unlinkSync(filePath);
              deleted++;
            }
          }
        } catch (_) {}
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
      const cleanText = `–  *C L E A N  J A D I B O T*\n\nPembersihan sesi sub-bot *@${cleanTarget}* selesai.\n\n┌  ◦  *Total File* : ${files.length}\n│  ◦  *File Dihapus* : ${deleted} file\n│  ◦  *File Corrupt* : ${corrupted} file\n│  ◦  *Memori Bebas* : ${formatSize(freedBytes)}\n└  ◦  *Status* : Optimal & Tetap Terhubung ✅`;
      return await ctx.reply(cleanText, {
        mentions: [`${cleanTarget}@s.whatsapp.net`]
      });
    }
    if (command === "listjadibot" || subCmd === "list") {
      const list = getJadiBotsList();
      if (!list.length) {
        const emptyText = `Hi @${myNum}!\n–  *J A D I B O T*\n\nSaat ini belum ada sub-bot yang terdaftar atau online.\n\n┌  ◦  *Total* : 0 Sub-Bot\n└  ◦  *Action* : Tautkan nomor Anda via menu di bawah`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔘 MENU JADIBOT",
            sections: [{
              title: "Mulai Penautan",
              rows: [{
                title: "🔑 Buat via Pairing Code",
                description: "Tautkan via kode 8 digit instan",
                id: `${prefix}jadibot pair`
              }, {
                title: "📷 Buat via QR Code",
                description: "Tautkan via scanner QR Code kamera",
                id: `${prefix}jadibot qr`
              }, {
                title: "🏠 Menu Utama Jadibot",
                description: "Kembali ke dashboard utama",
                id: `${prefix}jadibot`
              }]
            }]
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: "Menu Jadibot",
              button_title: "Mulai Penautan"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            mentionedJid: [`${myNum}@s.whatsapp.net`]
          },
          quoted: msg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(emptyText, botFooter, buttons, options);
        }
        return await ctx.reply(emptyText, {
          mentions: [`${myNum}@s.whatsapp.net`]
        });
      }
      const botListText = list.map((b, i) => {
        const isLast = i === list.length - 1;
        const branch = isLast ? "└" : "│";
        const status = b.status === "ONLINE" ? "Online" : "Offline";
        const uptime = b.uptime ? runtime(b.uptime / 1e3) : "Tidak Aktif";
        return `${branch}  ◦  *${i + 1}.* @${b.number} [${status}] (${uptime})`;
      }).join("\n");
      const bodyText = `Hi @${myNum}!\nBerikut adalah daftar sub-bot yang terdaftar dan beroperasi.\n\n–  *J A D I B O T*\n\n┌  ◦  *Total* : ${list.length} Sub-Bots\n└  ◦  *Action* : Pilih bot dari menu di bawah untuk melihat rincian\n\n–  *A C T I V E  B O T S*\n\n${botListText}`;
      const botRows = list.map(b => ({
        title: `+${b.number} [${b.status}]`.slice(0, 24),
        description: `Lihat status & rincian bot ini`.slice(0, 72),
        id: `${prefix}infojadibot ${b.number}`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📋 PILIH SUB-BOT",
          sections: [{
            title: "Daftar Nomor Jadibot",
            rows: botRows
          }, {
            title: "Navigasi Lainnya",
            rows: [{
              title: "➕ Tautkan Sub-Bot Baru",
              description: "Mulai sesi penautan Jadibot baru",
              id: `${prefix}jadibot pair`
            }, {
              title: "🏠 Dashboard Utama",
              description: "Kembali ke menu beranda Jadibot",
              id: `${prefix}jadibot`
            }]
          }]
        })
      }];
      const allMentions = [`${myNum}@s.whatsapp.net`, ...list.map(b => `${b.number}@s.whatsapp.net`)];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Pilih Sub-Bot",
            button_title: "Daftar Jadibot"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          mentionedJid: allMentions
        },
        quoted: msg
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, botFooter, buttons, options);
      }
      return await ctx.reply(bodyText, {
        mentions: allMentions
      });
    }
    if (command === "infojadibot" || subCmd === "info") {
      const list = getJadiBotsList();
      const botData = list.find(b => b.number === targetNum);
      if (!botData) {
        return ctx.reply(`❌ Jadibot dengan nomor *@${targetNum}* tidak ditemukan di dalam sistem database.`, {
          mentions: [targetPrivateJid]
        });
      }
      const isOnline = botData.status === "ONLINE";
      const statusBadge = isOnline ? "Online (Active)" : "Offline (Disconnected)";
      const uptimeStr = botData.uptime ? runtime(botData.uptime / 1e3) : "Tidak Aktif";
      const joinTime = formatDate(botData.connectedAt);
      const platformStr = botData.platform || "WhatsApp Web (Baileys)";
      const speedStr = isOnline ? `${botData.speed || 120}ms` : "-";
      const sessionPath = `session_jadibot/${botData.number}`;
      const bodyText = `–  *J A D I B O T  I N F O*\n\n┌  ◦  *Number* : @${botData.number}\n│  ◦  *Status* : ${statusBadge}\n│  ◦  *Uptime* : ${uptimeStr}\n│  ◦  *Connected* : ${joinTime}\n│  ◦  *Platform* : ${platformStr}\n│  ◦  *Speed* : ${speedStr}\n└  ◦  *Session* : ${sessionPath}\n\nGunakan menu di bawah untuk mengelola sub-bot ini.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "⚙️ PENGATURAN SUB-BOT",
          sections: [{
            title: `Tindakan (+${botData.number})`,
            rows: [{
              title: "🧹 Bersihkan Sesi Bot",
              description: "Bersihkan file sampah tanpa logout",
              id: `${prefix}jadibot clean ${botData.number}`
            }, {
              title: "🛑 Hentikan & Hapus Sesi",
              description: `Matikan dan bersihkan sesi +${botData.number}`,
              id: `${prefix}deljadibot ${botData.number}`
            }, {
              title: "📋 Kembali ke Daftar Sub-Bot",
              description: "Lihat list semua Jadibot yang terdaftar",
              id: `${prefix}listjadibot`
            }]
          }, {
            title: "Navigasi Lainnya",
            rows: [{
              title: "➕ Buat Sesi Jadibot Baru",
              description: "Tautkan nomor lain sebagai sub-bot",
              id: `${prefix}jadibot pair`
            }, {
              title: "🏠 Menu Utama Jadibot",
              description: "Kembali ke dashboard utama",
              id: `${prefix}jadibot`
            }]
          }]
        })
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Opsi Sub-Bot",
            button_title: "Kelola Sub-Bot"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          mentionedJid: [targetPrivateJid, `${myNum}@s.whatsapp.net`]
        },
        quoted: msg
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, botFooter, buttons, options);
      }
      return await ctx.reply(bodyText, {
        mentions: [targetPrivateJid, `${myNum}@s.whatsapp.net`]
      });
    }
    if (command === "deljadibot" || command === "stopjadibot" || subCmd === "delete" || subCmd === "stop") {
      if (!isOwner && targetNum !== myNum) {
        targetNum = myNum;
      }
      await clearJadibotSession(sock, targetNum, true);
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const success = await deleteJadiBot(targetNum);
      if (typeof ctx.react === "function") await ctx.react(success ? "✅" : "❌");
      if (success) {
        const bodyText = `–  *J A D I B O T*\n\nSesi sub-bot untuk nomor *@${targetNum}* telah diputus dan dibersihkan dari server.`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔘 MENU NAVIGASI",
            sections: [{
              title: "Aksi Selanjutnya",
              rows: [{
                title: "➕ Sambungkan Ulang",
                description: "Buat sesi Jadibot baru via pairing",
                id: `${prefix}jadibot pair ${targetNum}`
              }, {
                title: "📋 Cek Daftar Sub-Bot",
                description: "Lihat daftar bot yang masih aktif",
                id: `${prefix}listjadibot`
              }, {
                title: "🏠 Menu Utama Jadibot",
                description: "Kembali ke menu beranda",
                id: `${prefix}jadibot`
              }]
            }]
          })
        }];
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: "Navigasi Jadibot",
              button_title: "Pilih Tindakan"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            mentionedJid: [targetPrivateJid, `${myNum}@s.whatsapp.net`]
          },
          quoted: msg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        }
        return await ctx.reply(bodyText, {
          mentions: [targetPrivateJid, `${myNum}@s.whatsapp.net`]
        });
      } else {
        return ctx.reply(`❌ Gagal menghapus sesi atau nomor *@${targetNum}* tidak ditemukan.`, {
          mentions: [targetPrivateJid]
        });
      }
    }
    if (subCmd === "qr") {
      await clearJadibotSession(sock, targetNum, true);
      if (ctx.isGroup) {
        await ctx.reply(`📩 QR Code Jadibot untuk @${targetNum} dikirimkan ke chat pribadi demi privasi dan keamanan akun.`, {
          mentions: [targetPrivateJid]
        });
      } else {
        await ctx.reply(`⏳ Menyiapkan QR Code Jadibot untuk @${targetNum}, mohon tunggu sebentar...`, {
          mentions: [targetPrivateJid]
        });
      }
      return await startJadiBot(sock, targetPrivateJid, {
        mode: "qr",
        onQR: async (qrBuffer, attempt, max) => {
          await clearJadibotSession(sock, targetNum, true);
          const caption = `–  *Q R  C O D E*\n\nArahkan kamera WhatsApp ke QR Code di atas.\n\n┌  ◦  *Target* : @${targetNum}\n│  ◦  *Attempt* : ${attempt} / ${max}\n│  ◦  *Expiry* : 30 Detik (Auto-Delete)\n└  ◦  *Cancel* : Balas pesan ini dengan kata "batal"\n\nBuka WhatsApp > Perangkat Tertaut > Tautkan Perangkat.`;
          const sentMsg = await sock.sendMessage(targetPrivateJid, {
            image: qrBuffer,
            caption: caption,
            mentions: [targetPrivateJid]
          });
          if (sentMsg?.key) {
            initDB();
            global.db.jadibot[targetNum] = {
              chatId: targetPrivateJid,
              msgKey: sentMsg.key,
              mode: "qr",
              updatedAt: Date.now()
            };
            saveDB();
            const timer = setTimeout(async () => {
              if (global.db.jadibot[targetNum]) {
                const s = global.db.jadibot[targetNum];
                delete global.db.jadibot[targetNum];
                saveDB();
                if (attempt >= max) {
                  await deleteJadiBot(targetNum);
                }
                try {
                  await sock.sendMessage(targetPrivateJid, {
                    delete: s.msgKey
                  });
                } catch (_) {}
              }
              global.jadibotTimers.delete(targetNum);
            }, 30 * 1e3);
            global.jadibotTimers.set(targetNum, timer);
          }
        }
      });
    }
    if (subCmd === "pair" || subCmd === "code" || !subCmd && !command.includes("jadibot")) {
      await clearJadibotSession(sock, targetNum, true);
      if (ctx.isGroup) {
        await ctx.reply(`📩 Kode pairing Jadibot untuk @${targetNum} telah dikirimkan ke chat pribadinya.`, {
          mentions: [targetPrivateJid]
        });
      } else {
        await ctx.reply(`⏳ Sedang meminta kode pairing untuk @${targetNum} dari server WhatsApp...`, {
          mentions: [targetPrivateJid]
        });
      }
      return await startJadiBot(sock, targetPrivateJid, {
        mode: "pair",
        onPairingCode: async (pairingCode, attempt, max) => {
          await clearJadibotSession(sock, targetNum, true);
          const codeFormatted = pairingCode?.match(/.{1,4}/g)?.join("-") || pairingCode;
          const bodyText = `–  *P A I R I N G  C O D E*\n\nKode penautan perangkat berhasil dibuat.\n\n┌  ◦  *Target* : @${targetNum}\n│  ◦  *Code* : ${codeFormatted}\n│  ◦  *Attempt* : ${attempt} / ${max}\n│  ◦  *Expiry* : 2 Menit (Auto-Delete)\n└  ◦  *Cancel* : Balas pesan ini dengan kata "batal"\n\nBuka Perangkat Tertaut > Tautkan dengan nomor telepon > Masukkan kode.`;
          const buttons = [{
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Salin Kode Pairing",
              copy_code: codeFormatted
            })
          }, {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🔘 OPSI PENAUTAN",
              sections: [{
                title: "Opsi Tambahan",
                rows: [{
                  title: "🛑 Batalkan Penautan",
                  description: "Hapus sesi dan batalkan proses pairing",
                  id: `${prefix}deljadibot ${targetNum}`
                }, {
                  title: "📷 Ganti ke Mode QR Code",
                  description: "Tautkan perangkat dengan scan QR Code",
                  id: `${prefix}jadibot qr ${targetNum}`
                }, {
                  title: "📋 Lihat Daftar Sub-Bot",
                  description: "Cek bot yang sedang aktif",
                  id: `${prefix}listjadibot`
                }]
              }]
            })
          }];
          const options = {
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                list_title: "Opsi Penautan",
                button_title: "Menu Tambahan"
              }
            },
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              mentionedJid: [targetPrivateJid]
            },
            quoted: msg
          };
          let sentMsg = null;
          if (typeof ctx.sendCta === "function") {
            sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, options);
          } else {
            sentMsg = await sock.sendMessage(targetPrivateJid, {
              text: bodyText,
              mentions: [targetPrivateJid]
            });
          }
          if (sentMsg?.key) {
            initDB();
            global.db.jadibot[targetNum] = {
              chatId: targetPrivateJid,
              msgKey: sentMsg.key,
              mode: "pair",
              code: codeFormatted,
              updatedAt: Date.now()
            };
            saveDB();
            const timer = setTimeout(async () => {
              if (global.db.jadibot[targetNum]) {
                const s = global.db.jadibot[targetNum];
                delete global.db.jadibot[targetNum];
                saveDB();
                if (attempt >= max) {
                  await deleteJadiBot(targetNum);
                }
                try {
                  await sock.sendMessage(targetPrivateJid, {
                    delete: s.msgKey
                  });
                } catch (_) {}
              }
              global.jadibotTimers.delete(targetNum);
            }, 120 * 1e3);
            global.jadibotTimers.set(targetNum, timer);
          }
        }
      });
    }
    const list = getJadiBotsList();
    const myBot = list.find(b => b.number === myNum);
    const myBotStatus = myBot ? `Active (+${myBot.number})` : "Inactive";
    const bodyText = `Hi @${myNum}!\nSelamat datang di Jadibot Control Center.\n\n–  *C O N T R O L  H U B*\n\n┌  ◦  *User* : @${myNum}\n│  ◦  *Status Bot Anda* : ${myBotStatus}\n│  ◦  *Total Bots* : ${list.length} Sub-Bots\n└  ◦  *Engine* : Cloned Instance (Multi-Device)\n\n_Tips: Anda bisa tag/reply user lain untuk membuatkan sesi Jadibot (contoh: ${prefix}jadibot pair @user)._`;
    const menuRows = [{
      title: "🔑 Tautkan via Pairing Code",
      description: "Dapatkan 8 digit kode pairing instan (Rekomendasi)",
      id: `${prefix}jadibot pair`
    }, {
      title: "📷 Tautkan via QR Code",
      description: "Tautkan via scanner QR Code kamera",
      id: `${prefix}jadibot qr`
    }, {
      title: "📋 Daftar Seluruh Sub-Bot",
      description: "Lihat status & rincian semua sub-bot aktif",
      id: `${prefix}listjadibot`
    }];
    if (myBot) {
      menuRows.unshift({
        title: "ℹ️ Rincian Sub-Bot Saya",
        description: `Lihat statistik & uptime bot kamu (+${myNum})`,
        id: `${prefix}infojadibot ${myNum}`
      }, {
        title: "🧹 Bersihkan Sesi Bot Saya",
        description: "Hapus file sampah tanpa logout",
        id: `${prefix}jadibot clean ${myNum}`
      });
      menuRows.push({
        title: "🛑 Hentikan Bot Saya",
        description: "Hapus sesi Jadibot dari nomor kamu",
        id: `${prefix}deljadibot ${myNum}`
      });
    }
    const buttons = [{
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "🔘 MENU UTAMA JADIBOT",
        sections: [{
          title: "Navigasi & Fitur Jadibot",
          rows: menuRows
        }]
      })
    }];
    const options = {
      params: {
        bottom_sheet: {
          in_thread_buttons_limit: 2,
          list_title: "Menu Utama Jadibot",
          button_title: "Buka Opsi Menu"
        }
      },
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        mentionedJid: [`${myNum}@s.whatsapp.net`]
      },
      quoted: msg
    };
    if (typeof ctx.sendCta === "function") {
      return await ctx.sendCta(bodyText, botFooter, buttons, options);
    }
    return await ctx.reply(bodyText, {
      mentions: [`${myNum}@s.whatsapp.net`]
    });
  }
};