export interface Subject {
  name: string;
  code: string;
  attended: number;
  total: number;
  percentage: number;
  status: 'safe' | 'critical' | 'low' | 'no_data';
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
  // Term the subjects below belong to, as the ERP labels it (e.g. "Semester 5").
  // Optional because data cached before this field existed will not have it.
  semester?: string;
  // Every term the ERP returned, for diagnosing a wrong-semester result.
  availableTerms?: string[];
}

export interface FetchResponse {
  success: boolean;
  data?: AttendanceData;
  error?: string;
}

export type StatusFilter = 'all' | 'safe' | 'critical' | 'low' | 'no_data';

// Map of day (0=Mon..5=Sat) to array of subject codes in order
export type Timetable = Record<number, string[]>;
