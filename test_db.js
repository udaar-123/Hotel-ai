const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const bookings = await prisma.bookings.findMany({
    select: { id: true, roomId: true, checkInDate: true, checkOutDate: true, status: true }
  });
  console.log(bookings);
}
run();
