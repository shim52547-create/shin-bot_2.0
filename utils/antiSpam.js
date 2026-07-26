const { Users } = require("./database");

const NUM = 5;     // spam quá NUM-1 lần trong TIME giây -> ban ở lần thứ NUM
const TIME = 120;  // giây

const state = new Map(); // userID -> { timeStart, count }

const AntiSpam = {
  NUM, TIME,

  isBanned(userID) {
    return !!Users.get(userID).banned;
  },

  // Gọi mỗi khi user gõ 1 lệnh có prefix. Trả về true nếu vừa bị ban ở lượt này.
  hit(userID) {
    const now = Date.now();
    const rec = state.get(userID);

    if (!rec || rec.timeStart + TIME * 1000 <= now) {
      state.set(userID, { timeStart: now, count: 1 });
      return false;
    }

    rec.count++;
    if (rec.count >= NUM) {
      state.set(userID, { timeStart: now, count: 0 });
      Users.set(userID, {
        banned: true,
        banReason: `spam bot ${NUM} lần/${TIME}s`,
        banDate: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      });
      return true;
    }
    return false;
  }
};

module.exports = { AntiSpam };
