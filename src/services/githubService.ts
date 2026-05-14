import { GitHubUser, GitHubRepository } from '../types';

const API_BASE_URL = 'https://api.github.com';

export class GitHubService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = 'GitHub API Error';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Ignore JSON parse error
      }
      throw new Error(errorMessage);
    }

    // Some endpoints (like 204 No Content for DELETE) don't return JSON
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>('/user');
  }

  async getRepositories(page: number = 1, perPage: number = 100): Promise<GitHubRepository[]> {
    return this.request<GitHubRepository[]>(`/user/repos?affiliation=owner&sort=updated&per_page=${perPage}&page=${page}`);
  }

  async deleteRepository(fullName: string): Promise<void> {
    await this.request(`/repos/${fullName}`, {
      method: 'DELETE',
    });
  }
}
