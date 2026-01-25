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

export interface LoginCredentials {
  erpUrl: string;
  username: string;
  password: string;
}

export interface FetchResponse {
  success: boolean;
  data?: AttendanceData;
  error?: string;
}

export type StatusFilter = 'all' | 'safe' | 'critical' | 'low';
