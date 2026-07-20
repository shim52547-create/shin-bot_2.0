const fs = require("fs-extra");
const path = require("path");

const { DATA_DIR } = require("./dataDir");
const RENT_FILE = path.join(DATA_DIR, "rent.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(RENT_FILE)) {
  fs.writeJsonSync(RENT_FILE, { operators: [], lastCheckDate: null, threads: {} }, { spaces: 2 });
}

function readData() {
  try {
    const data = fs.readJsonSync(RENT_FILE);
    if (!data.operators) data.operators = [];
    if (!data.threads) data.threads = {};
    return data;
  } catch (e) {
    return { operators: [], lastCheckDate: null, threads: {} };
  }
}

function writeData(data) {
  fs.writeJsonSync(RENT_FILE, data, { spaces: 2 });
}

const SUFFIX_REGEX = /\s*-\s*Còn\s*\d+\s*ngày\s*$/i;

const Rent = {
  // ==== Định dạng biệt danh bot hiển thị số ngày còn lại — dùng chung cho lệnh thue.js và job trừ ngày ====
  stripSuffix(name) {
    return (name || "").replace(SUFFIX_REGEX, "").trim() || (global.config.BOT_NAME || "Bot");
  },
  buildNickname(baseName, daysLeft) {
    return `${baseName} - Còn ${daysLeft} ngày`;
  },
  // Lấy biệt danh hiện tại của BOT (không phải tên nhóm) trong 1 thread, để làm baseName
  async getBotBaseNickname(api, threadID) {
    const botID = api.getCurrentUserID();
    try {
      const info = await api.getThreadInfo(threadID);
      const currentNick = info?.nicknames?.[botID];
      return Rent.stripSuffix(currentNick);
    } catch (e) {
      return Rent.stripSuffix(null);
    }
  },
  // Đổi biệt danh của BOT trong 1 nhóm (changeNickname là API kiểu callback -> bọc lại thành Promise)
  setBotNickname(api, threadID, nickname) {
    const botID = api.getCurrentUserID();
    return new Promise((resolve, reject) => {
      api.changeNickname(nickname, threadID, botID, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  },

  // ==== Vận hành viên (operators) — người được phép điều khiển hệ thống thuê nhóm ====
  getOperators() {
    return readData().operators;
  },
  addOperator(uid) {
    const data = readData();
    if (!data.operators.includes(uid)) data.operators.push(uid);
    writeData(data);
    return data.operators;
  },
  removeOperator(uid) {
    const data = readData();
    data.operators = data.operators.filter(id => id !== uid);
    writeData(data);
    return data.operators;
  },
  isOperator(uid) {
    return readData().operators.includes(uid);
  },
  // Được phép điều khiển hệ thống thuê = admin bot HOẶC nằm trong danh sách operators
  canControl(uid) {
    return (global.config.ADMIN_BOT || []).includes(uid) || Rent.isOperator(uid);
  },

  // ==== Dữ liệu thuê theo từng nhóm ====
  getAllThreads() {
    return readData().threads;
  },
  getThread(threadID) {
    const data = readData();
    return data.threads[threadID] || null;
  },
  setThread(threadID, patch) {
    const data = readData();
    const current = data.threads[threadID] || {};
    data.threads[threadID] = { ...current, ...patch, updatedAt: Date.now() };
    writeData(data);
    return data.threads[threadID];
  },
  removeThread(threadID) {
    const data = readData();
    delete data.threads[threadID];
    writeData(data);
  },

  // ==== Mốc thời gian đã kiểm tra trừ ngày lần cuối (để bù ngày khi bot bị tắt/khởi động lại) ====
  getLastCheckDate() {
    return readData().lastCheckDate;
  },
  setLastCheckDate(dateStr) {
    const data = readData();
    data.lastCheckDate = dateStr;
    writeData(data);
  }
};

module.exports = { Rent };
