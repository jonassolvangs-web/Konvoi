import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { profileImageUrl: true },
    });

    if (!user?.profileImageUrl) {
      return new NextResponse(null, { status: 404 });
    }

    // If it's a base64 data URL, serve as image
    if (user.profileImageUrl.startsWith('data:')) {
      const match = user.profileImageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!match) return new NextResponse(null, { status: 404 });

      const contentType = match[1];
      const buffer = Buffer.from(match[2], 'base64');

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Legacy: redirect to file URL
    return NextResponse.redirect(user.profileImageUrl);
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }

    const { id } = await params;

    if (session.user.id !== id) {
      return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Ingen fil lastet opp' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Ugyldig filtype. Bruk JPG, PNG eller WebP.' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Filen er for stor. Maks 2MB.' }, { status: 400 });
    }

    // Store as base64 in database
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    await prisma.user.update({
      where: { id },
      data: { profileImageUrl: dataUrl },
    });

    // Return a URL that serves the image via GET endpoint (not the base64 itself)
    const profileImageUrl = `/api/users/${id}/profile-image?v=${Date.now()}`;

    return NextResponse.json({ profileImageUrl });
  } catch {
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }

    const { id } = await params;

    if (session.user.id !== id) {
      return NextResponse.json({ error: 'Ingen tilgang' }, { status: 403 });
    }

    await prisma.user.update({
      where: { id },
      data: { profileImageUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Intern feil' }, { status: 500 });
  }
}
