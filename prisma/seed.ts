import { PrismaClient, TripType, RequiredLevel, ChecklistStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.upsert({
    where: { clerkId: 'seed_user_001' },
    update: {},
    create: {
      clerkId: 'seed_user_001',
      email: 'demo@vaulttrip.com',
      nationality: 'IN',
    },
  })

  const trip = await prisma.trip.upsert({
    where: { id: 'seed_trip_001' },
    update: {},
    create: {
      id: 'seed_trip_001',
      userId: user.id,
      name: 'Thailand Adventure',
      origin: 'IN',
      destination: 'TH',
      departureDate: new Date('2025-03-15'),
      returnDate: new Date('2025-03-28'),
      tripType: TripType.TOURISM,
    },
  })

  await prisma.checklistItem.createMany({
    data: [
      {
        tripId: trip.id,
        label: 'Valid Passport (6 months validity)',
        description: 'Passport must be valid for at least 6 months beyond your return date.',
        required: RequiredLevel.REQUIRED,
        status: ChecklistStatus.PENDING,
      },
      {
        tripId: trip.id,
        label: 'Travel Insurance',
        description: 'Covers medical emergencies and trip cancellation.',
        required: RequiredLevel.RECOMMENDED,
        status: ChecklistStatus.PENDING,
      },
      {
        tripId: trip.id,
        label: 'Hotel Booking Confirmation',
        required: RequiredLevel.REQUIRED,
        status: ChecklistStatus.PENDING,
      },
      {
        tripId: trip.id,
        label: 'Return Ticket',
        required: RequiredLevel.REQUIRED,
        status: ChecklistStatus.PENDING,
      },
    ],
    skipDuplicates: true,
  })

  console.log('Seed complete:', { user: user.email, trip: trip.name })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
