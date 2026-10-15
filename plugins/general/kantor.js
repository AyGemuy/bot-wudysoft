import db from "../../data/db.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import {
  badwordList
} from "../../lib/badword.js";
const CAREER_LADDER = {
  intern: {
    id: "intern",
    title: "Anak Magang (Intern)",
    salary: 120,
    minKpiToPromote: 65,
    nextRole: "staff",
    canGiveSp: false
  },
  staff: {
    id: "staff",
    title: "Staff Karyawan Tetap",
    salary: 280,
    minKpiToPromote: 80,
    nextRole: "spv",
    canGiveSp: false
  },
  spv: {
    id: "spv",
    title: "Supervisor Divisi",
    salary: 550,
    minKpiToPromote: 92,
    nextRole: "manager",
    canGiveSp: true
  },
  manager: {
    id: "manager",
    title: "Manajer Operasional",
    salary: 1100,
    minKpiToPromote: 98,
    nextRole: "ceo",
    canGiveSp: true
  },
  ceo: {
    id: "ceo",
    title: "Direktur Utama (CEO)",
    salary: 2200,
    minKpiToPromote: null,
    nextRole: null,
    canGiveSp: true
  }
};
const validBadwords = Array.isArray(badwordList) ? badwordList : [];

function initDB(jid = null) {
  if (!global.db) global.db = {};
  if (!global.db.user) global.db.user = {};
  if (!global.db.employees) global.db.employees = {};
  if (jid && !global.db.user[jid]) {
    global.db.user[jid] = {
      exp: 0
    };
  }
}

function saveDB() {
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
}

function checkIsBadword(text) {
  if (!text || validBadwords.length === 0) return false;
  const lower = text.toLowerCase();
  return validBadwords.some(bad => new RegExp(`\\b${bad}\\b`, "i").test(lower));
}

function addExp(jid, amount) {
  if (!jid) return;
  initDB(jid);
  const cur = global.db.user[jid].exp || 0;
  global.db.user[jid].exp = Math.max(0, cur + amount);
  saveDB();
}

