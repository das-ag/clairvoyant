import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ problem: string; algorithm: string }> }
) {
  const { problem, algorithm } = await params;
  const file = path.join(process.cwd(), 'data', 'problems', problem, 'algorithms', `${algorithm}.js`);
  if (!existsSync(file)) {
    return NextResponse.json('Problem or algorithm name not found.', { status: 404 });
  }
  const content = readFileSync(file, 'utf-8');
  return NextResponse.json(content);
}
