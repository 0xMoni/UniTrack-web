import { Subject, StudentInfo, AttendanceData } from './types';
import { calculateStatus } from './utils';

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

export async function scrapeAttendance(
  erpBase: string,
  username: string,
  password: string,
  threshold: number = 75
): Promise<ScraperResult> {
  // Normalize: extract just the origin (protocol + host) so users can paste any ERP page URL
  erpBase = new URL(erpBase).origin;
  const jar = new CookieJar();

  try {
    // Step 1: Get login page for initial session cookie
    const loginPage = await fetch(`${erpBase}/login.htm`, { cache: 'no-store' });
    jar.update(loginPage);

    // Step 2: POST login credentials
    const loginRes = await fetch(`${erpBase}/j_spring_security_check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': jar.toString(),
      },
      body: `j_username=${encodeURIComponent(username)}&j_password=${encodeURIComponent(password)}`,
      redirect: 'manual',
      cache: 'no-store',
    });
    jar.update(loginRes);

    // Check login result
    const location = loginRes.headers.get('location') || '';
    const locationPath = location.startsWith('http') ? new URL(location).pathname : location;
    if (locationPath.includes('login') || locationPath.includes('error')) {
      return { success: false, error: 'Login failed — check your username and password' };
    }

    // Step 3: Follow redirect to dashboard
    const dashboardUrl = location.startsWith('/') ? `${erpBase}${location}` : `${erpBase}/home.htm`;
    const dashboard = await fetch(dashboardUrl, {
      headers: { 'Cookie': jar.toString() },
      cache: 'no-store',
    });
    jar.update(dashboard);

    if (!dashboard.ok) {
      return { success: false, error: 'Could not access dashboard after login' };
    }

    // Step 4: Fetch academic info
    let studentName = 'Student';
    let rollNo = '';

    try {
      const academicRes = await fetch(`${erpBase}/stu_getAcademicInformationNew.json`, {
        headers: { 'Cookie': jar.toString() },
        cache: 'no-store',
      });

      if (academicRes.ok) {
        const academic: AcademicInfoResponse = await academicRes.json();
        if (academic.hasAcademicInfo) {
          rollNo = academic.AcademicInfo.rollNo || '';
        }
      }
    } catch { /* continue without academic info */ }

    // Get student name from dashboard HTML hidden input
    try {
      const dashHtml = await dashboard.text();
      const nameMatch = dashHtml.match(/studentName"?\s+value="([^"]+)"/i);
      if (nameMatch?.[1]) {
        studentName = nameMatch[1].replace(/\s+/g, ' ').trim();
      }
    } catch { /* ignore */ }

    // Step 5: Visit attendance page to set up session state
    try {
      const attendancePage = await fetch(`${erpBase}/studentCourseFileNew.htm?shwA=%2700A%27`, {
        headers: { 'Cookie': jar.toString() },
        cache: 'no-store',
      });
      jar.update(attendancePage);
    } catch { /* continue anyway */ }

    // Step 6: Fetch subject-wise attendance
    const subjectsRes = await fetch(`${erpBase}/stu_getSubjectOnChangeWithSemId1.json`, {
      headers: { 'Cookie': jar.toString() },
      cache: 'no-store',
    });

    if (!subjectsRes.ok) {
      return { success: false, error: 'Could not fetch attendance data from ERP' };
    }

    const subjectData: SubjectApiResponse[] = await subjectsRes.json();

    if (!Array.isArray(subjectData) || subjectData.length === 0) {
      return { success: false, error: 'No attendance data found for this semester' };
    }

    // The API returns all semesters. Filter to only the latest one using termName.
    const termNames = [...new Set(subjectData.map(s => s.termName))];
    const latestTerm = termNames[termNames.length - 1];
    const currentSemData = subjectData.filter(s => s.termName === latestTerm);

    // Step 7: Map API response to our Subject type
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
        status: calculateStatus(percentage, threshold),
      };
    });

    const student: StudentInfo = {
      name: studentName,
      usn: rollNo,
    };

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
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: `Error: ${message}` };
  }
}
