const prisma = require("../src/utils/prisma");
const bcrypt = require("bcrypt");

async function main() {
    const passwordHash = await bcrypt.hash("admin123", 10);

    await prisma.user.upsert({
        where: { email: 'admin@manual.com' },
        update: {},
        create: {
            name: 'Super Admin',
            email: 'admin@manual.com',
            passwordHash,
            role: 'super_admin',
        }
    });

    console.log("Super Admin user created/updated");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());