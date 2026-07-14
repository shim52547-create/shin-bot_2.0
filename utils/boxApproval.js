const fs = require("fs-extra");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const APPROVED_FILE = path.join(DATA_DIR, "approvedThreads.json");
const PENDING_FILE = path.join(DATA_DIR, "pendingThreads.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(APPROVED_FILE)) fs.writeJsonSync(APPROVED_FILE, []);
if (!fs.existsSync(PENDING_FILE)) fs.writeJsonSync(PENDING_FILE, []);

function readList(file) {
  try {
    return fs.readJsonSync(file);
  } catch (e) {
    return [];
  }
}

function writeList(file, list) {
  fs.writeJsonSync(file, list, { spaces: 2 });
}

module.exports = {
  getApproved() {
    return readList(APPROVED_FILE);
  },
  getPending() {
    return readList(PENDING_FILE);
  },
  setApproved(list) {
    writeList(APPROVED_FILE, list);
  },
  setPending(list) {
    writeList(PENDING_FILE, list);
  },
  // Thêm 1 threadID vào hàng chờ duyệt (nếu chưa có ở cả 2 danh sách)
  addPending(threadID) {
    const approved = readList(APPROVED_FILE);
    const pending = readList(PENDING_FILE);
    if (approved.includes(threadID) || pending.includes(threadID)) return false;
    pending.push(threadID);
    writeList(PENDING_FILE, pending);
    return true;
  }
};
