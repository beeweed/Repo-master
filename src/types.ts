export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  updated_at: string;
  language: string | null;
  stargazers_count: number;
}
