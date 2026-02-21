import { NextRequest, NextResponse } from 'next/server';
import { FetchResponse } from '@/lib/types';
import { scrapeAttendance } from '@/lib/scraper';

export const maxDuration = 60;

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

    // Race between scraper and a 30s timeout
    const result = await Promise.race([
      scrapeAttendance(erpUrl, username, password, threshold),
      new Promise<FetchResponse>((_, reject) =>
        setTimeout(() => reject(new Error('ERP server took too long to respond. Try again later.')), 30_000)
      ),
    ]);

    return NextResponse.json(result);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
