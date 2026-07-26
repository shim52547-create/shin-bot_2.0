const logger = require("../utils/log");

module.exports = function ({ api }) {
  return async function handleEvent(event) {
    try {
      if (!event || !event.logMessageType) return;

      for (const [name, evt] of global.client.events) {
        if (evt.config?.eventType && !evt.config.eventType.includes(event.logMessageType)) continue;
        await evt.run({ api, event }).catch(err => {
          logger.error(`Lỗi ở event "${name}": ${err.message}`, "EVENT");
        });
      }
    } catch (err) {
      logger.error(err.stack || err.message || String(err), "EVENT_HANDLER");
    }
  };
};
