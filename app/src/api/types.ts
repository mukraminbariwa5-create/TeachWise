/** platform = the TeachWise owner (approves schools). */
export type Role = 'platform' | 'admin' | 'teacher' | 'student';

export interface User {
  id: number;
  id_number: string;
  name: string;
  initials: string;
  username: string;
  email: string | null;
  role: Role;
  department: string | null;
  department_id?: number | null;
  /** For admins: "school" (everything) or "department" (dean / chairperson, own department only). */
  admin_scope?: 'school' | 'department' | null;
  section?: { id: number; label: string } | null;
  phone_number?: string | null;
}

/** A school as anyone can see it (school picker, join links). */
export interface PublicSchool {
  id: number;
  name: string;
  short_name: string | null;
  code: string;
  location: string | null;
  logo_url: string | null;
}

/** The signed-in person's school, with what the app needs to behave like that school's app. */
export interface SchoolInfo extends PublicSchool {
  status: 'pending' | 'active' | 'suspended';
  settings: {
    term_label: 'semester' | 'trimester' | 'quarter';
    peer_evaluation: boolean;
    min_responses: number;
    scale: string[];
    scale_fil: string[];
    support_email: string | null;
    dpo_email: string | null;
    setup_completed: boolean;
  };
}

export interface Person {
  id: number;
  name: string;
  initials: string;
  department: string | null;
}

export interface Period {
  id: number;
  name: string;
  type: 'student' | 'peer';
  opens_at: string;
  closes_at: string;
  is_open: boolean;
}

export interface StudentDashboard {
  student: User;
  period: Period | null;
  teachers: {
    offering_id: number;
    teacher: Person;
    subject: { code: string | null; name: string };
    schedule: string | null;
    status: 'pending' | 'completed';
  }[];
  subjects: { code: string | null; name: string; units: number }[];
  progress: { completed: number; total: number; percent: number };
}

export interface Question {
  id: number;
  category: string | null;
  text: string;
  type: 'rating' | 'text';
}

export interface EvaluationForm {
  offering: {
    id: number;
    subject: { id: number; code: string | null; name: string; units: number };
    section: string;
    schedule: string | null;
  };
  teacher: Person;
  period: Period | null;
  already_submitted: boolean;
  scale: Record<string, string>;
  questions: Question[];
}

export interface HistoryItem {
  id: number;
  teacher: Person;
  subject: { code: string | null; name: string } | null;
  period: string | null;
  overall_rating: number | null;
  submitted_at: string | null;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface WiseState {
  greeting: string;
  tip: string;
  suggestions: string[];
  messages: ChatMessage[];
}

// ---- Teacher

export interface Overall {
  average: number | null;
  responses: number;
}

export interface Criterion {
  question_id: number;
  category: string;
  text?: string;
  average: number;
  responses: number;
}

export interface TrendPoint {
  period_id: number;
  period: string;
  average: number;
  responses: number;
}

export interface Comment {
  id?: number;
  comment: string;
  rating: number | null;
  subject_code: string | null;
  period?: string | null;
  submitted_at: string | null;
}

export interface TeacherClass {
  id: number;
  subject: { id: number; code: string | null; name: string; units: number };
  section: string;
  schedule: string | null;
  responses: number;
  average: number | null;
}

export interface PeerItem {
  teacher: Person;
  shared_subjects: string[];
  status: 'pending' | 'completed';
}

export interface TeacherDashboard {
  teacher: User;
  semester: { id: number; name: string } | null;
  overall: Overall;
  criteria: Criterion[];
  peer_overall: Overall;
  trend: TrendPoint[];
  recent_feedback: Comment[];
  subjects: TeacherClass[];
  peer_period: Period | null;
  peers: PeerItem[];
  /** False when the school switched peer evaluation off. */
  peer_evaluation?: boolean;
  /** Results stay hidden until enough people answered (protects anonymity in small classes). */
  privacy?: { min_responses: number; locked: boolean };
  /** "What to work on": the lowest-rated areas with a few practical tips each. */
  focus?: FocusArea[];
}

export interface FocusArea {
  question_id: number;
  category: string;
  average: number;
  tips: string[];
}

export interface FacultyReport {
  teacher: Person;
  period: Period | null;
  generated_at: string;
  student_ratings: { overall: Overall; criteria: Criterion[]; /** Answers per score, "1"…"5". */ distribution?: Record<string, number> };
  /** Average student rating of the teacher's whole department, for context. */
  department_average?: number | null;
  peer_ratings: { overall: Overall; criteria: Criterion[] };
  classes: { subject_code: string | null; subject_name: string | null; section: string | null; responses: number; average: number }[];
  trend: TrendPoint[];
  comments: Comment[];
}

export interface PeerForm {
  teacher: Person;
  period: Period | null;
  already_submitted: boolean;
  scale: Record<string, string>;
  questions: Question[];
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}
