const prisma = require("../src/utils/prisma");
const bcrypt = require("bcrypt");

async function main() {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;

    if (!email || !password) {
        console.log('SEED: SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not provided - skipping admin seed');
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            name: 'Super Admin',
            email,
            passwordHash,
            role: 'super_admin',
        }
    });

    console.log('SEED: Super Admin user created/updated for', email);
}

main()
    .catch((err) => {
        console.error('SEED ERROR:', err);
    })
    .finally(() => prisma.$disconnect());