const fs = require("fs-extra");
const path = require("path");

const { DATA_DIR } = require("./dataDir");
const RANK_FILE = path.join(DATA_DIR, "rank.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(RANK_FILE)) fs.writeJsonSync(RANK_FILE, {});

function readJson() {
  try {
    return fs.readJsonSync(RANK_FILE);
  } catch (e) {
    return {};
  }
}

function writeJson(data) {
  fs.writeJsonSync(RANK_FILE, data, { spaces: 2 });
}

// Danh sách rank theo thứ tự tăng dần. minExp = mốc EXP tối thiểu cần có để ĐỦ ĐIỀU KIỆN
// lên rank đó (còn phải gõ lệnh "rankup" để xác nhận, không tự động nhảy rank).
const RANKS = [
  { name: "Đồng", emoji: "🥉", minExp: 0, reward: 0 },
  { name: "Bạc", emoji: "⚪", minExp: 500, reward: 300 },
  { name: "Vàng", emoji: "🟡", minExp: 1500, reward: 700 },
  { name: "Bạch Kim", emoji: "🔷", minExp: 3500, reward: 1500 },
  { name: "Kim Cương", emoji: "💎", minExp: 7000, reward: 3000 },
  { name: "Cao Thủ", emoji: "🔥", minExp: 12000, reward: 6000 },
  { name: "Đại Cao Thủ", emoji: "👑", minExp: 20000, reward: 12000 },
  { name: "Thách Đấu", emoji: "🏆", minExp: 35000, reward: 25000 }
];

const EXP_MIN = 5;
const EXP_MAX = 15;
const EXP_COOLDOWN_MS = 60 * 1000; // 60s giữa 2 lần cộng EXP / 1 người, chống spam farm

const Ranks = {
  RANKS,

  getData(userID) {
    const all = readJson();
    const base = { exp: 0, rankIndex: 0, lastExpAt: 0 };
    if (!all[userID]) {
      all[userID] = base;
      writeJson(all);
    }
    return { ...base, ...all[userID] };
  },

  setData(userID, data) {
    const all = readJson();
    const current = all[userID] || { exp: 0, rankIndex: 0, lastExpAt: 0 };
    all[userID] = { ...current, ...data };
    writeJson(all);
    return all[userID];
  },

  // Gọi mỗi khi user gửi tin nhắn. Tự có cooldown bên trong nên gọi vô tư mỗi tin nhắn.
  // Trả về số EXP vừa cộng, hoặc null nếu đang trong cooldown.
  addExpOnChat(userID) {
    if (!userID) return null;
    const all = readJson();
    const record = all[userID] || { exp: 0, rankIndex: 0, lastExpAt: 0 };
    const now = Date.now();
    if (now - (record.lastExpAt || 0) < EXP_COOLDOWN_MS) return null;

    const gained = Math.floor(Math.random() * (EXP_MAX - EXP_MIN + 1)) + EXP_MIN;
    record.exp = (record.exp || 0) + gained;
    record.lastExpAt = now;
    all[userID] = record;
    writeJson(all);
    return gained;
  },

  // Rank đã được xác nhận (dựa theo rankIndex đã lưu, KHÔNG tự nhảy theo EXP).
  getCurrentRank(userID) {
    const data = Ranks.getData(userID);
    return { ...RANKS[data.rankIndex], index: data.rankIndex };
  },

  getNextRank(userID) {
    const data = Ranks.getData(userID);
    return RANKS[data.rankIndex + 1] || null;
  },

  // Level là một thang riêng, chỉ dùng để hiển thị trên rank card - tách biệt
  // với rank (Đồng/Bạc/Vàng...) vốn phải "rankup" mới lên. Mỗi level cần
  // nhiều EXP hơn level trước (level n cần n*100 EXP để lên n+1).
  getLevelInfo(userID) {
    const data = Ranks.getData(userID);
    let level = 1;
    let remaining = data.exp || 0;
    while (true) {
      const need = level * 100;
      if (remaining < need) break;
      remaining -= need;
      level++;
    }
    return { level, levelExpInto: remaining, levelExpNeeded: level * 100 };
  },

  // Thử xác nhận lên rank kế tiếp.
  tryRankUp(userID) {
    const data = Ranks.getData(userID);
    const next = RANKS[data.rankIndex + 1];
    if (!next) return { ok: false, reason: "MAX_RANK" };
    if (data.exp < next.minExp) {
      return { ok: false, reason: "NOT_ENOUGH_EXP", missing: next.minExp - data.exp, next };
    }
    Ranks.setData(userID, { rankIndex: data.rankIndex + 1 });
    return { ok: true, newRank: next, reward: next.reward };
  }
};

module.exports = { Ranks };
