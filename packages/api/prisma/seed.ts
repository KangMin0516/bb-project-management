import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { hash } from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env['DATABASE_URL']!;
const adapter = new PrismaPg(connectionString);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env['ADMIN_EMAIL'] || 'admin@burningb.com';
  const password = process.env['ADMIN_PASSWORD'] || 'changeme123';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Heal any prior bad-state seed: the very first seed predated the explicit
    // status assignment below, so an existing admin row may still be PENDING.
    // Make sure the seeded admin is always ACTIVE + superuser.
    if (existing.status !== 'ACTIVE' || !existing.isSuperuser) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', isSuperuser: true },
      });
      console.log(`Admin user healed → ACTIVE + superuser: ${email}`);
    } else {
      console.log(`Admin user already exists: ${email}`);
    }
    return;
  }

  const passwordHash = await hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      passwordHash,
      isSuperuser: true,
      status: 'ACTIVE',
    },
  });

  console.log(`Admin user created: ${admin.email} (${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
