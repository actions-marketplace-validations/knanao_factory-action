import { getOctokit } from '@actions/github'
import type { IssueComment } from './state.js'
import type { Trigger } from './trigger.js'

/** The few GitHub operations the action performs itself. */
export interface GitHubApi {
  getPermission(login: string): Promise<string>
  selfLogin(): Promise<string>
  listIssueComments(number: number): Promise<IssueComment[]>
  createIssueComment(number: number, body: string): Promise<number>
  updateIssueComment(id: number, body: string): Promise<void>
  addEyes(target: NonNullable<Trigger['reaction']>): Promise<void>
}

export function createGitHubApi(
  token: string,
  owner: string,
  repo: string
): GitHubApi {
  const octokit = getOctokit(token)
  const r = { owner, repo }

  return {
    async getPermission(login) {
      const { data } = await octokit.rest.repos.getCollaboratorPermissionLevel({
        ...r,
        username: login
      })
      return data.permission
    },

    async selfLogin() {
      // Works for PATs. GITHUB_TOKEN (an installation token) cannot call
      // GET /user, and comments made with it are authored by github-actions[bot].
      try {
        const { data } = await octokit.rest.users.getAuthenticated()
        return data.login
      } catch {
        return 'github-actions[bot]'
      }
    },

    async listIssueComments(number) {
      return octokit.paginate(octokit.rest.issues.listComments, {
        ...r,
        issue_number: number,
        per_page: 100
      })
    },

    async createIssueComment(number, body) {
      const { data } = await octokit.rest.issues.createComment({
        ...r,
        issue_number: number,
        body
      })
      return data.id
    },

    async updateIssueComment(id, body) {
      await octokit.rest.issues.updateComment({ ...r, comment_id: id, body })
    },

    async addEyes(target) {
      const content = 'eyes' as const
      switch (target.kind) {
        case 'issue-comment':
          await octokit.rest.reactions.createForIssueComment({
            ...r,
            comment_id: target.id,
            content
          })
          return
        case 'review-comment':
          await octokit.rest.reactions.createForPullRequestReviewComment({
            ...r,
            comment_id: target.id,
            content
          })
          return
        case 'issue':
          await octokit.rest.reactions.createForIssue({
            ...r,
            issue_number: target.id,
            content
          })
          return
      }
    }
  }
}
