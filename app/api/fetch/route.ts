import { NextRequest, NextResponse } from 'next/server';
import { FetchResponse } from '@/lib/types';

export async function POST(request: NextRequest): Promise<NextResponse<FetchResponse>> {
  try {
    const body = await request.json();
    const { erpUrl, username, password, threshold = 75 } = body;

    if (!erpUrl || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'ERP URL, username and password are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(erpUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid ERP URL' },
        { status: 400 }
      );
    }

    const { scrapeAttendance } = await import('@/lib/scraper');
    const result = await scrapeAttendance(erpUrl, username, password, threshold);
    return NextResponse.json(result);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
