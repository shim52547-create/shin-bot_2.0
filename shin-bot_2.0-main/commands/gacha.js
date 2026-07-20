const fs = require("fs-extra");
const path = require("path");
const { Currencies } = require("../utils/currency");

const DATA_DIR = path.join(__dirname, "..", "data");
const INVENTORY_FILE = path.join(DATA_DIR, "gacha_inventory.json");

fs.ensureDirSync(DATA_DIR);
if (!fs.existsSync(INVENTORY_FILE)) fs.writeJsonSync(INVENTORY_FILE, {});

function readInventory() {
  try {
    return fs.readJsonSync(INVENTORY_FILE);
  } catch (e) {
    return {};
  }
}
function writeInventory(data) {
  fs.writeJsonSync(INVENTORY_FILE, data, { spaces: 2 });
}

const ROLL_COST = 100;

// rate: xác suất cộng dồn, item lưu name + emoji
const POOL = [
  { rarity: "Thường", emoji: "⚪", rate: 0.55, items: ["Cây Kẹo Mút", "Lá Bùa May Mắn", "Vé Số", "Bánh Mì"] },
  { rarity: "Hiếm", emoji: "🔵", rate: 0.28, items: ["Nhẫn Bạc", "Kiếm Gỗ", "Bùa Hộ Mệnh", "Đồng Hồ Cổ"] },
  { rarity: "Cực Hiếm", emoji: "🟣", rate: 0.12, items: ["Vương Miện Nhỏ", "Kiếm Bạc", "Ngọc Xanh"] },
  { rarity: "Huyền Thoại", emoji: "🟡", rate: 0.05, items: ["Vương Miện Vàng", "Kiếm Rồng", "Ngọc Rồng"] }
];

function rollOnce() {
  const r = Math.random();
  let acc = 0;
  for (const tier of POOL) {
    acc += tier.rate;
    if (r <= acc) {
      const item = tier.items[Math.floor(Math.random() * tier.items.length)];
      return { rarity: tier.rarity, emoji: tier.emoji, item };
    }
  }
  const last = POOL[POOL.length - 1];
  return { rarity: last.rarity, emoji: last.emoji, item: last.items[0] };
}

module.exports = {
  config: {
    name: "gacha",
    aliases: ["rutthe", "quaythe"],
    version: "1.0",
    role: 0,
    description: `Dùng ${ROLL_COST} xu để rút 1 thẻ ngẫu nhiên, độ hiếm từ Thường đến Huyền Thoại`,
    usage: "gacha | gacha kho",
    category: "Giải trí"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const sub = args[0]?.toLowerCase();
    const inventory = readInventory();

    if (sub === "kho" || sub === "inventory" || sub === "tui") {
      const myItems = inventory[senderID] || [];
      if (!myItems.length) return api.sendMessage('🎒 Kho đồ trống trơn. Gõ "gacha" để rút thẻ đầu tiên!', threadID, messageID);

      const counts = {};
      for (const it of myItems) counts[it] = (counts[it] || 0) + 1;
      const list = Object.entries(counts).map(([name, qty]) => `• ${name} x${qty}`).join("\n");
      return api.sendMessage(`🎒 KHO ĐỒ CỦA BẠN (${myItems.length} món)\n\n${list}`, threadID, messageID);
    }

    const balance = Currencies.getData(senderID).money;
    if (balance < ROLL_COST) {
      return api.sendMessage(`⚠️ Không đủ xu! Cần ${ROLL_COST} xu, bạn có ${balance} xu.`, threadID, messageID);
    }

    Currencies.decreaseMoney(senderID, ROLL_COST);
    const result = rollOnce();

    if (!inventory[senderID]) inventory[senderID] = [];
    inventory[senderID].push(result.item);
    writeInventory(inventory);

    const newBalance = Currencies.getData(senderID).money;

    return api.sendMessage(
      `🎰 QUAY GACHA...\n\n` +
      `${result.emoji} [${result.rarity}] ${result.item}\n\n` +
      `-${ROLL_COST} xu (số dư: ${newBalance})\n` +
      `Gõ "gacha kho" để xem toàn bộ vật phẩm đã có.`,
      threadID, messageID
    );
  }
};
