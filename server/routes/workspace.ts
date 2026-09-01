import { randomBytes } from "node:crypto";
import { Router } from "express";
import { canPostCommunityAnswer, communityRoleOf } from "../../lib/access/billing";
import { COMMUNITY_REPLY_RULES, LOCAL_ASSESSMENTS, presentAssessmentRun, scoreAssessment, type StoredAnswer } from "../../lib/product/workspace";
import { reportForRun } from "../../lib/product/report";
import { buildAssessmentReportPdf } from "../../lib/product/reportPdf";
import { ASSESSMENT_NOTICE_VERSION } from "../../lib/legal/compliance";
import { asyncHandler, HttpError } from "../middleware/errors";
import { requireAppAccess, requireModule, type AppRequest } from "../middleware/appAuth";
import type { AccountStore, AppSessionStore, AssessmentRunStore, ThreadStore } from "../stores/memory";
import type { LocalThread } from "../../lib/product/workspace";

function replyPolicyFor(req: AppRequest) {
  const role = communityRoleOf(req.account);
  return {
    role,
    canReply: canPostCommunityAnswer(role),
    rules: COMMUNITY_REPLY_RULES,
  };
}

function presentThread(thread: LocalThread) {
  return {
    id: thread.id,
    authorName: thread.authorName,
    title: thread.title,
    body: thread.body,
    tags: thread.tags,
    views: thread.views,
    answerCount: thread.answers.length,
    createdAt: thread.createdAt.toISOString(),
    answers: thread.answers.map((answer) => ({
      id: answer.id,
      authorName: answer.authorName,
      body: answer.body,
      createdAt: answer.createdAt.toISOString(),
      upvotes: answer.upvotes,
      upvotedBy: answer.upvotedBy,
    })),
  };
}

