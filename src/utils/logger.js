const logger = {
  format(level, message, meta) {
    const base = { ts: new Date().toISOString(), level, message };
    if (meta) base.meta = meta;
    return JSON.stringify(base);
  },
  info(message, meta) {
    console.log(this.format('info', message, meta));
  },
  warn(message, meta) {
    console.warn(this.format('warn', message, meta));
  },
  error(message, meta) {
    console.error(this.format('error', message, meta));
  }
};

logger.child = (childMeta) => ({
  info: (message, meta) => logger.info(message, Object.assign({}, childMeta, meta)),
  warn: (message, meta) => logger.warn(message, Object.assign({}, childMeta, meta)),
  error: (message, meta) => logger.error(message, Object.assign({}, childMeta, meta)),
});

module.exports = logger;
