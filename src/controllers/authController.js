const prisma = require("../utils/prisma");
const { generateToken } = require("../utils/jwt");
const { comparePassword } = require("../utils/hash");

const login = async (req, res) => {
   try {
   const { email, password } = req.body || {};

    if (!req.body) {
        return res.status(400).json({ message: "Request body is required" });
    }

    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }


    const user = await 
    prisma.user.findUnique({ where: { email } });

    if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated. Please contact support." });
    }
    
    const isMatch = await 
    comparePassword(password, user.passwordHash);

    if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
    }
 
// This updates the 'lastLogin' field to the current date and time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = generateToken(user);

    res.json({ token,
        user: { id: user.id,
        name: user.name,
        role: user.role
       }
    });
 } catch (error) {                // 3. CLOSE TRY & OPEN CATCH
    // This part runs ONLY if something above crashes
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error during login" });
    
  }; 
};     

module.exports = {
    login
};