module.exports = {
  config: {
    name: "leave",
    eventType: ["log:unsubscribe"]
  },
  run: async ({ api, event }) => {
    if (!global.config.leaveEvent) return;
    const { threadID, logMessageData } = event;
    const leftID = logMessageData?.leftParticipantFbId;
    if (!leftID || leftID === api.getCurrentUserID()) return;
    api.sendMessage(`👋 Một thành viên (ID: ${leftID}) đã rời khỏi nhóm.`, threadID);
  }
};
