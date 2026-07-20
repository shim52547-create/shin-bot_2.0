const fs = require("fs-extra");
const path = require("path");

const { DATA_DIR } = require("./dataDir");
const THREADS_FILE = path.join(DATA_DIR, "threads.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(THREADS_FILE)) fs.writeJsonSync(THREADS_FILE, {});
if (!fs.existsSync(USERS_FILE)) fs.writeJsonSync(USERS_FILE, {});

function readJson(file) {
  try {
    return fs.readJsonSync(file);
  } catch (e) {
    return {};
  }
}

function writeJson(file, data) {
  fs.writeJsonSync(file, data, { spaces: 2 });
}

const Threads = {
  getAll() {
    return readJson(THREADS_FILE);
  },
  get(threadID) {
    const all = readJson(THREADS_FILE);
    return all[threadID] || { prefix: null, rules: "", nickNames: {} };
  },
  set(threadID, data) {
    const all = readJson(THREADS_FILE);
    all[threadID] = { ...Threads.get(threadID), ...data };
    writeJson(THREADS_FILE, all);
    return all[threadID];
  }
};

const Users = {
  getAll() {
    return readJson(USERS_FILE);
  },
  get(userID) {
    const all = readJson(USERS_FILE);
    return all[userID] || { name: "Unknown" };
  },
  set(userID, data) {
    const all = readJson(USERS_FILE);
    all[userID] = { ...Users.get(userID), ...data };
    writeJson(USERS_FILE, all);
    return all[userID];
  }
};

module.exports = { Threads, Users };
