const fs = require("fs-extra");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const BIRTHDAY_FILE = path.join(DATA_DIR, "birthdays.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(BIRTHDAY_FILE)) fs.writeJsonSync(BIRTHDAY_FILE, {});

function readData() {
  try {
    return fs.readJsonSync(BIRTHDAY_FILE);
  } catch (e) {
    return {};
  }
}
function writeData(data) {
  fs.writeJsonSync(BIRTHDAY_FILE, data, { spaces: 2 });
}

module.exports = {
  config: {
    name: "setbirthday",
    aliases: ["sinhnhat", "setsn"],
    version: "1.0",
    role: 0,
    description: "Khai ngày sinh nhật (DD/MM) để bot tự động chúc mừng đúng ngày trong nhóm",
    usage: "setbirthday <DD/MM> | setbirthday xoa",
    category: "Group"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const data = readData();

    if (args[0]?.toLowerCase() === "xoa") {
      if (data[senderID]) {
        delete data[senderID];
        writeData(data);
      }
      return api.sendMessage("🗑️ Đã xóa ngày sinh nhật của bạn.", threadID, messageID);
    }

    const input = args[0];
    const match = input?.match(/^(\d{1,2})[/\-](\d{1,2})$/);
    if (!match) {
      return api.sendMessage("⚠️ Cách dùng: setbirthday <DD/MM>\nVí dụ: setbirthday 25/12", threadID, messageID);
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
      return api.sendMessage("⚠️ Ngày/tháng không hợp lệ.", threadID, messageID);
    }

    data[senderID] = data[senderID] || {};
    data[senderID][threadID] = { day, month };
    writeData(data);

    return api.sendMessage(
      `🎂 Đã lưu sinh nhật ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}.\n` +
      `Bot sẽ tự động tag chúc mừng bạn trong nhóm này vào đúng ngày!`,
      threadID, messageID
    );
  }
};
