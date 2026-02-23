import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;

    // Get all unique channels where this user has sent or received messages
    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId },
          // For direct messages, check if user ID is in channelId
          { channelType: 'direct', channelId: { contains: userId } },
        ],
      },
      select: {
        channelType: true,
        channelId: true,
        organizationId: true,
      },
      distinct: ['channelId'],
    });

    // Get org channels for orgs assigned to user
    const orgMessages = await prisma.chatMessage.findMany({
      where: {
        channelType: 'organization',
        organization: {
          OR: [
            { assignedToId: userId },
            { visits: { some: { userId } } },
            { workOrders: { some: { technicianId: userId } } },
          ],
        },
      },
      select: {
        channelType: true,
        channelId: true,
        organizationId: true,
      },
      distinct: ['channelId'],
    });

    const allChannels = [...messages, ...orgMessages];
    const uniqueChannels = allChannels.filter(
      (c, i, arr) => arr.findIndex((x) => x.channelId === c.channelId) === i
    );

    // Enrich channels with last message and details
    const channels = await Promise.all(
      uniqueChannels.map(async (ch) => {
        const lastMessage = await prisma.chatMessage.findFirst({
          where: { channelId: ch.channelId },
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { name: true } } },
        });

        let name = '';
        let avatar = '';

        if (ch.channelType === 'direct') {
          // Find the other user
          const otherUserId = ch.channelId.split('_').find((id) => id !== userId);
          if (otherUserId) {
            const otherUser = await prisma.user.findUnique({
              where: { id: otherUserId },
              select: { name: true },
            });
            name = otherUser?.name || 'Ukjent';
          }
        } else if (ch.channelType === 'organization' && ch.organizationId) {
          const org = await prisma.organization.findUnique({
            where: { id: ch.organizationId },
            select: { name: true },
          });
          name = org?.name || 'Ukjent sameie';
        }

        return {
          channelId: ch.channelId,
          channelType: ch.channelType,
          name,
          lastMessage: lastMessage?.content || '',
          lastMessageAt: lastMessage?.createdAt || null,
          lastSender: lastMessage?.sender?.name || '',
        };
      })
    );

    // Sort by last message
    channels.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    return NextResponse.json({ channels });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Chat channels error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
