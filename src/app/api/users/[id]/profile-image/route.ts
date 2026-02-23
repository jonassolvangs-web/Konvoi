import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'jpg';
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

    // Remove old avatar files for this user
    for (const ext of ['jpg', 'png', 'webp']) {
      const oldPath = path.join(UPLOAD_DIR, `${id}.${ext}`);
      if (existsSync(oldPath)) {
        await unlink(oldPath);
      }
    }

    const ext = getExtension(file.type);
    const fileName = `${id}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const profileImageUrl = `/uploads/avatars/${fileName}?v=${Date.now()}`;

    await prisma.user.update({
      where: { id },
      data: { profileImageUrl },
    });

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

    // Remove avatar files
    for (const ext of ['jpg', 'png', 'webp']) {
      const filePath = path.join(UPLOAD_DIR, `${id}.${ext}`);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
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
