import {
  createRequire
} from "module";
const require = createRequire(import.meta.url);
const Jimp = require("jimp");
export const getRandom = arr => {
  return arr[Math.floor(Math.random() * arr.length)];
};
export const delay = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
export const Stringify = (data, {
  space = 2,
  sort = false,
  filter = null
} = {}) => {
  let cache = new Set();
  try {
    return JSON.stringify(data, (key, value) => {
      if (filter && Array.isArray(filter)) {
        if (key && !filter.includes(key)) return undefined;
      }
      if (typeof value === "object" && value !== null) {
        if (cache.has(value)) return "[Circular]";
        cache.add(value);
        if (sort) {
          return Object.keys(value).sort().reduce((acc, k) => {
            acc[k] = value[k];
            return acc;
          }, {});
        }
      }
      return value;
    }, space);
  } catch (err) {
    return `Stringify Error: ${err.message}`;
  } finally {
    cache.clear();
  }
};
export const getTime = (timezone = "Asia/Jakarta", format = {}) => {
  try {
    return new Date().toLocaleString("id-ID", {
      timeZone: timezone,
      hour12: false,
      weekday: format.weekday || "long",
      year: format.year || "numeric",
      month: format.month || "long",
      day: format.day || "numeric",
      hour: format.hour || "2-digit",
      minute: format.minute || "2-digit",
      second: format.second || "2-digit"
    });
  } catch (e) {
    return "Invalid Timezone";
  }
};
export const runtime = seconds => {
  seconds = Number(seconds);
  let d = Math.floor(seconds / (3600 * 24));
  let h = Math.floor(seconds % (3600 * 24) / 3600);
  let m = Math.floor(seconds % 3600 / 60);
  let s = Math.floor(seconds % 60);
  return [d ? `${d} Hari` : "", h ? `${h} Jam` : "", m ? `${m} Menit` : "", s ? `${s} Detik` : ""].filter(Boolean).join(" ");
};
export const getBuffer = async (url, options = {}) => {
  try {
    let res = await axios({
      method: "get",
      url: url,
      headers: {
        DNT: 1,
        "Upgrade-Insecure-Request": 1
      },
      ...options,
      responseType: "arraybuffer"
    });
    return res.data;
  } catch (err) {
    throw new Error("Failed to fetch buffer");
  }
};
export const imgResize = async (input, width, height) => {
  let regexUrl = /(https?:\/\/[^\s]+)/i;
  let buffer;
  if (typeof input === "string" && regexUrl.test(input)) {
    let res = await axios.get(input, {
      responseType: "arraybuffer"
    });
    buffer = res.data;
  } else {
    buffer = input;
  }
  let img = await Jimp.read(buffer);
  let resize = img.resize(width, height);
  return await resize.getBufferAsync(Jimp.MIME_JPEG);
};
export const ucword = (text = "") => {
  let fontMp = {
    "ǫ": "q",
    "ᴡ": "w",
    "ᴇ": "e",
    "ʀ": "r",
    "ᴛ": "t",
    "ʏ": "y",
    "ᴜ": "u",
    "ɪ": "i",
    "ᴏ": "o",
    "ᴘ": "p",
    "ᴀ": "a",
    "ᴅ": "d",
    "ғ": "f",
    "ɢ": "g",
    "ʜ": "h",
    "ᴊ": "j",
    "ᴋ": "k",
    "ʟ": "l",
    "ᴢ": "z",
    "ᴄ": "c",
    "ᴠ": "v",
    "ʙ": "b",
    "ɴ": "n",
    "ᴍ": "m",
    "ϙ": "q",
    "ɯ": "w",
    "ҽ": "e",
    "ɾ": "r",
    "ƚ": "t",
    "ყ": "y",
    "υ": "u",
    "ι": "i",
    "σ": "o",
    "π": "p",
    "α": "a",
    "ʂ": "s",
    "ԃ": "d",
    "ϝ": "f",
    "ɠ": "g",
    "ԋ": "h",
    "ʝ": "j",
    "ƙ": "k",
    "ʅ": "l",
    "ȥ": "z",
    "ƈ": "c",
    "ʋ": "v",
    "Ⴆ": "b",
    "ɳ": "n",
    "ɱ": "m"
  };
  return [...text].map(char => {
    let code = char.codePointAt(0);
    if (code >= 119808 && code <= 119833) return String.fromCharCode(code - 119808 + 65);
    if (code >= 119834 && code <= 119859) return String.fromCharCode(code - 119834 + 97);
    if (code >= 119860 && code <= 119885) return String.fromCharCode(code - 119860 + 65);
    if (code >= 119886 && code <= 119911) return String.fromCharCode(code - 119886 + 97);
    return fontMp[char] || char;
  }).join("");
};
export const font = (text = "", type = "smallcaps") => {
  const fonts = {
    smallcaps: {
      a: "𝗔",
      b: "𝗕",
      c: "𝗖",
      d: "𝗗",
      e: "𝗘",
      f: "𝗙",
      g: "𝗚",
      h: "𝗛",
      i: "𝗜",
      j: "𝗝",
      k: "𝗞",
      l: "𝗟",
      m: "𝗠",
      n: "𝗡",
      o: "𝗢",
      p: "𝗣",
      q: "𝗤",
      r: "𝗥",
      s: "𝗦",
      t: "𝗧",
      u: "𝗨",
      v: "𝗩",
      w: "𝗪",
      x: "𝗫",
      y: "𝗬",
      z: "𝗭"
    },
    bold: {
      a: "𝗔",
      b: "𝗕",
      c: "𝗖",
      d: "𝗗",
      e: "𝗘",
      f: "𝗙",
      g: "𝗚",
      h: "𝗛",
      i: "𝗜",
      j: "𝗝",
      k: "𝗞",
      l: "𝗟",
      m: "𝗠",
      n: "𝗡",
      o: "𝗢",
      p: "𝗣",
      q: "𝗤",
      r: "𝗥",
      s: "𝗦",
      t: "𝗧",
      u: "𝗨",
      v: "𝗩",
      w: "𝗪",
      x: "𝗫",
      y: "𝗬",
      z: "𝗭"
    },
    monospace: {
      a: "𝚊",
      b: "𝚋",
      c: "𝚌",
      d: "𝚍",
      e: "𝚎",
      f: "𝚏",
      g: "𝚐",
      h: "𝚑",
      i: "𝚒",
      j: "𝚓",
      k: "𝚔",
      l: "𝚕",
      m: "𝚖",
      n: "𝚗",
      o: "𝚘",
      p: "𝚙",
      q: "𝚚",
      r: "𝚛",
      s: "𝚜",
      t: "𝚝",
      u: "𝚞",
      v: "𝚟",
      w: "𝚠",
      x: "𝚡",
      y: "𝚢",
      z: "𝚣"
    },
    bubble: {
      a: "ⓐ",
      b: "ⓑ",
      c: "ⓒ",
      d: "ⓓ",
      e: "ⓔ",
      f: "ⓕ",
      g: "ⓖ",
      h: "ⓗ",
      i: "ⓘ",
      j: "ⓙ",
      k: "ⓚ",
      l: "ⓛ",
      m: "ⓜ",
      n: "ⓝ",
      o: "ⓞ",
      p: "ⓟ",
      q: "ⓠ",
      r: "ⓡ",
      s: "ⓢ",
      t: "ⓣ",
      u: "ⓤ",
      v: "ⓥ",
      w: "ⓦ",
      x: "ⓧ",
      y: "ⓨ",
      z: "ⓩ"
    }
  };
  const map = fonts[type] || fonts.smallcaps;
  return text.split("").map(c => {
    const lower = c.toLowerCase();
    return map[lower] || c;
  }).join("");
};
export const newUserTemplate = name => ({
  name: name || "User",
  ownerAcces: false,
  premium: {
    status: false,
    expiredAt: null
  },
  limit: 20,
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
  createdAt: Date.now()
});
export const makeJid = input => {
  const clean = input.replace(/\D/g, "").replace(/^0/, "62");
  return clean.includes("@s.whatsapp.net") ? clean : `${clean}@s.whatsapp.net`;
};
export const ensureUser = (jid, name) => {
  if (!global.db) return;
  if (!global.db.user[jid]) {
    global.db.user[jid] = newUserTemplate(name);
  }
  const u = global.db.user[jid];
  if (!u.premium) u.premium = {
    status: false,
    expiredAt: null
  };
  if (u.limit === undefined) u.limit = 20;
  if (!u.cooldown) u.cooldown = {
    daily: 0,
    adventure: 0,
    mine: 0,
    fish: 0,
    rest: 0
  };
};
export function getExpNeeded(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}