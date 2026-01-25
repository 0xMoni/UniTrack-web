import { NextRequest, NextResponse } from 'next/server';
import { getDemoData } from '@/lib/scraper';
import { FetchResponse } from '@/lib/types';

export async function POST(request: NextRequest): Promise<NextResponse<FetchResponse>> {
  try {
    const body = await request.json();
    const { erpUrl, username, password, threshold = 75, demo = false } = body;

    // Return demo data if requested
    if (demo) {
      return NextResponse.json({
        success: true,
        data: getDemoData(threshold),
      });
    }

    // Validate required fields
    if (!erpUrl || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
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

    // Note: Playwright scraping is disabled in this API route for Vercel deployment
    // as Playwright requires specific configuration for serverless environments.
    // For production, consider using:
    // 1. Browserless.io or similar browser-as-a-service
    // 2. A separate backend service for scraping
    // 3. The demo mode for testing

    // For now, return an error suggesting demo mode
    return NextResponse.json({
      success: false,
      error: 'Live ERP scraping is not available in this deployment. Use demo mode to test the interface, or deploy with a browser service like Browserless.io for production use.',
    });

    // Uncomment below for local development with Playwright installed:
    // const { scrapeAttendance } = await import('@/lib/scraper');
    // const result = await scrapeAttendance(erpUrl, username, password, threshold);
    // return NextResponse.json(result);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
