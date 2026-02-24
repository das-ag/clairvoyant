import { NextResponse } from 'next/server';
import { readdirSync, existsSync } from 'fs';
import path from 'path';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ problem: string }> }
) {
  const { problem } = await params;
  const dir = path.join(process.cwd(), 'data', 'problems', problem, 'cases');
  if (!existsSync(dir)) {
    return NextResponse.json('Problem name not found.', { status: 404 });
  }
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.txt') || f.endsWith('.js'))
    .map(f => f.replace(/\.(txt|js)$/, ''));
  return NextResponse.json(files);
}
