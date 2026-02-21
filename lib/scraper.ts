import { Subject, StudentInfo, AttendanceData } from './types';
import { calculateStatus } from './utils';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ScraperResult {
  success: boolean;
  data?: AttendanceData;
  error?: string;
}

interface SubjectApiResponse {
  subject: string;
  subjectCode: string;
  presentCount: string;
  absentCount: string;
  session: string;
  facultName: string;
  subjectCategory: string;
  stdAttPresentCount: number;
  stdAttAbsentCount: number;
  stdAttLeaveCount: number;
  termName: string;
}

interface AcademicInfoResponse {
  AcademicInfo: {
    courseName: string;
    rollNo: string;
    divisionName: string;
    academicBatch: string;
    semesterName: string;
  };
  hasAcademicInfo: boolean;
}

interface DetectedForm {
  action: string;
  method: string;
  usernameField: string;
  passwordField: string;
  hiddenFields: Record<string, string>;
}

// Simple cookie jar
class CookieJar {
  private cookies = new Map<string, string>();

  update(response: Response) {
    const setCookies = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      const nameValue = cookie.split(';')[0];
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx > 0) {
        const name = nameValue.substring(0, eqIdx);
        this.cookies.set(name, nameValue);
      }
    }
  }

  toString() {
    return Array.from(this.cookies.values()).join('; ');
  }
}

// Fetch with a per-request timeout (default 10s)
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// ─── Main entry point ────────────────────────────────────────────────

export async function scrapeAttendance(
  erpBase: string,
  username: string,
  password: string,
  threshold: number = 75
): Promise<ScraperResult> {
  erpBase = new URL(erpBase).origin;
  const jar = new CookieJar();

  // Strategy 1: Try JUNO ERP endpoints (fast, no Gemini cost)
  try {
    const junoResult = await tryJunoFlow(erpBase, jar, username, password, threshold);
    if (junoResult) return junoResult;
  } catch {
    // Not a JUNO ERP or JUNO flow failed — fall through to generic
  }

  // Strategy 2: Generic login + crawl + Gemini parse
  try {
    const genericResult = await tryGenericFlow(erpBase, new CookieJar(), username, password, threshold);
    if (genericResult) return genericResult;
  } catch {
    // Generic flow failed — fall through to error
  }

  return {
    success: false,
    error: 'Could not fetch attendance data. Your ERP portal may use a login flow we don\'t support yet.',
  };
}

// ─── Strategy 1: JUNO ERP ────────────────────────────────────────────

