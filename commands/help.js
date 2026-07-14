module.exports = {
  config: {
    name: "help",
    aliases: ["menu", "h"],
    version: "1.0",
    role: 0,
    description: "Xem danh sách lệnh hoặc chi tiết 1 lệnh",
    usage: "help [tên lệnh]",
    category: "Hệ thống"
  },
  run: async ({ api, event, args }) => {
    const { threadID, messageID } = event;
    const commands = [...global.client.commands.values()];

    if (args[0]) {
      const cmd = global.client.commands.get(args[0].toLowerCase());
      if (!cmd) return api.sendMessage(`❌ Không tìm thấy lệnh "${args[0]}".`, threadID, messageID);
      const c = cmd.config;
      const msg =
        `📌 Lệnh: ${c.name}\n` +
        `Alias: ${(c.aliases || []).join(", ") || "Không có"}\n` +
        `Mô tả: ${c.description || "Chưa có mô tả"}\n` +
        `Cách dùng: ${global.config.PREFIX}${c.usage || c.name}\n` +
        `Quyền: ${["Mọi người", "Quản trị viên nhóm", "Admin bot"][c.role || 0]}`;
      return api.sendMessage(msg, threadID, messageID);
    }

    const grouped = {};
    for (const cmd of commands) {
      const cat = cmd.config.category || "Khác";
      grouped[cat] = grouped[cat] || [];
      grouped[cat].push(cmd.config.name);
    }

    let msg = `📋 DANH SÁCH LỆNH (prefix hiện tại: "${global.config.PREFIX}")\n\n`;
    for (const cat in grouped) {
      msg += `━━ ${cat} ━━\n${grouped[cat].join(", ")}\n\n`;
    }
    msg += `Gõ "${global.config.PREFIX}help <tên lệnh>" để xem chi tiết.`;

    return api.sendMessage(msg, threadID, messageID);
  }
};
