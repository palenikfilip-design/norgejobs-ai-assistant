export interface CvWorkEntry {
  position: string;
  company: string;
  period: string;
  description: string;
}

export interface CvEducationEntry {
  school: string;
  degree: string;
  period: string;
  description?: string;
}

export type CvTemplate = "modern" | "classic" | "creative";

export interface CvData {
  full_name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  work_experience: CvWorkEntry[];
  education: CvEducationEntry[];
  skills: string[];
  languages: string[];
  certifications: string[];
}

export interface CvRecord extends CvData {
  id: string;
  user_id: string;
  title: string;
  template: CvTemplate;
  created_at: string;
  updated_at: string;
}