import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const IMPORT_KEY = 'turbo-import-2026';

export async function POST(req: NextRequest) {
  const data = await req.json();

  if (data.key !== IMPORT_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const updates: { chairmanName: string; birthYear: string }[] = data.updates || [];

  if (!updates.length) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  let updated = 0;
  let skipped = 0;

  for (const { chairmanName, birthYear } of updates) {
    if (!chairmanName || !birthYear) {
      skipped++;
      continue;
    }

    const result = await prisma.organization.updateMany({
      where: {
        chairmanName,
        OR: [
          { chairmanBirthNumber: null },
          { chairmanBirthNumber: '' },
        ],
      },
      data: {
        chairmanBirthNumber: birthYear,
      },
    });

    updated += result.count;
    if (result.count === 0) skipped++;
  }

  return NextResponse.json({ ok: true, updated, skipped });
}
