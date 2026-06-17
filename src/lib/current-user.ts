import { auth } from '@clerk/nextjs/server'
import { prisma } from './prisma'

/**
 * Resolves the VaultTrip `User` row for the currently authenticated Clerk
 * session. Returns `null` when there is no session or no matching user row
 * (e.g. the Clerk webhook has not yet created the user). API route handlers
 * should treat a `null` result as a 401.
 */
export async function getCurrentUser(): Promise<{ id: string } | null> {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })

  return user
}
