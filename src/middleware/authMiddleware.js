const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // must include role
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: 'Forbidden: insufficient permission' });
    }
    next();
  };
};

// This middleware identifies the user if a token exists, but doesn't block them if it doesn't.
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // Now the controller knows it's an Admin
    } catch (error) {
      // If the token is expired or fake, we just ignore it and treat them as a Guest
      req.user = null;
    }
  } else {
    req.user = null; // No token? No problem, you're a Guest.
  }
  next();
};

module.exports = { authenticate, authorize, optionalAuthenticate };