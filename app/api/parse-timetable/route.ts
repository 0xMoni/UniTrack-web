import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Gemini API key not configured on the server' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { image, mimeType, subjectCodes } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image is required' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `You are analyzing a college/university timetable image. Extract the weekly schedule.

Known subject codes from the student's attendance data: ${JSON.stringify(subjectCodes)}

Instructions:
- Identify which days (Monday through Saturday) have which subjects
- Match subjects to the known codes above. If a cell in the timetable contains text that partially matches a known code or name, use the known code.
- If a subject in the image doesn't match any known code, skip it.
- A subject can appear multiple times on the same day (e.g. 2-hour labs).
- Only include a subject code ONCE per day, even if it appears in multiple time slots.

Return ONLY a JSON object in this exact format, no markdown, no explanation:
{"0":["CODE1","CODE2"],"1":["CODE3"],"2":[],"3":["CODE1"],"4":["CODE2","CODE3"],"5":[]}

Where keys are: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday
Values are arrays of subject codes from the known list above.
If a day has no classes, use an empty array.`;

    const contentPayload = [
      prompt,
      {
        inlineData: {
          data: image,
          mimeType: mimeType || 'image/png',
        },
      },
    ];

    // Try models in order of preference, fall back on quota/rate errors
    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
    let text = '';
    let lastError: Error | null = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(contentPayload);
        text = result.response.text().trim();
        lastError = null;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message.toLowerCase();
        // Only retry on quota/rate limit errors, not on other errors
        if (msg.includes('quota') || msg.includes('rate') || msg.includes('429') || msg.includes('resource_exhausted')) {
          continue;
        }
        // For non-quota errors, throw immediately
        throw lastError;
      }
    }

    if (lastError) {
      return NextResponse.json(
        { success: false, error: 'AI service is temporarily unavailable. Please try again in a few minutes.' },
        { status: 503 }
      );
    }

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate structure
    const timetable: Record<number, string[]> = {};
    for (let i = 0; i <= 5; i++) {
      const key = String(i);
      if (Array.isArray(parsed[key])) {
        // Only keep codes that exist in the known list
        timetable[i] = parsed[key].filter((c: string) => subjectCodes.includes(c));
      } else {
        timetable[i] = [];
      }
    }

    return NextResponse.json({ success: true, timetable });
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Failed to parse timetable image';
    // Return a user-friendly message, not raw API errors
    const isQuota = raw.toLowerCase().includes('quota') || raw.toLowerCase().includes('rate');
    const message = isQuota
      ? 'AI service is temporarily unavailable. Please try again in a few minutes.'
      : 'Failed to parse timetable from the image. Please try a clearer photo.';
    return NextResponse.json(
      { success: false, error: message },
      { status: isQuota ? 503 : 500 }
    );
  }
}
