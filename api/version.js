/**
 * What is actually running at this URL, right now.
 *
 * Ported from the dev repo, where its reason for existing is recorded: every
 * other endpoint answers a question about beauty products, and answers it
 * identically whether the newest build is live or a three-week-old one is.
 * That is how a deploy check printed "34/34 passed — Deployed and verified"
 * on 2026-08-21 while production served a build from 25 days earlier.
 *
 * The scaffold never had it, so `assert-deployed` has been probing a 404 on
 * vettbeauty.com and could never verify anything.
 *
 * `deploymentId` is the discriminator that matters: Vercel sets it per
 * deployment, so two calls that disagree prove a partial promotion — some
 * edges on the new build, others still on the old.
 *
 * `commit` reads "unknown" for CLI deploys: VERCEL_GIT_COMMIT_SHA is set by
 * the Git integration, and this project deploys with `vercel --prod` from a
 * laptop. It starts reporting the moment the repo is connected.
 *
 * Never cached, at any layer. A version endpoint served from an edge cache
 * reports the PREVIOUS deployment's answer — manufacturing exactly the false
 * green it exists to prevent.
 */
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.status(200).json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
    deploymentUrl: process.env.VERCEL_URL || null,
    env: process.env.VERCEL_ENV || 'local',
    region: process.env.VERCEL_REGION || null,
    servedAt: new Date().toISOString(),
  });
}