async function tryJunoFlow(
  erpBase: string,
  jar: CookieJar,
  username: string,
  password: string,
  threshold: number
): Promise<ScraperResult | null> {
  // Step 1: Check if this is a JUNO ERP by trying the login page
  let loginPage: Response;
  try {
    loginPage = await fetchWithTimeout(`${erpBase}/login.htm`, { cache: 'no-store' }, 10_000);
  } catch {
    return null; // not reachable or not JUNO — fall through to generic
  }

  // If login.htm doesn't exist, this isn't JUNO
  if (!loginPage.ok) return null;
  jar.update(loginPage);

  // Extract all hidden fields from the login form (CSRF tokens, session IDs, etc.)
  const hiddenFields: Record<string, string> = {};
  try {
    const loginHtml = await loginPage.text();
    // Find the form containing the password field
    const formMatch = loginHtml.match(/<form\b[^>]*>([\s\S]*?)<\/form>/gi);
    if (formMatch) {
      for (const form of formMatch) {
        if (/<input[^>]*type=["']password["']/i.test(form)) {
          const hiddenRegex = /<input[^>]*type=["']hidden["'][^>]*>/gi;
          let hMatch: RegExpExecArray | null;
          while ((hMatch = hiddenRegex.exec(form)) !== null) {
            const inp = hMatch[0];
            const nameM = inp.match(/name=["']([^"']+)["']/i);
            const valueM = inp.match(/value=["']([^"']*?)["']/i);
            if (nameM?.[1]) {
              hiddenFields[nameM[1]] = valueM?.[1] || '';
            }
          }
          break;
        }
      }
    }
  } catch { /* continue without hidden fields */ }

  // From here on, we're confident this is JUNO — return errors, don't fall through
  try {
    // Step 2: POST login credentials (URLSearchParams handles special chars properly)
    const loginBody = new URLSearchParams();
    loginBody.set('j_username', username);
    loginBody.set('j_password', password);
    for (const [k, v] of Object.entries(hiddenFields)) {
      loginBody.set(k, v);
    }

    const loginRes = await fetchWithTimeout(`${erpBase}/j_spring_security_check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': jar.toString(),
        'Referer': `${erpBase}/login.htm`,
      },
      body: loginBody.toString(),
      redirect: 'manual',
      cache: 'no-store',
    }, 15_000);
    jar.update(loginRes);

    const location = loginRes.headers.get('location') || '';
    const locationPath = location.startsWith('http') ? new URL(location).pathname : location;
    if (locationPath.includes('login') || locationPath.includes('error')) {
      return { success: false, error: 'Login failed — check your username and password' };
    }

    // Step 3: Follow redirect to dashboard
    const dashboardUrl = location.startsWith('/') ? `${erpBase}${location}` : `${erpBase}/home.htm`;
    const dashboard = await fetchWithTimeout(dashboardUrl, {
      headers: { 'Cookie': jar.toString() },
      cache: 'no-store',
    }, 10_000);
    jar.update(dashboard);

    if (!dashboard.ok) {
      return { success: false, error: 'Logged in but could not access the ERP dashboard' };
    }

    // Step 4: Run academic info, name parse, and speculative attendance fetch in parallel
    let studentName = 'Student';
    let rollNo = '';

    const dashHtml = await dashboard.text();

    // Speculative fetch: try getting attendance JSON directly (skips attendance page visit)
    const speculativeFetch = fetchWithTimeout(`${erpBase}/stu_getSubjectOnChangeWithSemId1.json`, {
      headers: { 'Cookie': jar.toString() },
      cache: 'no-store',
    }, 10_000).then(async (res) => {
      if (!res.ok) return null;
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data) && data.length > 0) return { data, text };
      } catch { /* not valid JSON */ }
      return null;
    }).catch(() => null);

    const academicFetch = fetchWithTimeout(`${erpBase}/stu_getAcademicInformationNew.json`, {
      headers: { 'Cookie': jar.toString() },
      cache: 'no-store',
    }, 8_000).then(async (res) => {
      if (!res.ok) return null;
      const academic: AcademicInfoResponse = await res.json();
      if (academic.hasAcademicInfo) return academic.AcademicInfo.rollNo || '';
      return null;
    }).catch(() => null);

    // Parse student name from dashboard HTML (instant, no network)
    try {
      const nameMatch = dashHtml.match(/studentName"?\s+value="([^"]+)"/i);
      if (nameMatch?.[1]) {
        studentName = nameMatch[1].replace(/\s+/g, ' ').trim();
      }
    } catch { /* ignore */ }

    const [speculativeResult, academicResult] = await Promise.all([speculativeFetch, academicFetch]);

    if (academicResult) rollNo = academicResult;

    let subjectData: SubjectApiResponse[];

    if (speculativeResult) {
      // Speculative fetch succeeded — skip attendance page visit
      subjectData = speculativeResult.data;
    } else {
      // Speculative fetch failed — fall back to visiting attendance page + retry
      try {
        const attendancePage = await fetchWithTimeout(`${erpBase}/studentCourseFileNew.htm?shwA=%2700A%27`, {
          headers: { 'Cookie': jar.toString() },
          cache: 'no-store',
        }, 8_000);
        jar.update(attendancePage);
      } catch { /* continue anyway */ }

      const subjectsRes = await fetchWithTimeout(`${erpBase}/stu_getSubjectOnChangeWithSemId1.json`, {
        headers: { 'Cookie': jar.toString() },
        cache: 'no-store',
      }, 10_000);

      if (!subjectsRes.ok) {
        return { success: false, error: 'Logged in but the ERP did not return attendance data — try again in a moment' };
      }

      const rawText = await subjectsRes.text();
      try {
        subjectData = JSON.parse(rawText);
      } catch {
        if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
          return { success: false, error: 'Login failed — check your username and password' };
        }
        return { success: false, error: 'ERP returned unexpected data — try again in a moment' };
      }
    }

    if (!Array.isArray(subjectData) || subjectData.length === 0) {
      return { success: false, error: 'No attendance data found — your ERP account may not have any attendance records yet' };
    }

    // Filter to latest semester
    const termNames = [...new Set(subjectData.map(s => s.termName))];
    const latestTerm = termNames[termNames.length - 1];
    const currentSemData = subjectData.filter(s => s.termName === latestTerm);

    const subjects: Subject[] = currentSemData.map((s) => {
      const attended = parseInt(s.presentCount) || s.stdAttPresentCount || 0;
      const absent = parseInt(s.absentCount) || s.stdAttAbsentCount || 0;
      const total = attended + absent;
      const percentage = total > 0
        ? Math.round((attended / total) * 10000) / 100
        : 0;

      return {
        name: s.subject,
        code: s.subjectCode,
        attended,
        total,
        percentage,
        status: calculateStatus(percentage, threshold, total),
      };
    });

    const student: StudentInfo = { name: studentName, usn: rollNo };

    return {
      success: true,
      data: {
        student,
        subjects,
        lastUpdated: new Date().toISOString(),
        threshold,
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, error: 'Your ERP server is not responding — it may be down or slow. Try again later.' };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `ERP connection error: ${message}` };
  }
}

// ─── Strategy 2: Generic login + crawl + Gemini ──────────────────────

async function tryGenericFlow(
  erpBase: string,
  jar: CookieJar,
  username: string,
  password: string,
  threshold: number
): Promise<ScraperResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null; // can't do generic without Gemini

  try {
    // Step 1: Fetch ERP base URL and detect login form
    const homeRes = await fetchWithTimeout(erpBase, {
      cache: 'no-store',
      redirect: 'follow',
    });
    jar.update(homeRes);
    const homeHtml = await homeRes.text();

    const form = detectLoginForm(homeHtml, erpBase);
    if (!form) {
      return { success: false, error: 'Could not detect a login form on the ERP page' };
    }

    // Step 2: Submit login
    const loginSuccess = await submitLogin(erpBase, form, username, password, jar);
    if (!loginSuccess) {
      return { success: false, error: 'Login failed — check your username and password' };
    }

    // Step 3: Get dashboard HTML after login
    const dashRes = await fetchWithTimeout(erpBase, {
      headers: { 'Cookie': jar.toString() },
      cache: 'no-store',
      redirect: 'follow',
    });
    jar.update(dashRes);
    const dashboardHtml = await dashRes.text();

    // Step 4: Find attendance page
    const attendanceHtml = await findAttendancePage(erpBase, dashboardHtml, jar);
    if (!attendanceHtml) {
      return { success: false, error: 'Logged in successfully but could not find an attendance page on this ERP' };
    }

    // Step 5: Parse with Gemini
    const subjects = await parseWithGemini(apiKey, attendanceHtml, threshold);
    if (!subjects || subjects.length === 0) {
      return { success: false, error: 'Could not extract attendance data from the ERP page' };
    }

    return {
      success: true,
      data: {
        student: { name: 'Student', usn: '' },
        subjects,
        lastUpdated: new Date().toISOString(),
        threshold,
      },
    };
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function detectLoginForm(html: string, baseUrl: string): DetectedForm | null {
  // Find all <form> blocks that contain a password input
  const formRegex = /<form\b[^>]*>([\s\S]*?)<\/form>/gi;
  let match: RegExpExecArray | null;

  while ((match = formRegex.exec(html)) !== null) {
    const formTag = match[0];
    const formBody = match[1];

    // Must have a password field
    if (!/<input[^>]*type=["']password["'][^>]*>/i.test(formBody)) continue;

    // Extract action
    const actionMatch = formTag.match(/<form[^>]*action=["']([^"']+)["']/i);
    let action = actionMatch?.[1] || '';

    // Resolve relative action URLs
    if (action && !action.startsWith('http')) {
      if (action.startsWith('/')) {
        action = new URL(action, baseUrl).href;
      } else {
        action = new URL(action, baseUrl).href;
      }
    }
    if (!action) action = baseUrl;

    // Extract method
    const methodMatch = formTag.match(/<form[^>]*method=["']([^"']+)["']/i);
    const method = (methodMatch?.[1] || 'POST').toUpperCase();

    // Find password field name
    const pwMatch = formBody.match(/<input[^>]*type=["']password["'][^>]*name=["']([^"']+)["'][^>]*>/i)
      || formBody.match(/<input[^>]*name=["']([^"']+)["'][^>]*type=["']password["'][^>]*>/i);
    const passwordField = pwMatch?.[1] || 'password';

    // Find username field: the text/email input that isn't hidden and isn't the password
    let usernameField = 'username';
    const inputRegex = /<input[^>]*>/gi;
    let inputMatch: RegExpExecArray | null;
    while ((inputMatch = inputRegex.exec(formBody)) !== null) {
      const inp = inputMatch[0];
      const typeMatch = inp.match(/type=["']([^"']+)["']/i);
      const type = typeMatch?.[1]?.toLowerCase() || 'text';
      if (type === 'hidden' || type === 'password' || type === 'submit' || type === 'button' || type === 'checkbox' || type === 'radio' || type === 'image') continue;
      const nameMatch = inp.match(/name=["']([^"']+)["']/i);
      if (nameMatch?.[1]) {
        usernameField = nameMatch[1];
        break;
      }
    }

    // Collect hidden fields (CSRF tokens, viewstate, etc.)
    const hiddenFields: Record<string, string> = {};
    const hiddenRegex = /<input[^>]*type=["']hidden["'][^>]*>/gi;
    let hiddenMatch: RegExpExecArray | null;
    while ((hiddenMatch = hiddenRegex.exec(formBody)) !== null) {
      const inp = hiddenMatch[0];
      const nameM = inp.match(/name=["']([^"']+)["']/i);
      const valueM = inp.match(/value=["']([^"']*?)["']/i);
      if (nameM?.[1]) {
        hiddenFields[nameM[1]] = valueM?.[1] || '';
      }
    }

    return { action, method, usernameField, passwordField, hiddenFields };
  }

  return null;
}

async function submitLogin(
  erpBase: string,
  form: DetectedForm,
  username: string,
  password: string,
  jar: CookieJar
): Promise<boolean> {
  const body = new URLSearchParams();
  body.set(form.usernameField, username);
  body.set(form.passwordField, password);
  for (const [k, v] of Object.entries(form.hiddenFields)) {
    body.set(k, v);
  }

  const res = await fetchWithTimeout(form.action, {
    method: form.method,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': jar.toString(),
    },
    body: body.toString(),
    redirect: 'manual',
    cache: 'no-store',
  }, 20_000);
  jar.update(res);

  // Follow redirects manually to collect cookies
  const location = res.headers.get('location');
  if (location) {
    const redirectUrl = location.startsWith('http') ? location : new URL(location, erpBase).href;
    const redirectPath = new URL(redirectUrl).pathname.toLowerCase();

    // If redirected back to login or error page, login failed
    if (redirectPath.includes('login') || redirectPath.includes('error') || redirectPath.includes('failed')) {
      return false;
    }

    const followRes = await fetchWithTimeout(redirectUrl, {
      headers: { 'Cookie': jar.toString() },
      cache: 'no-store',
      redirect: 'follow',
    });
    jar.update(followRes);
  }

  // If no redirect and response is 2xx, check if the page still looks like a login page
  if (!location && res.status >= 200 && res.status < 400) {
    // Re-fetch the base to see if we're logged in
    const checkRes = await fetchWithTimeout(erpBase, {
      headers: { 'Cookie': jar.toString() },
      cache: 'no-store',
      redirect: 'follow',
    });
    jar.update(checkRes);
    const checkHtml = await checkRes.text();
    // If there's still a password field, login probably failed
    if (/<input[^>]*type=["']password["'][^>]*>/i.test(checkHtml)) {
      return false;
    }
  }

  return true;
}

const ATTENDANCE_KEYWORDS = /attend|present|absent|report|lecture|class.*report/i;

const COMMON_ATTENDANCE_PATHS = [
  '/attendance',
  '/studentAttendance',
  '/student/attendance',
  '/student-attendance',
  '/stu/attendance',
  '/my-attendance',
  '/viewAttendance',
  '/attendanceReport',
  '/attendance-report',
  '/student/attendanceReport',
];

async function findAttendancePage(
  erpBase: string,
  dashboardHtml: string,
  jar: CookieJar
): Promise<string | null> {
  const candidates: { url: string; score: number; html: string }[] = [];

  // Collect all candidate URLs first
  const allUrls: string[] = [];
  const seenUrls = new Set<string>();

  // Extract attendance-related links from dashboard
  const linkRegex = /<a[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkRegex.exec(dashboardHtml)) !== null) {
    const href = linkMatch[1];
    const text = linkMatch[2].replace(/<[^>]*>/g, '').trim();

    if (!ATTENDANCE_KEYWORDS.test(href) && !ATTENDANCE_KEYWORDS.test(text)) continue;

    const fullUrl = href.startsWith('http') ? href : new URL(href, erpBase).href;
    if (seenUrls.has(fullUrl)) continue;
    seenUrls.add(fullUrl);
    allUrls.push(fullUrl);
  }

  // Add common paths
  for (const path of COMMON_ATTENDANCE_PATHS) {
    const url = `${erpBase}${path}`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    allUrls.push(url);
  }

  // Fetch all candidate URLs in parallel batches of 5
  const BATCH_SIZE = 5;
  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    const batch = allUrls.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const res = await fetchWithTimeout(url, {
          headers: { 'Cookie': jar.toString() },
          cache: 'no-store',
          redirect: 'follow',
        }, 10_000);
        jar.update(res);
        if (!res.ok) return null;
        const html = await res.text();
        const score = scoreAttendanceContent(html);
        return score > 0 ? { url, score, html } : null;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        candidates.push(result.value);
      }
    }
  }

  // Also check dashboard itself — some ERPs show attendance on the main page
  const dashScore = scoreAttendanceContent(dashboardHtml);
  if (dashScore > 0) {
    candidates.push({ url: erpBase, score: dashScore, html: dashboardHtml });
  }

  if (candidates.length === 0) return null;

  // Return the page with the highest attendance-content score
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].html;
}

function scoreAttendanceContent(html: string): number {
  let score = 0;
  const lower = html.toLowerCase();

  // Table with attendance data is a strong signal
  if (/<table/i.test(html)) score += 2;

  // Count attendance-related keywords
  const keywords = ['attendance', 'present', 'absent', 'total classes', 'total lectures', 'percentage', 'subject'];
  for (const kw of keywords) {
    const matches = lower.split(kw).length - 1;
    score += Math.min(matches, 5); // cap per keyword
  }

  return score;
}

async function parseWithGemini(
  apiKey: string,
  html: string,
  threshold: number
): Promise<Subject[] | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Trim HTML to avoid exceeding token limits — keep first 60k chars
  const trimmedHtml = html.length > 60000 ? html.substring(0, 60000) : html;

  const prompt = `You are analyzing an HTML page from a university ERP system that shows student attendance data.

Extract ALL subjects with their attendance information from this HTML.

For each subject, extract:
- name: the subject/course name
- code: the subject/course code (if available, otherwise use "")
- attended: number of classes/lectures attended (present count)
- total: total number of classes/lectures held

Return ONLY a JSON array, no markdown, no explanation. Example format:
[{"name":"Mathematics","code":"MA101","attended":25,"total":30},{"name":"Physics","code":"PH102","attended":20,"total":28}]

If you cannot find any attendance data, return an empty array: []

HTML content:
${trimmedHtml}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Extract JSON from response
  let jsonStr = text;
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  // Map to Subject type with validation
  const subjects: Subject[] = [];
  for (const item of parsed) {
    const attended = typeof item.attended === 'number' ? item.attended : parseInt(item.attended) || 0;
    const total = typeof item.total === 'number' ? item.total : parseInt(item.total) || 0;
    if (total <= 0) continue; // skip entries with no class data

    const percentage = Math.round((attended / total) * 10000) / 100;

    subjects.push({
      name: String(item.name || 'Unknown'),
      code: String(item.code || ''),
      attended,
      total,
      percentage,
      status: calculateStatus(percentage, threshold, total),
    });
  }

  return subjects.length > 0 ? subjects : null;
}
