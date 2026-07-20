const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");

const { DATA_DIR } = require("./dataDir");
const COUNT_FILE = path.join(DATA_DIR, "messageCount.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(COUNT_FILE)) fs.writeJsonSync(COUNT_FILE, {});

function readJson() {
  try {
    return fs.readJsonSync(COUNT_FILE);
  } catch (e) {
    return {};
  }
}

function writeJson(data) {
  fs.writeJsonSync(COUNT_FILE, data, { spaces: 2 });
}

// Ngày hiện tại theo giờ Việt Nam, dùng làm mốc để tự reset đếm mỗi ngày mới
function today() {
  return moment.tz("Asia/Ho_Chi_Minh").format("YYYY-MM-DD");
}

const MessageCount = {
  // Lấy dữ liệu đếm của 1 nhóm, tự reset nếu đã sang ngày mới
  getThreadData(threadID) {
    const all = readJson();
    const record = all[threadID];
    const day = today();
    if (!record || record.day !== day) {
      const fresh = { day, counts: {} };
      all[threadID] = fresh;
      writeJson(all);
      return fresh;
    }
    return record;
  },

  // Gọi mỗi khi có tin nhắn mới trong nhóm
  addMessage(threadID, senderID) {
    if (!threadID || !senderID) return;
    const all = readJson();
    const day = today();
    let record = all[threadID];
    if (!record || record.day !== day) {
      record = { day, counts: {} };
    }
    record.counts[senderID] = (record.counts[senderID] || 0) + 1;
    all[threadID] = record;
    writeJson(all);
  },

  // Top N người nhắn nhiều nhất trong ngày của 1 nhóm
  getTop(threadID, limit = 10) {
    const data = MessageCount.getThreadData(threadID);
    return Object.entries(data.counts)
      .map(([userID, count]) => ({ userID, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },

  // Số tin nhắn hôm nay của 1 người trong 1 nhóm
  getUserCount(threadID, userID) {
    const data = MessageCount.getThreadData(threadID);
    return data.counts[userID] || 0;
  },

  // Danh sách tất cả threadID hiện có dữ liệu đếm (dùng cho job thông báo lúc 0h)
  getAllThreadIDs() {
    const all = readJson();
    return Object.keys(all);
  },

  // Reset thủ công đếm của 1 nhóm cho ngày hôm nay (dùng sau khi đã thông báo top lúc 0h)
  resetThread(threadID) {
    const all = readJson();
    all[threadID] = { day: today(), counts: {} };
    writeJson(all);
  },

  // Dùng cho job thông báo lúc 0h: lấy top của TỪNG nhóm dựa trên dữ liệu ngày
  // vừa kết thúc (đọc trực tiếp, không qua getThreadData nên không bị tự reset
  // theo ngày mới trước khi kịp đọc), sau đó reset toàn bộ về ngày mới trống.
  // Trả về mảng { threadID, top: [{userID, count}] } - chỉ gồm nhóm có dữ liệu.
  snapshotAndResetAll(limit = 10) {
    const all = readJson();
    const result = [];
    for (const threadID of Object.keys(all)) {
      const record = all[threadID];
      const counts = (record && record.counts) || {};
      const top = Object.entries(counts)
        .map(([userID, count]) => ({ userID, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
      if (top.length) result.push({ threadID, top });
      all[threadID] = { day: today(), counts: {} };
    }
    writeJson(all);
    return result;
  }
};

module.exports = { MessageCount };
