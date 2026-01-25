import { chromium, Browser, Page } from 'playwright';
import { Subject, StudentInfo, AttendanceData } from './types';
import { calculateStatus } from './utils';

interface ScraperResult {
  success: boolean;
  data?: AttendanceData;
  error?: string;
}

// Common ERP selectors for different systems
const ERP_CONFIGS = {
  // Generic selectors that work with most ERPs
  generic: {
    usernameSelectors: [
      'input[name="username"]',
      'input[name="userid"]',
      'input[name="user"]',
      'input[name="login"]',
      'input[type="text"][id*="user"]',
      'input[type="text"][id*="login"]',
      '#username',
      '#userid',
      '#txtUserName',
      '#txtUserId',
    ],
    passwordSelectors: [
      'input[name="password"]',
      'input[name="passwd"]',
      'input[name="pass"]',
      'input[type="password"]',
      '#password',
      '#passwd',
      '#txtPassword',
    ],
    submitSelectors: [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Sign In")',
      'input[value="Login"]',
      'input[value="Sign In"]',
      '#btnLogin',
      '.login-btn',
    ],
  },
};

async function findAndFill(page: Page, selectors: string[], value: string): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.fill(value);
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function findAndClick(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        await element.click();
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function extractAttendanceData(page: Page, threshold: number): Promise<{ student: StudentInfo; subjects: Subject[] } | null> {
  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Try to find attendance table
  const tableSelectors = [
    'table[id*="attendance"]',
    'table[class*="attendance"]',
    'table[id*="grid"]',
    '.attendance-table',
    '#grdAttendance',
    'table.table',
    'table',
  ];

  let attendanceTable = null;
  for (const selector of tableSelectors) {
    const table = await page.$(selector);
    if (table) {
      // Check if this table looks like an attendance table
      const text = await table.textContent();
      if (text && (text.includes('Attended') || text.includes('attendance') || text.includes('Present') || text.includes('%'))) {
        attendanceTable = table;
        break;
      }
    }
  }

  // Extract student info
  const studentInfo: StudentInfo = {
    name: 'Student',
    usn: 'N/A',
  };

  // Try to find student name and USN
  const nameSelectors = [
    '#lblStudentName',
    '.student-name',
    '[id*="name"]',
    'span:has-text("Name")',
  ];

  const usnSelectors = [
    '#lblUSN',
    '#lblRegNo',
    '.student-usn',
    '[id*="usn"]',
    '[id*="regno"]',
  ];

  for (const selector of nameSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > 2) {
          studentInfo.name = text.trim();
          break;
        }
      }
    } catch {
      continue;
    }
  }

  for (const selector of usnSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > 2) {
          studentInfo.usn = text.trim();
          break;
        }
      }
    } catch {
      continue;
    }
  }

  // Extract attendance data from tables
  const subjects: Subject[] = [];

  // Get all tables and find the one with attendance data
  const tables = await page.$$('table');

  for (const table of tables) {
    const rows = await table.$$('tr');

    for (const row of rows) {
      const cells = await row.$$('td');
      if (cells.length >= 3) {
        const cellTexts = await Promise.all(
          cells.map(async (cell) => {
            const text = await cell.textContent();
            return text?.trim() || '';
          })
        );

        // Look for rows that have subject data (name, numbers, percentage)
        // Try to identify columns with attendance data
        let subjectName = '';
        let attended = 0;
        let total = 0;
        let percentage = 0;

        for (let i = 0; i < cellTexts.length; i++) {
          const text = cellTexts[i];

          // Check if it looks like a subject name (longer text, not a number)
          if (text.length > 5 && isNaN(Number(text.replace('%', '')))) {
            subjectName = text;
          }

          // Check for percentage
          if (text.includes('%') || (Number(text) >= 0 && Number(text) <= 100 && text.includes('.'))) {
            percentage = parseFloat(text.replace('%', ''));
          }

          // Check for attended/total pattern (e.g., "45/50" or separate columns)
          if (text.includes('/')) {
            const parts = text.split('/');
            if (parts.length === 2) {
              attended = parseInt(parts[0]) || 0;
              total = parseInt(parts[1]) || 0;
            }
          }
        }

        // If we found valid data, add the subject
        if (subjectName && (total > 0 || percentage > 0)) {
          if (total === 0 && percentage > 0) {
            // Estimate total if not available
            total = 100;
            attended = Math.round(percentage);
          }

          if (percentage === 0 && total > 0) {
            percentage = Math.round((attended / total) * 100 * 10) / 10;
          }

          subjects.push({
            name: subjectName,
            code: '',
            attended,
            total,
            percentage,
            status: calculateStatus(percentage, threshold),
          });
        }
      }
    }
  }

  if (subjects.length === 0) {
    return null;
  }

  return { student: studentInfo, subjects };
}

