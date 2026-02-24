import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ problem: string; caseId: string }> }
) {
  const { problem, caseId } = await params;
  const dir = path.join(process.cwd(), 'data', 'problems', problem, 'cases');

  for (const ext of ['.txt', '.js']) {
    const file = path.join(dir, `${caseId}${ext}`);
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf-8');
      return NextResponse.json(content);
    }
  }

  return NextResponse.json('Problem or case name not found.', { status: 404 });
}
