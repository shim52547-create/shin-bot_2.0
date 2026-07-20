const fs = require("fs-extra");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const MONEY_FILE = path.join(DATA_DIR, "money.json");
const HISTORY_FILE = path.join(DATA_DIR, "money_history.json");
const MAX_HISTORY = 20000; // giới hạn số bản ghi để file không phình to vô hạn

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(MONEY_FILE)) fs.writeJsonSync(MONEY_FILE, {});
if (!fs.existsSync(HISTORY_FILE)) fs.writeJsonSync(HISTORY_FILE, []);

function readJson() {
  try {
    return fs.readJsonSync(MONEY_FILE);
  } catch (e) {
    return {};
  }
}

function writeJson(data) {
  fs.writeJsonSync(MONEY_FILE, data, { spaces: 2 });
}

function readHistory() {
  try {
    return fs.readJsonSync(HISTORY_FILE);
  } catch (e) {
    return [];
  }
}

function writeHistory(list) {
  if (list.length > MAX_HISTORY) list = list.slice(list.length - MAX_HISTORY);
  fs.writeJsonSync(HISTORY_FILE, list, { spaces: 2 });
}

// Ghi lại 1 lần biến động số dư (dùng để tính bảng xếp hạng theo ngày/tuần/tháng)
function logChange(userID, delta) {
  if (!delta) return;
  const list = readHistory();
  list.push({ userID, delta: Math.floor(delta), at: Date.now() });
  writeHistory(list);
}

const STARTING_BALANCE = 500;

const Currencies = {
  // Trả về { money: number } cho 1 người dùng, tự khởi tạo nếu chưa có
  getData(userID) {
    const all = readJson();
    if (!all[userID]) {
      all[userID] = { money: STARTING_BALANCE };
      writeJson(all);
    }
    return all[userID];
  },
  setData(userID, data) {
    const all = readJson();
    all[userID] = { ...(all[userID] || { money: STARTING_BALANCE }), ...data };
    writeJson(all);
    return all[userID];
  },
  increaseMoney(userID, amount) {
    const all = readJson();
    const current = all[userID]?.money ?? STARTING_BALANCE;
    const add = Math.max(0, Math.floor(amount || 0));
    all[userID] = { ...(all[userID] || {}), money: current + add };
    writeJson(all);
    logChange(userID, add);
    return all[userID].money;
  },
  decreaseMoney(userID, amount) {
    const all = readJson();
    const current = all[userID]?.money ?? STARTING_BALANCE;
    const sub = Math.max(0, Math.floor(amount || 0));
    const actualSub = Math.min(current, sub);
    all[userID] = { ...(all[userID] || {}), money: current - actualSub };
    writeJson(all);
    logChange(userID, -actualSub);
    return all[userID].money;
  },
  // Trả về { ok: true, money, next } nếu claim thành công,
  // hoặc { ok: false, remainingMs } nếu còn trong thời gian chờ.
  claimDaily(userID, amount, cooldownMs) {
    const all = readJson();
    const record = all[userID] || { money: STARTING_BALANCE };
    const now = Date.now();
    const last = record.lastDaily || 0;
    const remaining = cooldownMs - (now - last);

    if (remaining > 0) {
      return { ok: false, remainingMs: remaining };
    }

    record.money = (record.money ?? STARTING_BALANCE) + amount;
    record.lastDaily = now;
    all[userID] = record;
    writeJson(all);
    logChange(userID, amount);
    return { ok: true, money: record.money };
  },

  // Bảng xếp hạng.
  // period: null/"all"  -> xếp theo số dư hiện tại (toàn thời gian)
  //         "day"/"week"/"month" -> xếp theo tổng xu kiếm được (net) trong khoảng thời gian đó
  getTop(period, limit) {
    limit = limit || 10;
    const PERIOD_MS = { day: 24 * 60 * 60 * 1000, week: 7 * 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000 };

    if (!period || period === "all") {
      const all = readJson();
      return Object.entries(all)
        .map(([userID, data]) => ({ userID, amount: data.money || 0 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);
    }

    const windowMs = PERIOD_MS[period];
    if (!windowMs) return [];
    const since = Date.now() - windowMs;
    const list = readHistory().filter(rec => rec.at >= since);
    const totals = {};
    for (const rec of list) {
      totals[rec.userID] = (totals[rec.userID] || 0) + rec.delta;
    }
    return Object.entries(totals)
      .map(([userID, amount]) => ({ userID, amount }))
      .filter(r => r.amount !== 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }
};

module.exports = { Currencies };