export async function scrapeAttendance(
  erpUrl: string,
  username: string,
  password: string,
  threshold: number = 75
): Promise<ScraperResult> {
  let browser: Browser | null = null;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Navigate to ERP
    await page.goto(erpUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Find and fill username
    const config = ERP_CONFIGS.generic;
    const usernameFilled = await findAndFill(page, config.usernameSelectors, username);
    if (!usernameFilled) {
      return { success: false, error: 'Could not find username field' };
    }

    // Find and fill password
    const passwordFilled = await findAndFill(page, config.passwordSelectors, password);
    if (!passwordFilled) {
      return { success: false, error: 'Could not find password field' };
    }

    // Click submit
    const submitted = await findAndClick(page, config.submitSelectors);
    if (!submitted) {
      return { success: false, error: 'Could not find login button' };
    }

    // Wait for navigation after login
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for login errors
    const pageContent = await page.content();
    const errorIndicators = ['invalid', 'incorrect', 'failed', 'error', 'wrong password'];
    const lowerContent = pageContent.toLowerCase();

    for (const indicator of errorIndicators) {
      if (lowerContent.includes(indicator) && lowerContent.includes('login')) {
        return { success: false, error: 'Login failed - Invalid credentials' };
      }
    }

    // Try to navigate to attendance page if not already there
    const attendanceLinks = [
      'a:has-text("Attendance")',
      'a[href*="attendance"]',
      'a:has-text("View Attendance")',
      '#lnkAttendance',
    ];

    for (const linkSelector of attendanceLinks) {
      try {
        const link = await page.$(linkSelector);
        if (link) {
          await link.click();
          await page.waitForLoadState('networkidle');
          break;
        }
      } catch {
        continue;
      }
    }

    // Extract attendance data
    const result = await extractAttendanceData(page, threshold);

    if (!result) {
      return { success: false, error: 'Could not extract attendance data. The ERP format may not be supported.' };
    }

    return {
      success: true,
      data: {
        student: result.student,
        subjects: result.subjects,
        lastUpdated: new Date().toISOString(),
        threshold,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Demo data for testing without actual ERP
export function getDemoData(threshold: number = 75): AttendanceData {
  const subjects: Subject[] = [
    { name: 'Data Structures & Algorithms', code: 'CS301', attended: 42, total: 45, percentage: 93.3, status: 'safe' },
    { name: 'Database Management Systems', code: 'CS302', attended: 38, total: 45, percentage: 84.4, status: 'safe' },
    { name: 'Computer Networks', code: 'CS303', attended: 35, total: 45, percentage: 77.8, status: 'critical' },
    { name: 'Operating Systems', code: 'CS304', attended: 34, total: 45, percentage: 75.6, status: 'critical' },
    { name: 'Software Engineering', code: 'CS305', attended: 30, total: 45, percentage: 66.7, status: 'low' },
    { name: 'Web Technologies', code: 'CS306', attended: 28, total: 45, percentage: 62.2, status: 'low' },
  ].map(s => ({ ...s, status: calculateStatus(s.percentage, threshold) }));

  return {
    student: {
      name: 'John Doe',
      usn: '1XX22CS001',
    },
    subjects,
    lastUpdated: new Date().toISOString(),
    threshold,
  };
}
