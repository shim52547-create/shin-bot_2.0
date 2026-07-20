const fs = require("fs-extra");
const path = require("path");

const { DATA_DIR } = require("./dataDir");
const FISHING_FILE = path.join(DATA_DIR, "fishing.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(FISHING_FILE)) fs.writeJsonSync(FISHING_FILE, {});

// ---- Dữ liệu gốc: 2500 cá/vật phẩm + 1000 cần câu (đã "bake" giá trị/độ bền cố định) ----
const FISH_POOL = require("./data/fishPool.json"); // { junk:[], common:[], uncommon:[], rare:[], epic:[], legendary:[], mythic:[], divine:[] }
const ROD_POOL = require("./data/rodPool.json"); // { thuong:[], hiem:[], sieuviet:[], sr:[], ssr:[], ur:[], sss:[] }

function readAll() {
  try {
    return fs.readJsonSync(FISHING_FILE);
  } catch (e) {
    return {};
  }
}
function writeAll(data) {
  fs.writeJsonSync(FISHING_FILE, data, { spaces: 2 });
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Cần câu: 7 phẩm cấp, từ Thường đến Tối Cao Thần Thoại (SSS) ----
// Mỗi lần MUA một phẩm cấp, hệ thống bốc ngẫu nhiên 1 cây cần trong kho 150-200 cây của phẩm cấp đó
// (tên + chỉ số + mô tả "ảo ma tiên hiệp" lấy từ danh sách gốc) làm cần câu hiện tại của người chơi.
const ROD_TIER_ORDER = ["thuong", "hiem", "sieuviet", "sr", "ssr", "ur", "sss"];

const ROD_TIER_META = {
  thuong: { label: "Thường", shortTag: "Thường", price: 0, color: "#9aa6ad", accent: "#5f6a70" },
  hiem: { label: "Hiếm", shortTag: "Hiếm", price: 500, color: "#4aa3f0", accent: "#1f6fb8" },
  sieuviet: { label: "Siêu Việt", shortTag: "Siêu Việt", price: 2000, color: "#34c98a", accent: "#1c8a5c" },
  sr: { label: "Siêu Hiếm (SR)", shortTag: "SR", price: 6000, color: "#b06ae0", accent: "#7a3ba8" },
  ssr: { label: "Siêu Siêu Hiếm (SSR)", shortTag: "SSR", price: 20000, color: "#ff8a3d", accent: "#c9541c" },
  ur: { label: "Huyền Thoại (UR)", shortTag: "UR", price: 60000, color: "#ff4d6d", accent: "#b8123a" },
  sss: { label: "Tối Cao Thần Thoại (SSS)", shortTag: "SSS", price: 150000, color: "#ffd76b", accent: "#7a3bd6" }
};

// Tỉ lệ [miss, junk, common, uncommon, rare, epic, legendary, mythic, divine] — không cần cộng = 1,
// castRod tự chuẩn hoá theo tổng. Cần càng cao cấp, tỉ lệ hụt/rác càng thấp, tỉ lệ cá quý càng cao.
const ROD_WEIGHTS = {
  thuong: [22, 30, 38, 8, 1.8, 0.18, 0.02, 0.002, 0.0005],
  hiem: [15, 20, 40, 18, 6, 1.0, 0.09, 0.008, 0.001],
  sieuviet: [10, 12, 38, 26, 11, 2.7, 0.25, 0.02, 0.003],
  sr: [6, 7, 30, 32, 18, 6, 0.8, 0.08, 0.01],
  ssr: [3, 3, 20, 30, 25, 14, 4.5, 0.4, 0.06],
  ur: [1.5, 1.5, 12, 24, 28, 22, 9, 1.6, 0.25],
  sss: [0.5, 0.5, 5, 14, 24, 28, 20, 6.5, 1.5]
};

// RODS[level]: level 1..7 (giữ style mảng 1-index như bản cũ để tương thích chỗ khác nếu cần)
const RODS = [null];
for (const key of ROD_TIER_ORDER) {
  const meta = ROD_TIER_META[key];
  RODS.push({
    key,
    level: RODS.length,
    label: meta.label,
    shortTag: meta.shortTag,
    price: meta.price,
    color: meta.color,
    accent: meta.accent,
    weights: ROD_WEIGHTS[key],
    pool: ROD_POOL[key] || []
  });
}
const MAX_ROD_LEVEL = RODS.length - 1;

function getRod(level) {
  return RODS[Math.min(Math.max(level, 1), MAX_ROD_LEVEL)];
}

function rollRodFlavor(level) {
  const tier = getRod(level);
  const flavor = pickRandom(tier.pool) || { name: tier.label, stat: null, statLabel: null, desc: "" };
  return {
    tierKey: tier.key,
    tierLabel: tier.label,
    name: flavor.name,
    stat: flavor.stat,
    statLabel: flavor.statLabel,
    desc: flavor.desc
  };
}

// ---- Cá / vật phẩm: 8 phẩm cấp ----
const FISH_TIER_ORDER = ["junk", "common", "uncommon", "rare", "epic", "legendary", "mythic", "divine"];

const TIERS = {
  junk: { key: "junk", label: "Phế Phẩm", emoji: "🗑️", color: "#9aa0a6", accent: "#5f6368", stars: 0 },
  common: { key: "common", label: "Thường", emoji: "⚪", color: "#7fd0a0", accent: "#3f8f63", stars: 1 },
  uncommon: { key: "uncommon", label: "Hiếm", emoji: "🔵", color: "#4aa3f0", accent: "#2266aa", stars: 2 },
  rare: { key: "rare", label: "Siêu Hiếm", emoji: "🟣", color: "#b06ae0", accent: "#7a3ba8", stars: 3 },
  epic: { key: "epic", label: "Sử Thi", emoji: "🟠", color: "#ff9d4d", accent: "#c9541c", stars: 4 },
  legendary: { key: "legendary", label: "Huyền Thoại", emoji: "🟡", color: "#ffd23f", accent: "#e0a500", stars: 5 },
  mythic: { key: "mythic", label: "Thần Thoại", emoji: "🔴", color: "#ff4d6d", accent: "#8a0f2c", stars: 5 },
  divine: { key: "divine", label: "Tối Thượng", emoji: "🌌", color: "#ffe27a", accent: "#7a3bd6", stars: 5 }
};

// Gộp toàn bộ item -> tra cứu nhanh giá trị + tier khi bán / hiển thị kho
const FISH_INDEX = {};
for (const tierKey of FISH_TIER_ORDER) {
  for (const item of FISH_POOL[tierKey] || []) {
    FISH_INDEX[item.name] = { ...item, tier: tierKey };
  }
}

// Thả cần: trả về { miss: true } hoặc { miss:false, tier, fish:{name,value}, weightKg }
const OUTCOME_ORDER = ["miss", ...FISH_TIER_ORDER];

function castRod(rodLevel) {
  const rod = getRod(rodLevel);
  const weights = rod.weights;
  const total = weights.reduce((a, b) => a + b, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r <= acc) {
      const outcome = OUTCOME_ORDER[i];
      if (outcome === "miss") return { miss: true };

      const pool = FISH_POOL[outcome];
      const base = pickRandom(pool);
      if (!base) return { miss: true };

      let weightKg = null;
      if (base.weightKg != null) {
        weightKg = +(base.weightKg * (0.85 + Math.random() * 0.3)).toFixed(2);
      }
      return {
        miss: false,
        tier: outcome,
        fish: { name: base.name, value: base.value },
        weightKg
      };
    }
  }
  return { miss: true };
}

const DEFAULT_PROFILE = () => ({
  rodLevel: 1,
  rod: null, // { tierKey, tierLabel, name, stat, statLabel, desc } — cây cần cụ thể đang sở hữu
  lastCast: 0,
  inventory: {}, // { "Cá Rô": 3, ... }
  totalCatches: 0,
  totalEarned: 0
});

const Fishing = {
  get(userID) {
    const all = readAll();
    if (!all[userID]) {
      all[userID] = DEFAULT_PROFILE();
      all[userID].rod = rollRodFlavor(1);
      writeAll(all);
    }
    const profile = { ...DEFAULT_PROFILE(), ...all[userID] };
    // đảm bảo có đủ field nếu profile cũ thiếu key mới (vd nâng cấp bot từ bản cũ)
    if (!profile.rod) {
      profile.rod = rollRodFlavor(profile.rodLevel || 1);
      this.set(userID, { rod: profile.rod });
    }
    return profile;
  },
  set(userID, data) {
    const all = readAll();
    all[userID] = { ...(all[userID] || DEFAULT_PROFILE()), ...data };
    writeAll(all);
    return all[userID];
  },
  addFish(userID, fishName) {
    const all = readAll();
    const profile = all[userID] || DEFAULT_PROFILE();
    profile.inventory = profile.inventory || {};
    profile.inventory[fishName] = (profile.inventory[fishName] || 0) + 1;
    profile.totalCatches = (profile.totalCatches || 0) + 1;
    all[userID] = profile;
    writeAll(all);
    return profile;
  },
  clearInventoryAndEarn(userID, amount) {
    const all = readAll();
    const profile = all[userID] || DEFAULT_PROFILE();
    profile.inventory = {};
    profile.totalEarned = (profile.totalEarned || 0) + amount;
    all[userID] = profile;
    writeAll(all);
    return profile;
  },
  // Mua cần câu ở phẩm cấp kế tiếp (tuần tự): trừ tiền do lệnh gọi tự xử lý trước,
  // ở đây chỉ chốt phẩm cấp mới + bốc ngẫu nhiên 1 cây cần trong phẩm cấp đó.
  buyRod(userID, nextLevel) {
    const flavor = rollRodFlavor(nextLevel);
    return this.set(userID, { rodLevel: nextLevel, rod: flavor });
  },
  getTopEarners(limit) {
    const all = readAll();
    return Object.entries(all)
      .map(([userID, p]) => ({ userID, totalEarned: p.totalEarned || 0, totalCatches: p.totalCatches || 0 }))
      .filter(r => r.totalEarned > 0)
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, limit || 10);
  }
};

module.exports = {
  Fishing,
  RODS,
  MAX_ROD_LEVEL,
  ROD_TIER_ORDER,
  ROD_TIER_META,
  getRod,
  rollRodFlavor,
  TIERS,
  FISH_TIER_ORDER,
  FISH_INDEX,
  castRod
};
