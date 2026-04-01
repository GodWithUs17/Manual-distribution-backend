const jwt = require('jsonwebtoken');

const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, role: user.role, name: user.name }, // Include name in the token payload
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );
};

module.exports = {
    generateToken
};