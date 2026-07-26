const fs = require("fs-extra");
const path = require("path");
const { Currencies } = require("../utils/currency");
const { Ranks } = require("../utils/rank");

// ==== Cấu hình tỉ giá quy đổi ====
const MONEY_PER_EXP = 10; // 10 xu = 1 exp (đổi TIỀN sang EXP)
const EXP_PER_MONEY = 5;  // 5 exp = 1 xu (đổi EXP sang TIỀN)

// ==== Lưu lịch sử giao dịch, theo đúng convention của utils/currency.js, utils/database.js ====
const { DATA_DIR } = require("../utils/dataDir");
const HISTORY_FILE = path.join(DATA_DIR, "shop_history.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(HISTORY_FILE)) fs.writeJsonSync(HISTORY_FILE, []);

function readHistory() {
  try {
    return fs.readJsonSync(HISTORY_FILE);
  } catch (e) {
    return [];
  }
}

function writeHistory(list) {
  // Giới hạn số bản ghi để file không phình to vô hạn
  if (list.length > 5000) list = list.slice(list.length - 5000);
  fs.writeJsonSync(HISTORY_FILE, list, { spaces: 2 });
}

function logBill(userID, message) {
  const list = readHistory();
  list.push({ userID, message, at: Date.now() });
  writeHistory(list);
}

function formatDateTime() {
  const d = new Date();
  const date = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${time} - ${date}`;
}

function menuText(prefix) {
  return (
    "◆━━◆ 🏛 BANKING ◆━━◆" +
    "\n» Mời bạn nhập lựa chọn «" +
    `\n\n1. ${prefix}shop doitien <số xu> ❄️ (đổi tiền sang exp, ${MONEY_PER_EXP} xu = 1 exp)` +
    `\n2. ${prefix}shop doiexp <số exp> 💦 (đổi exp sang tiền, ${EXP_PER_MONEY} exp = 1 xu)` +
    `\n3. ${prefix}shop lichsu ⚒ (xem lịch sử giao dịch của bạn)`
  );
}

module.exports = {
  config: {
    name: "shop",
    aliases: ["shopgame", "banking", "doixu"],
    version: "2.0",
    role: 0,
    description: "Đổi qua lại giữa xu và exp",
    usage: "shop | shop doitien <số xu> | shop doiexp <số exp> | shop lichsu",
    category: "Kinh tế"
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const prefix = global.config.PREFIX || "!";
    const sub = (args[0] || "").toLowerCase();

    // ==== Menu mặc định ====
    if (!sub) {
      return api.sendMessage(menuText(prefix), threadID, messageID);
    }

    // ==== Đổi TIỀN sang EXP ====
    if (sub === "doitien") {
      const amount = parseInt(args[1], 10);
      if (!args[1] || isNaN(amount) || amount < 1) {
        return api.sendMessage(
          `⚠️ Số xu không hợp lệ.\nCách dùng: ${prefix}shop doitien <số xu>`,
          threadID, messageID
        );
      }

      const moneyData = Currencies.getData(senderID);
      if (amount > moneyData.money) {
        return api.sendMessage(
          "Tiền của bạn không đủ, vui lòng kiếm thêm xu rồi quay lại nhé!",
          threadID, messageID
        );
      }

      Currencies.decreaseMoney(senderID, amount);
      const expGained = Math.floor(amount / MONEY_PER_EXP);
      const rankData = Ranks.getData(senderID);
      Ranks.setData(senderID, { exp: (rankData.exp || 0) + expGained });

      const msg =
        `💸 Giao dịch thành công !\n` +
        `Thời gian: ${formatDateTime()}\n` +
        `Chi tiết: đổi ${amount} xu để lấy ${expGained} exp.`;
      logBill(senderID, msg);
      return api.sendMessage(msg, threadID, messageID);
    }

    // ==== Đổi EXP sang TIỀN ====
    if (sub === "doiexp") {
      const amount = parseInt(args[1], 10);
      if (!args[1] || isNaN(amount) || amount < 1) {
        return api.sendMessage(
          `⚠️ Số exp không hợp lệ.\nCách dùng: ${prefix}shop doiexp <số exp>`,
          threadID, messageID
        );
      }

      const rankData = Ranks.getData(senderID);
      if (amount > (rankData.exp || 0)) {
        return api.sendMessage(
          "Exp của bạn không đủ, vui lòng cào phím nhiều hơn nhé!",
          threadID, messageID
        );
      }

      Ranks.setData(senderID, { exp: rankData.exp - amount });
      const moneyGained = Math.floor(amount / EXP_PER_MONEY);
      Currencies.increaseMoney(senderID, moneyGained);

      const msg =
        `💸 Giao dịch thành công !\n` +
        `Thời gian: ${formatDateTime()}\n` +
        `Chi tiết: đổi ${amount} exp để lấy ${moneyGained} xu.`;
      logBill(senderID, msg);
      return api.sendMessage(msg, threadID, messageID);
    }

    // ==== Xem lịch sử giao dịch (chỉ của người gọi lệnh) ====
    if (sub === "lichsu" || sub === "check") {
      const history = readHistory()
        .filter(item => item.userID === senderID)
        .slice(-10);

      if (history.length === 0) {
        return api.sendMessage("Bạn chưa có giao dịch nào trên hệ thống.", threadID, messageID);
      }

      const text = history.map(item => item.message).join("\n\n");
      return api.sendMessage(text, threadID, messageID);
    }

    return api.sendMessage(menuText(prefix), threadID, messageID);
  }
};
