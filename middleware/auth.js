const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's an admin token
    if (decoded.isAdmin) {
      req.admin = decoded;
    }
    // Check if it's a bus token
    else if (decoded.busId) {
      req.bus = decoded;
    }
    // Check if it's a user token
    else if (decoded.userId) {
      req.user = decoded;
    }
    // If neither, throw error
    else {
      throw new Error();
    }

    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

module.exports = auth; 