import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { env } from '@/env'

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.text()
  const headerPayload = headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET)
  let event: {
    type: string
    data: { id: string; email_addresses: Array<{ email_address: string }> }
  }

  try {
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event
  } catch (err) {
    logger.error({ err }, 'Clerk webhook verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'user.created') {
    const { id: clerkId, email_addresses } = event.data
    const email = email_addresses[0]?.email_address ?? ''
    await prisma.user.create({ data: { clerkId, email } })
    logger.info({ clerkId, email }, 'User created via webhook')
  }

  if (event.type === 'user.deleted') {
    const { id: clerkId } = event.data
    await prisma.user.deleteMany({ where: { clerkId } })
    logger.info({ clerkId }, 'User deleted via webhook')
  }

  return NextResponse.json({ received: true })
}
