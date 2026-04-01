const prisma = require('../utils/prisma');
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const ExcelJS = require('exceljs');
const transporter = require('../utils/mailer');


const downloadManualPurchases = async (req, res) => {
    const { manualId, department, level } = req.query;

    if (!manualId) {
        return res.status(400).json({ message: "manualId query parameter is required" });
    }

    try {
        const purchases = await prisma.purchase.findMany({
            where: {
                manualId: Number(manualId),
                status: 'paid',
                ...(department && { department }),
                ...(level && { level: Number(level) })
            },
            include: {
                manual: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        if (purchases.length === 0) {
            return res.status(404).json({ message: 'No purchases found for the specified manual' });
        }

        // --- 1. Initialize Workbook & Worksheet ---
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Manual Purchases');

        // --- 2. Set Columns with Fixed Widths (Prevents Shrinking) ---
        worksheet.columns = [
            { header: 'Full Name', key: 'fullName', width: 30 },
            { header: 'Matric No', key: 'matricNo', width: 15 },
            { header: 'Department', key: 'department', width: 25 },
            { header: 'Level', key: 'level', width: 10 },
            { header: 'Manual Title', key: 'manualTitle', width: 45 },
            { header: 'Amount Paid', key: 'amount', width: 15 },
            { header: 'Ref', key: 'ref', width: 25 },
            { header: 'Purchase Date', key: 'date', width: 25 }
        ];

        // --- 3. Add Data to Rows ---
        purchases.forEach(purchase => {
            const dateStr = `${purchase.createdAt.toLocaleDateString('en-GB')} ${purchase.createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
            
            worksheet.addRow({
                fullName: purchase.fullName.toUpperCase(),
                matricNo: purchase.matricNo,
                department: purchase.department,
                level: `${purchase.level}L`,
                manualTitle: purchase.manual.title,
                amount: `N${Number(purchase.manual.price).toLocaleString()}`,
                ref: purchase.transactionRef,
                date: dateStr
            });
        });

        // --- 4. Format the Header (LAUTECH Style) ---
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF003366' } // Navy Blue
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        // --- 5. Final Response (XLSX Headers) ---
        res.setHeader(
            'Content-Type', 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition', 
            `attachment; filename="manual-purchases-${manualId}.xlsx"`
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Excel Generation Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// const downloadManualPurchases = async (req, res) => {
//     const { manualId, department, level } = req.query;

//     if (!manualId) {
//         return res.status(400).json({ message: "manualId query parameter is required" });
//     }

//     const purchases = await prisma.purchase.findMany({
//         where: {
//             manualId: Number(manualId),
//             status: 'paid',
//             ...(department && { department }),
//             ...(level && { level: Number(level) })
//         },
//         include: {
//             manual: true
//         },
//         orderBy: {
//             createdAt: 'desc'
//         }
//     });

//     if (purchases.length === 0) {
//         return res.status(404).json({ message: 'No purchases found for the specified manual' });
//     }

//     //CSV generation

//     const csvHeaders = 'Full Name,Matric No,Department,Level,Manual Title,Amount Paid,Transaction Reference,Purchase Date\n';
//     const csvRows = purchases.map(purchase => {
//         return `"${purchase.fullName}","${purchase.matricNo}","${purchase.department}","${purchase.level}","${purchase.manual.title}","${purchase.manual.price}","${purchase.transactionRef}","${purchase.createdAt.toLocaleDateString('en-GB')} ${purchase.createdAt.toLocaleTimeString('en-GB')}"`;
//     }).join('\n');
    
//     const csvContent = csvHeaders + csvRows;
//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader('Content-Disposition', `attachment; filename="manual-purchases-${manualId}.csv"`);
//     res.send(csvContent);
// };



const createStaff = async (req, res) => {
  // 1. Pull 'role' out of the request body along with other fields
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password required" });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Use the 'role' variable here instead of the string "staff"
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: role || "staff", // Defaults to staff if for some reason role is missing
      }
    });

    res.status(201).json({
      message: `${newUser.role} created successfully`,
      staff: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error("CREATE USER ERROR:", error);
    res.status(500).json({ message: "Failed to create user", error: error.message });
  }
};

//function of forget password for staff and super admin by admin and super admin


const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.user.update({
    where: { email },
    data: {
      resetToken: token,
      resetTokenExp: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
    },
  });

  const resetLink = `http://localhost:5173/reset-password/${token}`;

  await transporter.sendMail({
    to: email,
    subject: "Password Reset",
    html: `<p>Click below to reset password:</p>
           <a href="${resetLink}">${resetLink}</a>`,
  });

  res.json({ message: "Reset link sent to email" });
};

// funtion to reset password for staff and super admin by admin and super admin


const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExp: {
          gte: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetToken: null,
        resetTokenExp: null,
      },
    });

    res.json({ message: "Password reset successful" });

  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};



// Change this in your disableStaff function:
const disableStaff = async (req, res) => {
  const { userId } = req.params;
  try {
    await prisma.user.update({ // removed "const user ="
      where: { id: Number(userId) },
      data: { isActive: false },
    });

    res.json({ message: "Staff disabled successfully" }); // Send ONLY the message
  } catch (error) {
    console.error("DISABLE STAFF ERROR:", error);
    res.status(500).json({ message: "Failed to disable staff" });
  }
};

// Do the same for enableStaff:
const enableStaff = async (req, res) => {
  const { userId } = req.params;
  try {
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { isActive: true },
    });

    res.json({ message: "Staff enabled successfully" }); // Send ONLY the message
  } catch (error) {
    console.error("ENABLE STAFF ERROR:", error);
    res.status(500).json({ message: "Failed to enable staff" });
  }
};

const getAllStaff = async (req, res) => {
  try {
    // Removing the 'where' clause so you see all team members
    const staff = await prisma.user.findMany({
      where: {
        role: {
          in: ['staff', 'admin', 'super_admin'] // Shows all management levels
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true, // Make sure role is selected so the frontend can color-code it
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({ staff });
  } catch (error) {
    console.error("GET ALL STAFF ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    // 1. Safety Check: A Super Admin shouldn't be able to delete themselves
    if (req.user.id === Number(userId)) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    // 2. Perform the deletion
    await prisma.user.delete({
      where: { id: Number(userId) },
    });

    res.json({ message: "Account permanently deleted." });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    res.status(500).json({ message: "Failed to delete account. It might have linked records." });
  }
};


module.exports = {
  downloadManualPurchases,
  createStaff,
  deleteUser,
  forgotPassword,
  resetPassword,
  disableStaff,
  enableStaff,
  getAllStaff
};