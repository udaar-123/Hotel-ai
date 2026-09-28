import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // ── Admin seed account ──────────────────────────────────────────────────────
  const adminEmail = 'admin@hotel.com'
  const existing = await prisma.users.findUnique({ where: { email: adminEmail } })

  if (!existing) {
    // 1. Create or find ADMIN role
    let role = await prisma.roles.findUnique({ where: { name: 'ADMIN' } })
    if (!role) {
      role = await prisma.roles.create({
        data: {
          id: crypto.randomUUID(),
          name: 'ADMIN'
        }
      })
    }

    // 2. Create the Admin User
    const passwordHash = await bcrypt.hash('admin123', 12)
    const admin = await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        email: adminEmail,
        passwordHash,
        name: 'Super Admin',
        updatedAt: new Date(),
        user_roles: {
          create: {
            id: crypto.randomUUID(),
            roleId: role.id
          }
        }
      }
    })
    console.log(`✅ Admin user created: ${admin.email}`)
  } else {
    console.log(`ℹ️  Admin user already exists: ${adminEmail}`)
  }

  console.log('Seed complete!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
