import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    await requireAuth();
    const { channelId } = await params;

    const messages = await prisma.chatMessage.findMany({
      where: { channelId },
      include: {
        sender: { select: { id: true, name: true, roles: true, profileImageUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    const parsed = messages.map((m) => ({
      ...m,
      sender: { ...m.sender, roles: typeof m.sender.roles === 'string' ? JSON.parse(m.sender.roles) : m.sender.roles },
    }));

    return NextResponse.json({ messages: parsed });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  try {
    const session = await requireAuth();
    const userId = (session.user as any).id;
    const { channelId } = await params;

    const { content, organizationId } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Innhold kan ikke vaere tomt' }, { status: 400 });
    }

    // Determine channel type
    const channelType = organizationId ? 'organization' : 'direct';

    const message = await prisma.chatMessage.create({
      data: {
        channelType,
        channelId,
        senderId: userId,
        organizationId: organizationId || null,
        content: content.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, roles: true, profileImageUrl: true } },
      },
    });

    const parsedMsg = {
      ...message,
      sender: { ...message.sender, roles: typeof message.sender.roles === 'string' ? JSON.parse(message.sender.roles) : message.sender.roles },
    };
    return NextResponse.json({ message: parsedMsg }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
