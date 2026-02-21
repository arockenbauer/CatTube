import xss from 'xss';

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style']
};

export function sanitize(input) {
  if (typeof input === 'string') {
    return xss(input, xssOptions);
  }
  if (Array.isArray(input)) {
    return input.map(sanitize);
  }
  if (input && typeof input === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitize(value);
    }
    return sanitized;
  }
  return input;
}

export function sanitizeMiddleware(req, res, next) {
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  next();
}
