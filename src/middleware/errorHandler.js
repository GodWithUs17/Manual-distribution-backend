const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  const payload = {
    error: err.message || 'Internal Server Error',
    path: req ? req.originalUrl : undefined,
    method: req ? req.method : undefined,
    status,
  };

  logger.error('UnhandledError', Object.assign({}, payload, { stack: err.stack }));

  if (res.headersSent) return next(err);

  const body = { error: payload.error };
  if (process.env.NODE_ENV !== 'production') body.stack = err.stack;

  res.status(status).json(body);
};
