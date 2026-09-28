import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function check() {
  const admin = await prisma.users.findFirst({
    where: { email: 'admin@hotel.com' },
    include: { user_roles: { include: { roles: true } } }
  });
  console.log('Admin user:', admin);

  if (admin) {
     const match = await bcrypt.compare('admin123', admin.passwordHash!);
     console.log('Password match admin123:', match);
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
