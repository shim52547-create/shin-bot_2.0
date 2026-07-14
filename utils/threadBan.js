const fs = require("fs-extra");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE = path.join(DATA_DIR, "threadBanned.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(FILE)) fs.writeJsonSync(FILE, {});

function readAll() {
  try { return fs.readJsonSync(FILE); } catch (e) { return {}; }
}
function writeAll(all) {
  fs.writeJsonSync(FILE, all, { spaces: 2 });
}

const ThreadBan = {
  isBanned(threadID) {
    return !!readAll()[threadID];
  },
  get(threadID) {
    return readAll()[threadID] || null;
  },
  ban(threadID, reason) {
    const all = readAll();
    all[threadID] = { reason: reason || null, dateAdded: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) };
    writeAll(all);
  },
  unban(threadID) {
    const all = readAll();
    delete all[threadID];
    writeAll(all);
  },
  getAll() {
    return readAll();
  }
};

module.exports = { ThreadBan };
