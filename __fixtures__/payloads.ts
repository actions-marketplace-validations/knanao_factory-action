/** Minimal webhook payloads with only the fields the action reads. */

export const OWNER = 'acme'
export const REPO = 'widgets'

const user = (login: string, type = 'User') => ({ login, type })

export function pullRequest(
  overrides: { headRepo?: string; draft?: boolean } = {}
) {
  return {
    number: 7,
    html_url: 'https://github.com/acme/widgets/pull/7',
    title: 'Add widget',
    body: 'PR body',
    draft: overrides.draft ?? false,
    user: user('alice'),
    author_association: 'MEMBER',
    base: { ref: 'main', sha: 'base111' },
    head: {
      ref: 'feature',
      sha: 'head222',
      repo: { full_name: overrides.headRepo ?? 'acme/widgets' }
    }
  }
}

export function issueComment(
  body: string,
  opts: {
    association?: string
    login?: string
    type?: string
    onPR?: boolean
  } = {}
) {
  return {
    action: 'created',
    issue: {
      number: 42,
      html_url: 'https://github.com/acme/widgets/issues/42',
      title: 'Broken button',
      body: 'Issue body',
      ...(opts.onPR ? { pull_request: { url: 'x' } } : {})
    },
    comment: {
      id: 1001,
      body,
      user: user(opts.login ?? 'alice', opts.type),
      author_association: opts.association ?? 'MEMBER'
    }
  }
}

export function reviewComment(body: string) {
  return {
    action: 'created',
    pull_request: pullRequest(),
    comment: {
      id: 2002,
      body,
      path: 'src/a.ts',
      line: 12,
      diff_hunk: '@@ -1 +1 @@',
      user: user('bob'),
      author_association: 'COLLABORATOR'
    }
  }
}

export function pullRequestEvent(
  action: string,
  overrides: { headRepo?: string; draft?: boolean } = {}
) {
  return { action, pull_request: pullRequest(overrides) }
}
