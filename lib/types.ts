export interface Subject {
  name: string;
  code: string;
  attended: number;
  total: number;
  percentage: number;
  status: 'safe' | 'critical' | 'low';
}

export interface StudentInfo {
  name: string;
  usn: string;
}

export interface AttendanceData {
  student: StudentInfo;
  subjects: Subject[];
  lastUpdated: string;
  threshold: number;
}

export interface FetchResponse {
  success: boolean;
  data?: AttendanceData;
  error?: string;
}

export type StatusFilter = 'all' | 'safe' | 'critical' | 'low';

// Map of day (0=Mon..5=Sat) to array of subject codes in order
export type Timetable = Record<number, string[]>;
