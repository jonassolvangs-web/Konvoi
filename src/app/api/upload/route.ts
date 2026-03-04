import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string; // 'before' | 'after'
    const unitId = formData.get('unitId') as string;

    if (!file || !type || !unitId) {
      return NextResponse.json({ error: 'Mangler fil, type eller unitId' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Kun JPEG, PNG og WebP er tillatt' }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Maks filstørrelse er 5MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${unitId}-${type}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'work-orders');

    await mkdir(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, fileName), buffer);

    const url = `/uploads/work-orders/${fileName}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    if (error.message === 'Ikke autentisert') {
      return NextResponse.json({ error: 'Ikke autentisert' }, { status: 401 });
    }
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Opplasting feilet' }, { status: 500 });
  }
}
