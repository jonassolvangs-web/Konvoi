import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(_req: NextRequest) {
  try {
    const videoPath = path.join(process.cwd(), 'demo-turbo-full.mp4');
    const buffer = await readFile(videoPath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': 'inline; filename="turbo-demo.mp4"',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Video ikke funnet' }, { status: 404 });
  }
}