export function createWorkspaceRouter(deps: {
  accounts: AccountStore;
  sessions: AppSessionStore;
  threads: ThreadStore;
  assessmentRuns: AssessmentRunStore;
}): Router {
  const router = Router();
  const enter = requireAppAccess(deps);

  router.use(enter);

  router.get(
    "/home",
    asyncHandler(async (req: AppRequest, res) => {
      const runs = await deps.assessmentRuns.listByAccount(req.accountId!);
      const threads = await deps.threads.list();
      res.json({
        runs: runs.slice(0, 5).map(presentAssessmentRun),
        threadCount: threads.length,
        recentThreads: threads.slice(0, 4).map(presentThread),
      });
    }),
  );

  router.get(
    "/assessments",
    requireModule("assessments"),
    asyncHandler(async (req: AppRequest, res) => {
      const runs = await deps.assessmentRuns.listByAccount(req.accountId!);
      res.json({
        assessments: LOCAL_ASSESSMENTS.map((item) => ({
          id: item.id,
          title: item.title,
          duration: item.duration,
          copy: item.copy,
          itemCount: item.items.length,
          level: item.level,
          track: item.track,
          recommended: item.recommended,
          kind: item.items.some((row) => row.kind === "rank") ? "rank" : "mcq",
        })),
        runs: runs.map(presentAssessmentRun),
      });
    }),
  );

  router.get(
    "/assessments/runs/:runId/pdf",
    requireModule("assessments"),
    asyncHandler(async (req: AppRequest, res) => {
      const run = await deps.assessmentRuns.get(req.params.runId);
      if (!run || run.accountId !== req.accountId) {
        throw new HttpError(404, "not_found", "Report not found");
      }
      const report = reportForRun({
        assessmentId: run.assessmentId,
        answers: run.answers as Record<string, unknown>,
        score: run.score,
      });
      if (!report) throw new HttpError(404, "not_found", "Unknown assessment");
      const pdf = buildAssessmentReportPdf({
        report,
        answers: run.answers as Record<string, unknown>,
        runId: run.id,
        createdAt: run.createdAt,
      });
      const filename = `lokutara-${report.assessmentId}-${run.id.slice(0, 10)}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdf));
    }),
  );

  router.get(
    "/assessments/runs/:runId",
    requireModule("assessments"),
    asyncHandler(async (req: AppRequest, res) => {
      const run = await deps.assessmentRuns.get(req.params.runId);
      if (!run || run.accountId !== req.accountId) {
        throw new HttpError(404, "not_found", "Report not found");
      }
      const report = reportForRun({
        assessmentId: run.assessmentId,
        answers: run.answers as Record<string, unknown>,
        score: run.score,
      });
      if (!report) throw new HttpError(404, "not_found", "Unknown assessment");
      res.json({
        run: presentAssessmentRun(run),
        report,
      });
    }),
  );

  router.get(
    "/assessments/:id",
    requireModule("assessments"),
    asyncHandler(async (req: AppRequest, res) => {
      const assessment = LOCAL_ASSESSMENTS.find((item) => item.id === req.params.id);
      if (!assessment) throw new HttpError(404, "not_found", "Unknown assessment");
      res.json({ assessment });
    }),
  );

  router.post(
    "/assessments/:id/submit",
    requireModule("assessments"),
    asyncHandler(async (req: AppRequest, res) => {
      const assessment = LOCAL_ASSESSMENTS.find((item) => item.id === req.params.id);
      if (!assessment) throw new HttpError(404, "not_found", "Unknown assessment");
      if (req.body?.consent !== true) {
        throw new HttpError(
          400,
          "consent_required",
          "Confirm the assessment purpose and limitations before submitting",
        );
      }
      const raw = req.body?.answers;
      if (!raw || typeof raw !== "object") {
        throw new HttpError(400, "invalid", "Answers are required");
      }
      const parsed: Record<string, StoredAnswer> = {};
      for (const item of assessment.items) {
        const value = (raw as Record<string, unknown>)[item.id];
        if (item.kind === "mcq") {
          const direct =
            typeof value === "number"
              ? value
              : value && typeof value === "object" && "value" in value
                ? Number((value as { value: unknown }).value)
                : Number(value);
          if (!Number.isFinite(direct) || direct < 1 || direct > 5) {
            throw new HttpError(400, "invalid", "Answer every item");
          }
          parsed[item.id] = { kind: "mcq", value: direct };
        } else {
          const ranked =
            value && typeof value === "object" && "ranked" in (value as object)
              ? (value as StoredAnswer & { kind: "rank" }).ranked
              : null;
          if (!Array.isArray(ranked) || ranked.length !== item.options.length) {
            throw new HttpError(400, "invalid", "Rank every option");
          }
          parsed[item.id] = { kind: "rank", ranked };
        }
      }
      const run = await deps.assessmentRuns.insert({
        id: `run_${randomBytes(8).toString("hex")}`,
        accountId: req.accountId!,
        assessmentId: assessment.id,
        answers: parsed,
        score: scoreAssessment(assessment, parsed),
        consentedAt: new Date(),
        noticeVersion: ASSESSMENT_NOTICE_VERSION,
        createdAt: new Date(),
      });
      res.status(201).json({
        run: presentAssessmentRun(run),
        report: reportForRun({
          assessmentId: run.assessmentId,
          answers: parsed,
          score: run.score,
        }),
      });
    }),
  );

  router.get(
    "/community",
    requireModule("community"),
    asyncHandler(async (req: AppRequest, res) => {
      const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
      const tag = typeof req.query.tag === "string" ? req.query.tag.trim().toLowerCase() : "";
      const sort = typeof req.query.sort === "string" ? req.query.sort : "latest";
      let threads = await deps.threads.list();
      if (q) {
        threads = threads.filter(
          (thread) =>
            thread.title.toLowerCase().includes(q) || thread.body.toLowerCase().includes(q),
        );
      }
      if (tag) threads = threads.filter((thread) => thread.tags.some((item) => item.toLowerCase() === tag));
      if (sort === "unanswered") threads = threads.filter((thread) => thread.answers.length === 0);
      res.json({ threads: threads.map(presentThread), replyPolicy: replyPolicyFor(req) });
    }),
  );

  router.post(
    "/community",
    requireModule("community"),
    asyncHandler(async (req: AppRequest, res) => {
      const body = req.body || {};
      if (body.communityNoticeAccepted !== true) {
        throw new HttpError(
          400,
          "consent_required",
          "Confirm the community privacy rules before posting",
        );
      }
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const text = typeof body.body === "string" ? body.body.trim() : "";
      const tags = Array.isArray(body.tags)
        ? body.tags.filter((tag: unknown) => typeof tag === "string").map((tag: string) => tag.trim()).filter(Boolean)
        : [];
      if (title.length < 10) throw new HttpError(400, "invalid", "Give the thread a clearer title");
      if (text.length < 20) throw new HttpError(400, "invalid", "Write a bit more so people can reply");
      if (!tags.length) throw new HttpError(400, "invalid", "Pick at least one tag");
      const thread = await deps.threads.create({
        id: `thr_${randomBytes(8).toString("hex")}`,
        authorId: req.accountId!,
        authorName: req.account?.name || "Member",
        title,
        body: text,
        tags: tags.slice(0, 5),
        views: 0,
        createdAt: new Date(),
        answers: [],
      });
      res.status(201).json({ thread: presentThread(thread) });
    }),
  );

  router.get(
    "/community/:id",
    requireModule("community"),
    asyncHandler(async (req: AppRequest, res) => {
      const viewed = await deps.threads.incrementViews(req.params.id);
      if (!viewed) throw new HttpError(404, "not_found", "Thread not found");
      res.json({ thread: presentThread(viewed), replyPolicy: replyPolicyFor(req) });
    }),
  );

  router.post(
    "/community/:id/answers",
    requireModule("community"),
    asyncHandler(async (req: AppRequest, res) => {
      const role = communityRoleOf(req.account);
      if (!canPostCommunityAnswer(role)) {
        throw new HttpError(
          403,
          "forbidden",
          "Only specialists and admins can post answers. Students can ask questions and upvote.",
        );
      }
      const text = typeof req.body?.body === "string" ? req.body.body.trim() : "";
      if (text.length < 10) throw new HttpError(400, "invalid", "Write a reply of at least 10 characters");
      const thread = await deps.threads.addAnswer(req.params.id, {
        id: `ans_${randomBytes(8).toString("hex")}`,
        authorId: req.accountId!,
        authorName: req.account?.name || "Member",
        body: text,
        createdAt: new Date(),
        upvotes: 0,
        upvotedBy: [],
      });
      if (!thread) throw new HttpError(404, "not_found", "Thread not found");
      res.status(201).json({ thread: presentThread(thread) });
    }),
  );

  router.post(
    "/community/:id/answers/:answerId/upvote",
    requireModule("community"),
    asyncHandler(async (req: AppRequest, res) => {
      const thread = await deps.threads.toggleUpvote(req.params.id, req.params.answerId, req.accountId!);
      if (!thread) throw new HttpError(404, "not_found", "Answer not found");
      res.json({ thread: presentThread(thread) });
    }),
  );

  return router;
}