function getKpiBar(score) {
  const safe = Math.max(0, Math.min(100, score));
  const filled = Math.round(safe / 100 * 8);
  const empty = 8 - filled;
  const bar = "🟦".repeat(filled) + "⬜".repeat(Math.max(0, empty));
  return `${bar} ${safe}/100`;
}
export default {
  name: "kantor",
  aliases: ["kerja", "clockin", "clockout", "lembur", "gajian", "sp", "lamar", "promosi", "gosip", "projek", "cuti", "profilkerja", "pecat"],
  description: "Simulasi Kehidupan Korporat: Meniti karir, jam kerja kantor, kejar KPI, dan hindari surat peringatan SP! (Full DB & Interactive CTA)",
  category: "Fun & RPG",
  group: true,
  before: async (msg, {
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      const senderJid = ctx?.sender || msg?.key?.participant;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (!chatId?.endsWith("@g.us") || !senderJid || isFromMe) return;
      initDB(senderJid);
      const emp = global.db.employees[senderJid];
      if (!emp) return;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (!text) return;
      if (emp.status === "WORKING" || emp.status === "LEMBUR") {
        if (checkIsBadword(text)) {
          emp.kpi = Math.max(0, emp.kpi - 4);
          saveDB();
          if (typeof ctx?.react === "function") await ctx.react("📑");
        } else {
          if (Math.random() < .35 && emp.kpi < 100) {
            emp.kpi = Math.min(100, emp.kpi + 1);
            saveDB();
          }
        }
      }
    } catch (err) {
      console.error("[Kantor Before Error]:", err.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      const senderNum = senderJid.split("@")[0];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const botFooter = global.bot?.footer || `${botName} • Corporate Office`;
      const userName = ctx.pushname || senderNum;
      const command = (ctx.command || "").toLowerCase();
      const mentioned = ctx.mentionedJid || [];
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      initDB(senderJid);
      const sendInteractive = async (body, footer, buttons, extra = {}) => {
        const baseContextInfo = {
          mentionedJid: extra.mentions || [],
          ...global.bot?.utils?.contextInfo || {
            forwardingScore: 999,
            isForwarded: true
          }
        };
        const options = {
          title: extra.title || `✦ ${botName} • Corporate Office ✦`,
          subtitle: extra.subtitle || "PT Grup WhatsApp Tbk",
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              divider_indices: [1],
              list_title: `${botName} • Meja Kantor`,
              button_title: extra.buttonTitle || "Aksi Karyawan"
            }
          },
          contextInfo: baseContextInfo,
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(body, footer, buttons, options);
        } else {
          return await sock.sendMessage(chatId, {
            text: `${body}\n\n_${footer}_`,
            mentions: extra.mentions || []
          }, {
            quoted: quotedMsg
          });
        }
      };
      if (command === "lamar") {
        if (global.db.employees[senderJid]) {
          const cur = global.db.employees[senderJid];
          const role = CAREER_LADDER[cur.roleId] || CAREER_LADDER.intern;
          return ctx.reply(`–  *E M P L O Y M E N T*

Anda sudah memiliki pekerjaan di perusahaan ini.

┌  ◦  *Position* : ${role.title}
│  ◦  *Status* : ${cur.status}
└  ◦  *Action* : Ketik ${prefix}profilkerja untuk memeriksa rapor kerja.`);
        }
        const employeeName = ctx.args?.join(" ") || userName;
        global.db.employees[senderJid] = {
          name: employeeName,
          roleId: "intern",
          kpi: 70,
          status: "OFFLINE",
          clockIn: 0,
          spLevel: 0,
          lastGajian: Date.now() - 24 * 60 * 60 * 1e3,
          completedProjects: 0,
          leaveQuota: 3
        };
        saveDB();
        const body = `Hi ${userName}!
Surat Perjanjian Kerja (PKWT) berhasil ditandatangani.

–  *E M P L O Y M E N T*

┌  ◦  *Name* : ${employeeName}
│  ◦  *Position* : ${CAREER_LADDER.intern.title}
│  ◦  *Basic Salary* : 120 EXP / hari
│  ◦  *KPI Score* : 70 / 100
└  ◦  *Leave Quota* : 3 Hari

Ketik *${prefix}clockin* untuk memulai shift kerja hari ini.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⏰ Clock-In (Masuk)",
            id: `${prefix}clockin`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💼 Rapor Karyawan",
            id: `${prefix}profilkerja`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: "✦ Penerimaan Karyawan ✦"
        });
      }
      if (!global.db.employees[senderJid] && command !== "kantor") {
        return ctx.reply(`–  *C O R P O R A T I O N*

Anda belum terdaftar sebagai karyawan perusahaan.

┌  ◦  *Status* : Pengangguran
└  ◦  *Apply* : ${prefix}lamar [Nama Lengkap]`);
      }
      const emp = global.db.employees[senderJid];
      const currentRole = emp ? CAREER_LADDER[emp.roleId] || CAREER_LADDER.intern : null;
      if (command === "kantor" || command === "kerja") {
        const totalStaff = Object.keys(global.db.employees).length;
        let onlineCount = 0;
        for (const [_, data] of Object.entries(global.db.employees)) {
          if (data.status === "WORKING" || data.status === "LEMBUR") onlineCount++;
        }
        const body = `Hi ${userName}!
Selamat datang di kantor pusat korporat PT Grup WhatsApp Tbk.

–  *C O R P O R A T I O N*

┌  ◦  *Company* : PT Grup WhatsApp Tbk
│  ◦  *Employees* : ${totalStaff} Pegawai
│  ◦  *On-Duty* : ${onlineCount} Aktif
│  ◦  *Status* : ${emp ? `${emp.status} (${currentRole.title})` : "Belum Bekerja"}
└  ◦  *KPI* : ${emp ? `${emp.kpi}/100` : "-"}

Pilih aktivitas kerja atau kelola karir Anda melalui menu di bawah.`;
        const sections = [{
          title: "⏰ AKTIVITAS SHIFT KERJA",
          rows: [{
            title: "⏰ Clock-In (Masuk Kerja)",
            id: `${prefix}clockin`,
            description: "Mulai jam kerja aktif harian & kumpulkan KPI"
          }, {
            title: "🚪 Clock-Out (Pulang Kerja)",
            id: `${prefix}clockout`,
            description: "Akhiri shift kerja & ambil uang transport"
          }, {
            title: "☕ Kerja Lembur Malam",
            id: `${prefix}lembur`,
            description: "Overtime malam demi uang saku lembur & boost KPI"
          }]
        }, {
          title: "💼 KEUANGAN & KARIR",
          rows: [{
            title: "💵 Klaim Gaji Harian",
            id: `${prefix}gajian`,
            description: "Ambil slip gaji harian sesuai grade jabatan & KPI"
          }, {
            title: "💼 Rapor & Profil Karyawan",
            id: `${prefix}profilkerja`,
            description: "Cek catatan sanksi SP, KPI bar, dan sisa cuti"
          }, {
            title: "📈 Ajukan Promosi Jabatan",
            id: `${prefix}promosi`,
            description: "Naik pangkat jika KPI memenuhi standar divisi"
          }]
        }, {
          title: "🏖️ REHAT & FASILITAS KANTOR",
          rows: [{
            title: "☕ Nongkrong di Pantri (Gosip)",
            id: `${prefix}gosip`,
            description: "Rehat sejenak mendengar drama kantor & cemilan"
          }, {
            title: "🏖️ Ambil Cuti Tahunan",
            id: `${prefix}cuti`,
            description: "Libur santai untuk menyegarkan pikiran (+10 KPI)"
          }]
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 MENU MEJA KERJA",
            sections: sections
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: emp?.status === "WORKING" ? "🚪 Clock-Out" : "⏰ Clock-In",
            id: emp?.status === "WORKING" ? `${prefix}clockout` : `${prefix}clockin`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          title: `✦ Kantor Utama • PT WhatsApp ✦`,
          buttonTitle: "Buka Meja Kerja"
        });
      }
      if (command === "clockin" || command === "absen") {
        if (emp.status === "WORKING") {
          return ctx.reply("⚠️ Anda sedang dalam jam kerja aktif. Ketik *.clockout* jika shift sudah selesai.");
        }
        if (emp.status === "LEMBUR") {
          return ctx.reply("⚠️ Anda masih berada dalam sesi lembur malam.");
        }
        emp.status = "WORKING";
        emp.clockIn = Date.now();
        saveDB();
        const body = `Hi ${userName}!
Absensi masuk kerja berhasil dicatat sistem.

–  *C L O C K - I N*

┌  ◦  *Employee* : @${senderNum}
│  ◦  *Position* : ${currentRole.title}
└  ◦  *Status* : Active (On-Duty)

Ketik pesan di grup secara sopan untuk menaikkan skor KPI kerjamu.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Clock-Out Pulang",
            id: `${prefix}clockout`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "☕ Rehat ke Pantri",
            id: `${prefix}gosip`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Clock-In Berhasil ✦`
        });
      }
      if (command === "clockout" || command === "pulang") {
        if (emp.status === "OFFLINE") {
          return ctx.reply("❌ Anda belum melakukan absen masuk hari ini.");
        }
        const workedMinutes = Math.floor((Date.now() - (emp.clockIn || Date.now())) / 6e4);
        emp.status = "OFFLINE";
        emp.clockIn = 0;
        saveDB();
        let bonusExp = Math.min(60, workedMinutes * 2);
        addExp(senderJid, bonusExp);
        const body = `Hi ${userName}!
Shift kerja hari ini telah selesai.

–  *C L O C K - O U T*

┌  ◦  *Employee* : @${senderNum}
│  ◦  *Duration* : ${workedMinutes} Menit
└  ◦  *Transport* : +${bonusExp} EXP

Selamat beristirahat dari penatnya dunia korporat.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💵 Klaim Gaji",
            id: `${prefix}gajian`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💼 Rapor Kerja",
            id: `${prefix}profilkerja`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Clock-Out Berhasil ✦`
        });
      }
      if (command === "lembur") {
        if (emp.status === "LEMBUR") {
          return ctx.reply("⚠️ Anda sudah berada di meja kerja lembur.");
        }
        emp.status = "LEMBUR";
        emp.kpi = Math.min(100, emp.kpi + 3);
        saveDB();
        const lemburBonus = Math.floor(currentRole.salary * .4);
        addExp(senderJid, lemburBonus);
        const body = `Hi ${userName}!
Sesi kerja lembur malam telah dimulai.

–  *O V E R T I M E*

┌  ◦  *Employee* : @${senderNum}
│  ◦  *KPI Bonus* : +3 Poin
└  ◦  *Allowance* : +${lemburBonus} EXP

Jangan lupa istirahat secukupnya setelah menyelesaikan tugas.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🚪 Selesai Lembur",
            id: `${prefix}clockout`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💼 Cek Profil Kerja",
            id: `${prefix}profilkerja`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Shift Lembur ✦`
        });
      }
      if (command === "gajian") {
        const now = Date.now();
        const COOLDOWN_GAJI = 20 * 60 * 60 * 1e3;
        const timeDiff = now - (emp.lastGajian || 0);
        if (timeDiff < COOLDOWN_GAJI) {
          const sisaJam = Math.ceil((COOLDOWN_GAJI - timeDiff) / (60 * 60 * 1e3));
          return ctx.reply(`–  *P A Y R O L L*

Jadwal pencairan gaji belum tiba.

┌  ◦  *Remaining* : ${sisaJam} Jam
└  ◦  *Status* : Processing`);
        }
        let deduction = 0;
        if (emp.spLevel === 1) deduction = Math.round(currentRole.salary * .15);
        if (emp.spLevel === 2) deduction = Math.round(currentRole.salary * .35);
        const performanceBonus = Math.round(emp.kpi / 100 * 50);
        const netSalary = Math.max(20, currentRole.salary - deduction + performanceBonus);
        addExp(senderJid, netSalary);
        emp.lastGajian = now;
        saveDB();
        const body = `Hi ${userName}!
Slip gaji harian Anda berhasil dicairkan.

–  *P A Y R O L L*

┌  ◦  *Employee* : @${senderNum}
│  ◦  *Position* : ${currentRole.title}
│  ◦  *Basic Salary* : +${currentRole.salary} EXP
│  ◦  *KPI Bonus* : +${performanceBonus} EXP
${deduction > 0 ? `│  ◦  *Penalty (SP ${emp.spLevel})* : -${deduction} EXP\n` : ""}└  ◦  *Total Net Salary* : +${netSalary} EXP

Gaji telah ditransfer langsung ke saldo rekening EXP Anda.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💼 Rapor Karyawan",
            id: `${prefix}profilkerja`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📈 Ajukan Promosi",
            id: `${prefix}promosi`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Transfer Gaji Masuk ✦`
        });
      }
      if (command === "gosip") {
        const events = [{
          text: "Mendengar kabar bahwa ada bonus akhir tahun dari direksi. Mood kerja membaik (+5 KPI).",
          kpiDelta: 5,
          expDelta: 15
        }, {
          text: "Mengambil gorengan kawan di kulkas pantri tanpa izin (+30 EXP).",
          kpiDelta: 0,
          expDelta: 30
        }, {
          text: "Sedang menggunjing atasan, tiba-tiba manajer lewat di belakangmu (-8 KPI).",
          kpiDelta: -8,
          expDelta: 0
        }, {
          text: "Kopi sachet pantri tumpah ke dokumen laporan penting (-5 KPI).",
          kpiDelta: -5,
          expDelta: -20
        }];
        const chosen = events[Math.floor(Math.random() * events.length)];
        emp.kpi = Math.max(0, Math.min(100, emp.kpi + chosen.kpiDelta));
        saveDB();
        if (chosen.expDelta !== 0) addExp(senderJid, chosen.expDelta);
        const body = `–  *P A N T R Y*

Kejadian rehat di pojok pantri kantor:

┌  ◦  *Event* : ${chosen.text}
│  ◦  *KPI Impact* : ${chosen.kpiDelta >= 0 ? `+${chosen.kpiDelta}` : chosen.kpiDelta} Poin
└  ◦  *EXP Reward* : ${chosen.expDelta >= 0 ? `+${chosen.expDelta}` : chosen.expDelta} EXP`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💼 Rapor KPI",
            id: `${prefix}profilkerja`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏢 Meja Kantor",
            id: `${prefix}kantor`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Rehat Pantri Kantor ✦`
        });
      }
      if (command === "cuti") {
        if ((emp.leaveQuota || 0) <= 0) {
          return ctx.reply("❌ Jatah cuti tahunan Anda telah habis (0 Hari tersisa).");
        }
        emp.leaveQuota -= 1;
        emp.status = "CUTI";
        emp.kpi = Math.min(100, (emp.kpi || 70) + 10);
        saveDB();
        const body = `Hi ${userName}!
Permohonan cuti tahunan telah disetujui HRD.

–  *L E A V E*

┌  ◦  *Employee* : @${senderNum}
│  ◦  *Status* : On-Leave (Liburan)
│  ◦  *KPI Recovery* : +10 Poin
└  ◦  *Remaining* : ${emp.leaveQuota} Hari

Ketik *${prefix}clockin* saat ingin kembali bekerja.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "⏰ Masuk Kerja",
            id: `${prefix}clockin`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💼 Rapor Profil",
            id: `${prefix}profilkerja`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Cuti Tahunan Resmi ✦`
        });
      }
      if (command === "promosi") {
        if (!currentRole.nextRole) {
          return ctx.reply("👑 Anda sudah berada di posisi puncak karir sebagai Direktur Utama (CEO).");
        }
        if (emp.spLevel > 0) {
          return ctx.reply(`❌ Promosi ditolak. Anda masih memiliki catatan sanksi *SP-${emp.spLevel}*.`);
        }
        if (emp.kpi < currentRole.minKpiToPromote) {
          return ctx.reply(`–  *P R O M O T I O N*

Skor KPI belum memenuhi persyaratan standar divisi.

┌  ◦  *Required* : ${currentRole.minKpiToPromote} / 100 KPI
└  ◦  *Your KPI* : ${emp.kpi} / 100 KPI`);
        }
        const nextRoleData = CAREER_LADDER[currentRole.nextRole];
        emp.roleId = nextRoleData.id;
        emp.kpi = 75;
        saveDB();
        const body = `Hi ${userName}!
Surat keputusan promosi jabatan resmi diterbitkan dewan direksi.

–  *P R O M O T I O N*

┌  ◦  *Employee* : @${senderNum}
│  ◦  *New Role* : ${nextRoleData.title}
│  ◦  *New Salary* : ${nextRoleData.salary} EXP / hari
└  ◦  *Authority* : ${nextRoleData.canGiveSp ? "Berhak memberikan sanksi SP ke bawahan" : "Tanggung jawab kerja meningkat"}

Selamat atas pencapaian karir cemerlang Anda!`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💼 Rapor Baru",
            id: `${prefix}profilkerja`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🏢 Meja Kantor",
            id: `${prefix}kantor`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Promosi Jabatan Resmi ✦`
        });
      }
      if (command === "sp") {
        if (!currentRole.canGiveSp) {
          return ctx.reply(`❌ Jabatan Anda (${currentRole.title}) belum memiliki wewenang memberikan sanksi SP kepada bawahan.`);
        }
        const target = mentioned[0];
        if (!target) {
          return ctx.reply(`–  *W A R N I N G*

Tag bawahan yang ingin Anda beri surat peringatan.

┌  ◦  *Format* : ${prefix}sp @user <alasan>
└  ◦  *Example* : ${prefix}sp @user Sering bolos rapat`);
        }
        if (target === senderJid) {
          return ctx.reply("❌ Anda tidak bisa melayangkan SP ke diri Anda sendiri.");
        }
        initDB(target);
        if (!global.db.employees[target]) {
          return ctx.reply("❌ Orang tersebut belum terdaftar sebagai karyawan perusahaan.");
        }
        const targetEmp = global.db.employees[target];
        const reason = ctx.args?.slice(1).join(" ") || "Melanggar tata tertib dan disiplin kantor";
        targetEmp.spLevel = (targetEmp.spLevel || 0) + 1;
        targetEmp.kpi = Math.max(0, (targetEmp.kpi || 0) - 20);
        if (targetEmp.spLevel >= 3) {
          delete global.db.employees[target];
          saveDB();
          const phkText = `–  *T E R M I N A T I O N*

Surat Pemutusan Hubungan Kerja (PHK) resmi dikeluarkan.

┌  ◦  *Employee* : @${target.split("@")[0]}
│  ◦  *Issued By* : @${senderNum}
└  ◦  *Reason* : ${reason} (Akumulasi SP-3)

Status kepegawaian resmi dicabut dari PT Grup WhatsApp Tbk.`;
          return await sock.sendMessage(chatId, {
            text: phkText,
            mentions: [target, senderJid]
          });
        }
        saveDB();
        const body = `–  *W A R N I N G*

Surat Peringatan (SP-${targetEmp.spLevel}) resmi diterbitkan.

┌  ◦  *Supervisor* : @${senderNum} (${currentRole.title})
│  ◦  *Employee* : @${target.split("@")[0]}
│  ◦  *Level* : SP ke-${targetEmp.spLevel} / 3
│  ◦  *Reason* : ${reason}
└  ◦  *Penalty* : -20 KPI & Pemotongan Gaji Harian

Peringatan: SP-3 berarti pemecatan langsung dari perusahaan.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "💼 Rapor Pegawai",
            id: `${prefix}profilkerja`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid, target],
          title: `✦ Surat Peringatan Disiplin ✦`
        });
      }
      if (command === "profilkerja") {
        const body = `Hi ${userName}!
Berikut adalah data kepegawaian dan rapor kinerja kerja Anda.

–  *E M P L O Y E E*

┌  ◦  *Name* : ${emp.name}
│  ◦  *Position* : ${currentRole.title}
│  ◦  *Status* : ${emp.status}
│  ◦  *Salary* : ${currentRole.salary} EXP / hari
│  ◦  *KPI* : ${getKpiBar(emp.kpi)}
│  ◦  *Warning* : ${emp.spLevel === 0 ? "Bersih (0 SP)" : `SP-${emp.spLevel}`}
└  ◦  *Leave* : ${emp.leaveQuota} Hari

Pertahankan skor KPI di atas 80 untuk bonus performa dan promosi karir.`;
        const buttons = [{
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "📈 Ajukan Promosi",
            id: `${prefix}promosi`
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "☕ Ke Pantri",
            id: `${prefix}gosip`
          })
        }];
        return await sendInteractive(body, botFooter, buttons, {
          mentions: [senderJid],
          title: `✦ Rapor Kinerja Karyawan ✦`
        });
      }
    } catch (err) {
      console.error("[Kantor System Error]:", err);
      ctx.reply(`❌ Terjadi kendala sistem kepegawaian: ${err.message}`);
    }
  }
};