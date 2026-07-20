const ICONS = {
  "hệ thống": "⚙️",
  "giải trí": "🎮",
  "tiện ích": "🧰",
  "box chat": "💬",
  "kinh tế": "💰",
  "quản trị nhóm": "🛡️",
  "quản trị bot": "👑",
  "quản trị": "🛡️",
  "nhóm": "👥",
  "group": "👥",
  "không cần dấu lệnh": "⚡",
  "admin": "🔑",
  "general": "📂",
  "media": "🎬",
  "khác": "❔",
  "sức khỏe": "🩺",
  "game": "🕹️"
};
const DEFAULT_ICON = "📁";
const AUTO_UNSEND_MS = 90 * 1000;

function iconFor(cat) {
  return ICONS[cat.trim().toLowerCase()] || DEFAULT_ICON;
}

// Gom lệnh theo category, coi các category trùng tên (khác hoa/thường) là một
function buildCategories() {
  const commands = [...global.client.commands.values()];
  const map = new Map(); // key: tên category viết thường, value: { label, list: [] }

  for (const cmd of commands) {
    const raw = (cmd.config.category || "Khác").trim();
    const key = raw.toLowerCase();
    if (!map.has(key)) map.set(key, { label: raw, list: [] });
    map.get(key).list.push(cmd.config.name);
  }

  return [...map.values()]
    .map(c => ({ ...c, list: c.list.sort() }))
    .sort((a, b) => b.list.length - a.list.length); // nhiều lệnh hơn lên trước
}

function buildMenuText(categories, prefix) {
  const total = categories.reduce((sum, c) => sum + c.list.length, 0);

  let msg = "╔═══════════════════\n";
  msg += "║ 📋 DANH MỤC LỆNH\n";
  msg += "╚═══════════════════\n\n";

  categories.forEach((c, i) => {
    msg += `│ ${i + 1}. ${iconFor(c.label)} ${c.label} (${c.list.length} lệnh)\n`;
  });

  msg += "\n📊 Tổng: " + total + " lệnh\n";
  msg += "💬 Reply số để xem lệnh trong nhóm\n";
  msg += "📝 Nhập nhiều số cách nhau để xem nhiều nhóm\n";
  msg += `🎯 Hoặc: ${prefix}help [tên lệnh], hoặc ${prefix}help all để xem tất cả lệnh\n`;
  msg += `⏱️ Tự động gỡ sau ${Math.round(AUTO_UNSEND_MS / 1000)}s`;

  return msg;
}

function buildCategoryDetail(categories, numbers, prefix) {
  const valid = [...new Set(numbers)].filter(n => n >= 1 && n <= categories.length);
  if (!valid.length) return `⚠️ Số không hợp lệ. Vui lòng nhập từ 1 đến ${categories.length}.`;

  let msg = "";
  for (const n of valid) {
    const c = categories[n - 1];
    msg += `╭─ ${iconFor(c.label)} ${c.label} (${c.list.length} lệnh) ─╮\n`;
    msg += c.list.map(name => `${prefix}${name}`).join(", ") + "\n\n";
  }
  msg += `🎯 Gõ "${prefix}help [tên lệnh]" để xem chi tiết 1 lệnh.`;
  return msg.trim();
}

function buildAllText(categories, prefix) {
  let msg = `📋 TẤT CẢ LỆNH (prefix hiện tại: "${prefix}")\n\n`;
  for (const c of categories) {
    msg += `${iconFor(c.label)} ${c.label}:\n${c.list.map(name => prefix + name).join(", ")}\n\n`;
  }
  return msg.trim();
}

function parseNumbers(args) {
  const numbers = args.join(" ").split(/[\s,]+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
  return numbers;
}

module.exports = {
  config: {
    name: "help",
    aliases: ["menu", "h"],
    version: "2.0",
    role: 0,
    description: "Xem danh mục lệnh hoặc chi tiết 1 lệnh",
    usage: "help | help [tên lệnh] | help [số nhóm] | help all",
    category: "Hệ thống"
  },

  run: async ({ api, event, args }) => {
    const { threadID, messageID, senderID } = event;
    const prefix = global.config.PREFIX;
    const categories = buildCategories();

    // !help -> menu chính
    if (!args[0]) {
      const menuText = buildMenuText(categories, prefix);
      return api.sendMessage(menuText, threadID, (err, info) => {
        if (err || !info) return;
        global.client.handleReply.push({
          type: "help_menu",
          name: "help",
          author: senderID,
          messageID: info.messageID,
          categories
        });
        setTimeout(() => {
          api.unsendMessage(info.messageID).catch(() => {});
        }, AUTO_UNSEND_MS);
      }, messageID);
    }

    // !help all -> liệt kê hết
    if (args[0].toLowerCase() === "all") {
      return api.sendMessage(buildAllText(categories, prefix), threadID, messageID);
    }

    // !help 1 3 -> xem trực tiếp nhóm lệnh theo số, không cần reply
    if (args.every(a => /^[0-9,]+$/.test(a))) {
      const numbers = parseNumbers(args);
      return api.sendMessage(buildCategoryDetail(categories, numbers, prefix), threadID, messageID);
    }

    // !help <tên lệnh> -> chi tiết 1 lệnh
    const cmd = global.client.commands.get(args[0].toLowerCase());
    if (!cmd) return api.sendMessage(`❌ Không tìm thấy lệnh "${args[0]}".`, threadID, messageID);
    const c = cmd.config;
    const msg =
      `📌 Lệnh: ${c.name}\n` +
      `Alias: ${(c.aliases || []).join(", ") || "Không có"}\n` +
      `Mô tả: ${c.description || "Chưa có mô tả"}\n` +
      `Cách dùng: ${prefix}${c.usage || c.name}\n` +
      `Quyền: ${["Mọi người", "Quản trị viên nhóm", "Admin bot"][c.role || 0]}`;
    return api.sendMessage(msg, threadID, messageID);
  },

  handleReply: async ({ api, event, handleReply }) => {
    const { threadID, senderID, body } = event;
    if (handleReply.author !== senderID) return;

    const prefix = global.config.PREFIX;
    const numbers = parseNumbers((body || "").split(/\s+/));
    if (!numbers.length) return;

    return api.sendMessage(buildCategoryDetail(handleReply.categories, numbers, prefix), threadID);
  }
};
