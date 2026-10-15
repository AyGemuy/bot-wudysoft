import db from "../../data/db.js";
import {
  runtime
} from "../../core/tools.js";
import {
  startJadiBot,
  deleteJadiBot,
  getJadiBotsList
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
export default {
  name: "jadibot",
  aliases: ["subbot", "listjadibot", "deljadibot", "stopjadibot", "infojadibot"],
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
        await ctx.reply(`–  *C A N C E L L E D*

Sesi penautan Jadibot berhasil dibatalkan dan pesan pairing telah dibersihkan.`);
        return true;
      }
      return false;
    } catch (e) {
      console.error("[JADIBOT BEFORE ERROR]:", e);
      return false;
    }
  },
  execute: async (sock, ctx, msg, {
    args,
    command,
    isOwner
  }) => {
    initDB();
    const subCmd = (args[0] || "").toLowerCase();
    const prefix = ctx.prefix || ".";
    const senderNum = (ctx.senderNumber || ctx.sender || "").split("@")[0].replace(/\D/g, "");
    const targetPrivateJid = `${senderNum}@s.whatsapp.net`;
    const botName = global.bot?.name || "WudysoftBot";
    const botFooter = global.bot?.footer || `${botName} • Jadibot Manager`;
    const userName = ctx.pushname || senderNum;
    if (command === "listjadibot" || subCmd === "list") {
      const list = getJadiBotsList();
      if (!list.length) {
        const emptyText = `–  *J A D I B O T*

Saat ini belum ada sub-bot yang terdaftar atau online.

┌  ◦  *Total* : 0 Sub-Bot
└  ◦  *Action* : Tautkan nomor Anda via menu di bawah`;
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
            isForwarded: true
          },
          quoted: msg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(emptyText, botFooter, buttons, options);
        }
        return await ctx.reply(emptyText);
      }
      const botListText = list.map((b, i) => {
        const isLast = i === list.length - 1;
        const branch = isLast ? "└" : "│";
        const status = b.status === "ONLINE" ? "Online" : "Offline";
        const uptime = b.uptime ? runtime(b.uptime / 1e3) : "Tidak Aktif";
        return `${branch}  ◦  *${i + 1}.* +${b.number} [${status}] (${uptime})`;
      }).join("\n");
      const bodyText = `Hi ${userName}!
Berikut adalah daftar sub-bot yang terdaftar dan beroperasi.

–  *J A D I B O T*

┌  ◦  *Total* : ${list.length} Sub-Bots
└  ◦  *Action* : Pilih bot dari menu di bawah untuk melihat rincian

–  *A C T I V E  B O T S*

${botListText}`;
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
          isForwarded: true
        },
        quoted: msg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, botFooter, buttons, options);
      }
      return await ctx.reply(bodyText);
    }
    if (command === "infojadibot" || subCmd === "info") {
      let targetNum = (args[1] || args[0] || senderNum).replace(/\D/g, "");
      const list = getJadiBotsList();
      const botData = list.find(b => b.number === targetNum);
      if (!botData) {
        return ctx.reply(`❌ Jadibot dengan nomor *+${targetNum}* tidak ditemukan di dalam sistem database.`);
      }
      const isOnline = botData.status === "ONLINE";
      const statusBadge = isOnline ? "Online (Active)" : "Offline (Disconnected)";
      const uptimeStr = botData.uptime ? runtime(botData.uptime / 1e3) : "Tidak Aktif";
      const joinTime = formatDate(botData.connectedAt);
      const platformStr = botData.platform || "WhatsApp Web (Baileys)";
      const speedStr = isOnline ? `${botData.speed || 120}ms` : "-";
      const sessionPath = `session_jadibot/${botData.number}`;
      const bodyText = `–  *J A D I B O T  I N F O*

┌  ◦  *Number* : +${botData.number}
│  ◦  *Status* : ${statusBadge}
│  ◦  *Uptime* : ${uptimeStr}
│  ◦  *Connected* : ${joinTime}
│  ◦  *Platform* : ${platformStr}
│  ◦  *Speed* : ${speedStr}
└  ◦  *Session* : ${sessionPath}

Gunakan menu di bawah untuk mengelola sub-bot ini.`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "⚙️ PENGATURAN SUB-BOT",
          sections: [{
            title: `Tindakan (+${botData.number})`,
            rows: [{
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
          isForwarded: true
        },
        quoted: msg
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, botFooter, buttons, options);
      }
      return await ctx.reply(bodyText);
    }
    if (command === "deljadibot" || command === "stopjadibot" || subCmd === "delete" || subCmd === "stop") {
      let targetNum = args[1] || args[0];
      if (targetNum === "delete" || targetNum === "stop") targetNum = args[1];
      if (!targetNum || !isOwner && targetNum !== senderNum) {
        targetNum = senderNum;
      }
      targetNum = targetNum.replace(/\D/g, "");
      await clearJadibotSession(sock, targetNum, true);
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const success = await deleteJadiBot(targetNum);
      if (typeof ctx.react === "function") await ctx.react(success ? "✅" : "❌");
      if (success) {
        const bodyText = `–  *J A D I B O T*

Sesi sub-bot untuk nomor *+${targetNum}* telah diputus dan dibersihkan dari server.`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔘 MENU NAVIGASI",
            sections: [{
              title: "Aksi Selanjutnya",
              rows: [{
                title: "➕ Sambungkan Ulang",
                description: "Buat sesi Jadibot baru via pairing",
                id: `${prefix}jadibot pair`
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
            isForwarded: true
          },
          quoted: msg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, botFooter, buttons, options);
        }
        return await ctx.reply(bodyText);
      } else {
        return ctx.reply(`❌ Gagal menghapus sesi atau nomor *+${targetNum}* tidak ditemukan.`);
      }
    }
    if (subCmd === "qr") {
      await clearJadibotSession(sock, senderNum, true);
      if (ctx.isGroup) {
        await ctx.reply("📩 QR Code dikirimkan ke chat pribadi demi privasi dan keamanan akun.", {
          mentions: [targetPrivateJid]
        });
      } else {
        await ctx.reply("⏳ Menyiapkan QR Code Jadibot, mohon tunggu sebentar...");
      }
      return await startJadiBot(sock, targetPrivateJid, {
        mode: "qr",
        onQR: async (qrBuffer, attempt, max) => {
          await clearJadibotSession(sock, senderNum, true);
          const caption = `–  *Q R  C O D E*

Arahkan kamera WhatsApp ke QR Code di atas.

┌  ◦  *Attempt* : ${attempt} / ${max}
│  ◦  *Expiry* : 30 Detik (Auto-Delete)
└  ◦  *Cancel* : Balas pesan ini dengan kata "batal"

Buka WhatsApp > Perangkat Tertaut > Tautkan Perangkat.`;
          const sentMsg = await sock.sendMessage(targetPrivateJid, {
            image: qrBuffer,
            caption: caption
          });
          if (sentMsg?.key) {
            initDB();
            global.db.jadibot[senderNum] = {
              chatId: targetPrivateJid,
              msgKey: sentMsg.key,
              mode: "qr",
              updatedAt: Date.now()
            };
            saveDB();
            const timer = setTimeout(async () => {
              if (global.db.jadibot[senderNum]) {
                const s = global.db.jadibot[senderNum];
                delete global.db.jadibot[senderNum];
                saveDB();
                if (attempt >= max) {
                  await deleteJadiBot(senderNum);
                }
                try {
                  await sock.sendMessage(targetPrivateJid, {
                    delete: s.msgKey
                  });
                } catch (_) {}
              }
              global.jadibotTimers.delete(senderNum);
            }, 30 * 1e3);
            global.jadibotTimers.set(senderNum, timer);
          }
        }
      });
    }
    if (subCmd === "pair" || subCmd === "code" || !subCmd && !command.includes("jadibot")) {
      await clearJadibotSession(sock, senderNum, true);
      if (ctx.isGroup) {
        await ctx.reply("📩 Kode pairing dikirimkan ke chat pribadi demi keamanan akun.", {
          mentions: [targetPrivateJid]
        });
      } else {
        await ctx.reply("⏳ Sedang meminta kode pairing dari server WhatsApp...");
      }
      return await startJadiBot(sock, targetPrivateJid, {
        mode: "pair",
        onPairingCode: async (pairingCode, attempt, max) => {
          await clearJadibotSession(sock, senderNum, true);
          const codeFormatted = pairingCode?.match(/.{1,4}/g)?.join("-") || pairingCode;
          const bodyText = `–  *P A I R I N G  C O D E*

Kode penautan perangkat berhasil dibuat.

┌  ◦  *Code* : ${codeFormatted}
│  ◦  *Attempt* : ${attempt} / ${max}
│  ◦  *Expiry* : 2 Menit (Auto-Delete)
└  ◦  *Cancel* : Balas pesan ini dengan kata "batal"

Buka Perangkat Tertaut > Tautkan dengan nomor telepon > Masukkan kode.`;
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
                  id: `${prefix}deljadibot ${senderNum}`
                }, {
                  title: "📷 Ganti ke Mode QR Code",
                  description: "Tautkan perangkat dengan scan QR Code",
                  id: `${prefix}jadibot qr`
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
              isForwarded: true
            },
            quoted: msg
          };
          let sentMsg = null;
          if (typeof ctx.sendCta === "function") {
            sentMsg = await ctx.sendCta(bodyText, botFooter, buttons, options);
          } else {
            sentMsg = await sock.sendMessage(targetPrivateJid, {
              text: bodyText
            });
          }
          if (sentMsg?.key) {
            initDB();
            global.db.jadibot[senderNum] = {
              chatId: targetPrivateJid,
              msgKey: sentMsg.key,
              mode: "pair",
              code: codeFormatted,
              updatedAt: Date.now()
            };
            saveDB();
            const timer = setTimeout(async () => {
              if (global.db.jadibot[senderNum]) {
                const s = global.db.jadibot[senderNum];
                delete global.db.jadibot[senderNum];
                saveDB();
                if (attempt >= max) {
                  await deleteJadiBot(senderNum);
                }
                try {
                  await sock.sendMessage(targetPrivateJid, {
                    delete: s.msgKey
                  });
                } catch (_) {}
              }
              global.jadibotTimers.delete(senderNum);
            }, 120 * 1e3);
            global.jadibotTimers.set(senderNum, timer);
          }
        }
      });
    }
    const list = getJadiBotsList();
    const myBot = list.find(b => b.number === senderNum);
    const myBotStatus = myBot ? `Active (+${myBot.number})` : "Inactive";
    const bodyText = `Hi @${senderNum}!
Selamat datang di Jadibot Control Center.

–  *C O N T R O L  H U B*

┌  ◦  *Number* : +${senderNum}
│  ◦  *Status* : ${myBotStatus}
│  ◦  *Total Bots* : ${list.length} Sub-Bots
└  ◦  *Engine* : Cloned Instance (Multi-Device)

Pilih opsi navigasi di bawah untuk mulai mengelola Jadibot.`;
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
        description: `Lihat statistik & uptime bot kamu (+${senderNum})`,
        id: `${prefix}infojadibot ${senderNum}`
      });
      menuRows.push({
        title: "🛑 Hentikan Bot Saya",
        description: "Hapus sesi Jadibot dari nomor kamu",
        id: `${prefix}deljadibot ${senderNum}`
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
        isForwarded: true
      },
      quoted: msg
    };
    if (typeof ctx.sendCta === "function") {
      return await ctx.sendCta(bodyText, botFooter, buttons, options);
    }
    return await ctx.reply(bodyText);
  }
};