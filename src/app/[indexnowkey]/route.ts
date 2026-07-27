import { NextRequest, NextResponse } from 'next/server';
import { INDEXNOW_KEY } from '@/lib/indexnow';

export async function GET(req: NextRequest, { params }: { params: { indexnowkey: string } }) {
  if (params.indexnowkey !== `${INDEXNOW_KEY}.txt`) {
    return new NextResponse('Not found', { status: 404 });
  }
  return new NextResponse(INDEXNOW_KEY, { headers: { 'Content-Type': 'text/plain' } });
}
