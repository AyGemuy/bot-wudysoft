import fs from "fs";
import path from "path";
import chalk from "chalk";
import {
  createClient
} from "@libsql/client";
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "database.json");
let turso = null;
let isTableReady = false;
let writeTimeout = null;
let retryTimeout = null;
const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 1500,
  isRetrying: false,
  pendingData: null
};

function safeStringify(obj, indent = 2) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (typeof value === "function" || typeof value === "symbol") {
      return undefined;
    }
    if (value === null || typeof value !== "object") {
      return value;
    }
    if (value instanceof Map) {
      return Object.fromEntries(value.entries());
    }
    if (value instanceof Set) {
      return Array.from(value.values());
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }
    if (Buffer.isBuffer(value)) {
      if (value.length > 64 * 1024) {
        return `[Buffer: ${value.length} bytes omitted]`;
      }
      return value.toJSON();
    }
    const constructorName = value.constructor?.name;
    if (constructorName === "Timeout" || constructorName === "Immediate" || constructorName === "Timer" || constructorName === "TimersList" || constructorName === "Socket" || constructorName === "TLSSocket" || constructorName === "EventEmitter" || constructorName === "ClientRequest" || constructorName === "IncomingMessage" || constructorName === "Agent" || key === "timer" && typeof value.unref === "function" || typeof value.then === "function" || typeof value.pipe === "function") {
      return undefined;
    }
    if (seen.has(value)) {
      return undefined;
    }
    seen.add(value);
    return value;
  }, indent);
}

function getTursoClient() {
  if (turso) return turso;
  const config = global.bot?.turso;
  if (!config || !config.url || !config.token) {
    return null;
  }
  try {
    turso = createClient({
      url: config.url,
      authToken: config.token
    });
    return turso;
  } catch (err) {
    console.error(chalk.red("[ TURSO CLIENT ERROR ]"), err.message);
    turso = null;
    return null;
  }
}
async function initTursoTable(client) {
  if (!client || isTableReady) return;
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS bot_db (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    isTableReady = true;
  } catch (err) {
    console.error(chalk.red("[ TURSO TABLE INIT ERROR ]"), err.message);
  }
}

function writeToLocalFile(serialized) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {
        recursive: true
      });
    }
    fs.writeFileSync(DB_PATH, serialized, "utf-8");
    return true;
  } catch (fsErr) {
    console.error(chalk.red("[ LOCAL WRITE ERROR ]:"), fsErr.message);
    return false;
  }
}

function readFromLocalFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {
        recursive: true
      });
    }
    if (!fs.existsSync(DB_PATH)) {
      const initialData = {
        user: {},
        group: {},
        cmd: {},
        stats: {},
        totalHits: 0
      };
      writeToLocalFile(safeStringify(initialData, 2));
      return initialData;
    }
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    if (!raw || raw.trim() === "") {
      return {
        user: {},
        group: {},
        cmd: {},
        stats: {},
        totalHits: 0
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    console.error(chalk.red("[ LOCAL READ ERROR ]:"), e.message);
    return {
      user: {},
      group: {},
      cmd: {},
      stats: {},
      totalHits: 0
    };
  }
}
const DEFAULT_USER = (name = "User") => ({
  name: name,
  ownerAcces: false,
  registered: false,
  registeredAt: null,
  banned: false,
  banReason: "",
  premium: {
    status: false,
    expiredAt: null
  },
  limit: global.bot?.defaultLimit || 20,
  hits: 0,
  level: 1,
  exp: 0,
  hp: 100,
  hpMax: 100,
  mana: 50,
  manaMax: 50,
  atk: 10,
  def: 5,
  money: 1e5,
  mcoin: 0,
  equipped: {
    weapon: null,
    armor: null
  },
  inventory: {
    ores: {
      coal: 0,
      stone: 0,
      iron: 0,
      gold: 0,
      diamond: 0,
      platinum: 0
    },
    nature: {
      wood: 0,
      leather: 0,
      spice: 0,
      water_jug: 0,
      bait: 0
    },
    fruit: {
      strawberry: 0,
      banana: 0,
      grape: 0,
      apple: 0,
      orange: 0
    },
    vegetable: {
      carrot: 0,
      potato: 0,
      cabbage: 0,
      onion: 0,
      tomato: 0,
      corn: 0
    },
    fish: {
      anchovy: 0,
      catfish: 0,
      carp: 0,
      tuna: 0,
      salmon: 0,
      swordfish: 0,
      pufferfish: 0,
      squid: 0,
      shrimp: 0,
      clownfish: 0
    },
    food: {
      bread: 0,
      rice: 0,
      grilled_fish: 0,
      steak: 0,
      fruit_salad: 0,
      roast_chicken: 0
    },
    drink: {
      water: 0,
      juice: 0,
      herbal_tea: 0,
      mana_potion: 0,
      elixir: 0
    },
    tools: {
      pickaxe_iron: 0,
      pickaxe_diamond: 0,
      rod_wood: 0,
      rod_premium: 0
    },
    weapon: {
      sword_stone: 0,
      sword_iron: 0,
      sword_diamond: 0,
      sword_light: 0,
      sword_dark: 0
    },
    armor: {
      armor_leather: 0,
      armor_iron: 0,
      armor_crystal: 0
    },
    crate: {
      common: 0,
      uncommon: 0,
      legendary: 0,
      mythic: 0,
      secret: 0
    }
  },
  cooldown: {
    daily: 0,
    adventure: 0,
    mine: 0,
    fish: 0,
    rest: 0
  },
  afk: {
    status: false,
    reason: "",
    time: 0
  },
  createdAt: Date.now()
});
const DEFAULT_GROUP = (jid = "") => ({
  from: jid,
  config: {},
  bans: false,
  mute: false,
  welcome: false,
  leave: false,
  antilink: false,
  antidelete: false,
  nsfw: false
});
const db = {
  async read() {
    const client = getTursoClient();
    if (client) {
      let attempts = 0;
      while (attempts < RETRY_CONFIG.MAX_ATTEMPTS) {
        try {
          await initTursoTable(client);
          const res = await client.execute({
            sql: "SELECT value FROM bot_db WHERE key = ?",
            args: ["data"]
          });
          if (res.rows.length > 0 && res.rows[0].value) {
            const parsed = JSON.parse(res.rows[0].value);
            console.log(chalk.green("[ DATABASE ] Memuat data dari Turso Cloud SQLite."));
            return {
              user: parsed.user || {},
              group: parsed.group || {},
              cmd: parsed.cmd || {},
              stats: parsed.stats || {},
              totalHits: parsed.totalHits || 0,
              ...parsed
            };
          } else {
            console.log(chalk.yellow("[ DATABASE ] Record baru dibuat di Turso Cloud SQLite."));
            const initialData = {
              user: {},
              group: {},
              cmd: {},
              stats: {},
              totalHits: 0
            };
            await db.writeImmediate(initialData);
            return initialData;
          }
        } catch (err) {
          attempts++;
          console.error(chalk.yellow(`[ TURSO READ ATTEMPT ${attempts}/${RETRY_CONFIG.MAX_ATTEMPTS} GAGAL ]: `), err.message);
          if (attempts >= RETRY_CONFIG.MAX_ATTEMPTS) {
            console.error(chalk.red("[ TURSO READ GAGAL TOTAL ] Fallback beralih ke Database Lokal."));
            break;
          }
          await new Promise(r => setTimeout(r, 1e3 * attempts));
        }
      }
    }
    const localData = readFromLocalFile();
    return {
      user: localData.user || {},
      group: localData.group || {},
      cmd: localData.cmd || {},
      stats: localData.stats || {},
      totalHits: localData.totalHits || 0,
      ...localData
    };
  },
  write(data) {
    if (writeTimeout) clearTimeout(writeTimeout);
    writeTimeout = setTimeout(async () => {
      await db.writeImmediate(data || global.db);
    }, 250);
    return Promise.resolve(true);
  },
  async writeImmediate(data) {
    const payload = data || global.db || {};
    let serialized;
    try {
      serialized = safeStringify(payload, 2);
    } catch (serializeErr) {
      console.error(chalk.red("[ DB SERIALIZE ERROR ]:"), serializeErr.message);
      return;
    }
    const client = getTursoClient();
    if (!client) {
      writeToLocalFile(serialized);
      return;
    }
    writeToLocalFile(serialized);
    let success = false;
    let attempts = 0;
    while (attempts < RETRY_CONFIG.MAX_ATTEMPTS) {
      try {
        await initTursoTable(client);
        await client.execute({
          sql: `
            INSERT INTO bot_db (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
          `,
          args: ["data", serialized]
        });
        success = true;
        break;
      } catch (err) {
        attempts++;
        console.error(chalk.yellow(`[ TURSO WRITE ATTEMPT ${attempts}/${RETRY_CONFIG.MAX_ATTEMPTS} ]: `), err.message);
        if (attempts < RETRY_CONFIG.MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 600 * attempts));
        }
      }
    }
    if (!success) {
      console.warn(chalk.yellow("[ TURSO BUSY/ERROR ] Penulisan ditunda (skip). Akan dicoba kembali otomatis di background..."));
      RETRY_CONFIG.pendingData = payload;
      db.scheduleRetry();
    }
  },
  scheduleRetry() {
    if (retryTimeout) return;
    retryTimeout = setTimeout(async () => {
      retryTimeout = null;
      if (!RETRY_CONFIG.pendingData && !global.db) return;
      console.log(chalk.cyan("[ RETRY QUEUE ] Mencoba sinkronisasi ulang database ke Turso..."));
      try {
        const dataToSave = RETRY_CONFIG.pendingData || global.db;
        RETRY_CONFIG.pendingData = null;
        await db.writeImmediate(dataToSave);
      } catch (e) {
        console.error(chalk.red("[ RETRY QUEUE FAILED ]:"), e.message);
      }
    }, RETRY_CONFIG.BASE_DELAY * 2);
  },
  ensureUser(jid, name = "User") {
    if (!global.db) return;
    if (!global.db.user) global.db.user = {};
    if (!global.db.user[jid]) {
      global.db.user[jid] = DEFAULT_USER(name);
    }
    const u = global.db.user[jid];
    if (!u.name) u.name = name;
    if (u.banned === undefined) u.banned = false;
    if (u.banReason === undefined) u.banReason = "";
    if (u.registered === undefined) u.registered = false;
    if (u.registeredAt === undefined) u.registeredAt = null;
    if (u.limit === undefined) u.limit = global.bot?.defaultLimit || 20;
    if (u.hits === undefined) u.hits = 0;
    if (!u.premium) {
      u.premium = {
        status: false,
        expiredAt: null
      };
    }
    if (!u.cooldown) {
      u.cooldown = {
        daily: 0,
        adventure: 0,
        mine: 0,
        fish: 0,
        rest: 0
      };
    }
    if (!u.afk) {
      u.afk = {
        status: false,
        reason: "",
        time: 0
      };
    }
  },
  ensureGroup(jid) {
    if (!global.db) return;
    if (!global.db.group) global.db.group = {};
    if (!global.db.group[jid]) {
      global.db.group[jid] = DEFAULT_GROUP(jid);
    }
    const g = global.db.group[jid];
    if (g.bans === undefined) g.bans = false;
    if (g.mute === undefined) g.mute = false;
    if (g.welcome === undefined) g.welcome = false;
    if (g.antilink === undefined) g.antilink = false;
    if (g.nsfw === undefined) g.nsfw = false;
  },
  resetAllLimits(defaultLimit = global.bot?.defaultLimit || 20) {
    if (!global.db || !global.db.user) return 0;
    let count = 0;
    for (const jid in global.db.user) {
      const u = global.db.user[jid];
      if (!u.ownerAcces && !u.premium?.status) {
        u.limit = defaultLimit;
        count++;
      }
    }
    db.write(global.db);
    return count;
  },
  checkPremiumExpiry() {
    if (!global.db || !global.db.user) return 0;
    const now = Date.now();
    let count = 0;
    for (const jid in global.db.user) {
      const u = global.db.user[jid];
      if (u.premium?.status && u.premium.expiredAt !== Number.MAX_SAFE_INTEGER && u.premium.expiredAt <= now) {
        u.premium.status = false;
        u.premium.expiredAt = null;
        count++;
      }
    }
    if (count > 0) db.write(global.db);
    return count;
  },
  DEFAULT_USER: DEFAULT_USER,
  DEFAULT_GROUP: DEFAULT_GROUP
};
export default db;