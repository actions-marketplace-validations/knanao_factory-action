import type { Trigger } from '../trigger.js'

/** Sent to each session of a closed issue or PR. */
export function cleanupPrompt(t: Trigger): string {
  const kind = t.isPR ? 'Pull request' : 'Issue'
  return `${kind} #${t.number} in ${t.owner}/${t.repo} was closed. Clean up your workspace and stop: if the worktree named in your worktree rule exists, \`cd\` to the shared clone, run \`git worktree remove --force <that worktree>\`, \`git branch -D <its branch>\` and \`git worktree prune\`. Touch nothing else: do not delete remote branches, and do not post anything to GitHub. If the thread is reopened later, a new request will tell you to recreate the worktree.`
}
