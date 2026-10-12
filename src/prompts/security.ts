import type { PromptContext } from './common.js'
import { extraInstructions, header, join, untrusted } from './common.js'
import { diffSteps, postReviewSteps } from './review.js'

export function securityPrompt(ctx: PromptContext): string {
  const pr = ctx.pr!
  return join(
    `Run a security review of pull request #${pr.number}.`,
    header(ctx),
    diffSteps(ctx),
    `Read the existing review comments first so you do not duplicate them: \`gh api repos/${ctx.repo}/pulls/${pr.number}/comments --paginate\`.`,
    'Run /security-review on that diff only (not the whole repository). Use `.factory/threat-model.md` if it exists, and follow `.factory/skills/security-review-guidelines` if it exists. Validate every finding against the code and drop anything you cannot confirm.',
    postReviewSteps(
      ctx,
      '`[P0] [security]`, `[P1] [security]` or `[P2] [security]`'
    ) + ' Mention P3 findings only in the summary, not as inline comments.',
    untrusted('PR description', ctx.body),
    extraInstructions(ctx.extra)
  )
}
