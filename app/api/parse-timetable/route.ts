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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: image,
          mimeType: mimeType || 'image/png',
        },
      },
    ]);

    const text = result.response.text().trim();

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
    const message = error instanceof Error ? error.message : 'Failed to parse timetable image';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
