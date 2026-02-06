/**
 * Plan Routes
 *
 * Provides information about active spec-driven development plans.
 * Reads from docs/plans/ directory to show plan status in the viewer.
 */

import { Database } from "bun:sqlite";
import express, { Request, Response } from "express";
import { readdirSync, readFileSync, statSync, existsSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import path from "path";
import { BaseRouteHandler } from "../BaseRouteHandler.js";
import { logger } from "../../../../utils/logger.js";
import type { DatabaseManager } from "../../DatabaseManager.js";
import type { SSEBroadcaster } from "../../SSEBroadcaster.js";
import {
  associatePlan,
  getPlanForSession,
  getPlanByContentSessionId,
  updatePlanStatus,
  clearPlanAssociation,
} from "../../../sqlite/plans/store.js";

export interface GitInfo {
  branch: string | null;
  staged: number;
  unstaged: number;
  untracked: number;
}

export interface PlanInfo {
  name: string;
  status: "PENDING" | "COMPLETE" | "VERIFIED";
  completed: number;
  total: number;
  phase: "plan" | "implement" | "verify";
  iterations: number;
  approved: boolean;
  filePath: string;
  modifiedAt: string;
}

export class PlanRoutes extends BaseRouteHandler {
  private dbManager: DatabaseManager | null;
  private sseBroadcaster: SSEBroadcaster | null;

  constructor(dbManager?: DatabaseManager, sseBroadcaster?: SSEBroadcaster) {
    super();
    this.dbManager = dbManager ?? null;
    this.sseBroadcaster = sseBroadcaster ?? null;
  }

  private static VALID_PLAN_STATUSES = new Set(["PENDING", "COMPLETE", "VERIFIED"]);

  private isValidPlanStatus(status: unknown): status is PlanInfo["status"] {
    return typeof status === "string" && PlanRoutes.VALID_PLAN_STATUSES.has(status);
  }

  setupRoutes(app: express.Application): void {
    app.get("/api/plan", this.handleGetActivePlan.bind(this));
    app.get("/api/plans", this.handleGetAllPlans.bind(this));
    app.get("/api/plans/active", this.handleGetActiveSpecs.bind(this));
    app.get("/api/plan/content", this.handleGetPlanContent.bind(this));
    app.delete("/api/plan", this.handleDeletePlan.bind(this));
    app.get("/api/git", this.handleGetGitInfo.bind(this));

    app.post("/api/sessions/:sessionDbId/plan", this.handleAssociatePlan.bind(this));
    app.post(
      "/api/sessions/by-content-id/:contentSessionId/plan",
      this.handleAssociatePlanByContentId.bind(this),
    );
    app.get("/api/sessions/:sessionDbId/plan", this.handleGetSessionPlan.bind(this));
    app.get(
      "/api/sessions/by-content-id/:contentSessionId/plan",
      this.handleGetSessionPlanByContentId.bind(this),
    );
    app.delete("/api/sessions/:sessionDbId/plan", this.handleClearSessionPlan.bind(this));
    app.put("/api/sessions/:sessionDbId/plan/status", this.handleUpdatePlanStatus.bind(this));
  }

  /**
   * Get active plan info (most recent non-VERIFIED plan modified today)
   */
  private handleGetActivePlan = this.wrapHandler((_req: Request, res: Response): void => {
    const projectRoot = process.env.CLAUDE_PROJECT_ROOT || process.cwd();
    const plans = this.getActivePlans(projectRoot);

    res.json({
      active: plans.length > 0,
      plans,
      plan: plans[0] || null,
    });
  });

  /**
   * Get all plans from docs/plans/ directory
   */
  private handleGetAllPlans = this.wrapHandler((_req: Request, res: Response): void => {
    const projectRoot = process.env.CLAUDE_PROJECT_ROOT || process.cwd();
    const plans = this.getAllPlans(projectRoot);
    res.json({ plans });
  });

  /**
   * Get git repository info (branch, staged/unstaged counts)
   */
  private handleGetGitInfo = this.wrapHandler((_req: Request, res: Response): void => {
    const projectRoot = process.env.CLAUDE_PROJECT_ROOT || process.cwd();
    const gitInfo = this.getGitInfo(projectRoot);
    res.json(gitInfo);
  });

  /**
   * Get active specs for the Spec viewer.
   * Returns plans with PENDING/COMPLETE status + most recent VERIFIED plan.
   */
  private handleGetActiveSpecs = this.wrapHandler((_req: Request, res: Response): void => {
    const projectRoot = process.env.CLAUDE_PROJECT_ROOT || process.cwd();
    const specs = this.getActiveSpecs(projectRoot);
    res.json({ specs });
  });

  /**
   * Get plan content by path.
   * Returns raw markdown content for rendering in the Spec viewer.
   */
  private handleGetPlanContent = this.wrapHandler((req: Request, res: Response): void => {
    const projectRoot = process.env.CLAUDE_PROJECT_ROOT || process.cwd();
    const plansDir = path.join(projectRoot, "docs", "plans");
    const requestedPath = req.query.path as string | undefined;

    if (!requestedPath) {
      const specs = this.getActiveSpecs(projectRoot);
      if (specs.length === 0) {
        res.status(404).json({ error: "No active specs found" });
        return;
      }
      const firstSpec = specs[0];
      try {
        const content = readFileSync(firstSpec.filePath, "utf-8");
        res.json({
          content,
          name: firstSpec.name,
          status: firstSpec.status,
          filePath: firstSpec.filePath,
        });
      } catch {
        res.status(404).json({ error: "Plan file not found" });
      }
      return;
    }

    const resolvedPath = path.resolve(projectRoot, requestedPath);
    const normalizedPlansDir = path.resolve(plansDir);

    if (!resolvedPath.startsWith(normalizedPlansDir) || !resolvedPath.endsWith(".md")) {
      res.status(403).json({ error: "Access denied: path must be within docs/plans/" });
      return;
    }

    if (!existsSync(resolvedPath)) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    const content = readFileSync(resolvedPath, "utf-8");
    const fileName = path.basename(resolvedPath);
    const stat = statSync(resolvedPath);
    const planInfo = this.parsePlanContent(content, fileName, resolvedPath, stat.mtime);

    res.json({
      content,
      name: planInfo?.name || fileName.replace(".md", ""),
      status: planInfo?.status || "UNKNOWN",
      filePath: resolvedPath,
    });
  });


  /**
   * Delete a plan file from the filesystem.
   */
  private handleDeletePlan = this.wrapHandler((req: Request, res: Response): void => {
    const projectRoot = process.env.CLAUDE_PROJECT_ROOT || process.cwd();
    const plansDir = path.join(projectRoot, "docs", "plans");
    const requestedPath = req.query.path as string | undefined;

    if (!requestedPath) {
      this.badRequest(res, "Missing path query parameter");
      return;
    }

    const resolvedPath = path.resolve(projectRoot, requestedPath);
    const normalizedPlansDir = path.resolve(plansDir);

    if (!resolvedPath.startsWith(normalizedPlansDir) || !resolvedPath.endsWith(".md")) {
      res.status(403).json({ error: "Access denied: path must be within docs/plans/" });
      return;
    }

    if (!existsSync(resolvedPath)) {
      this.notFound(res, "Plan not found");
      return;
    }

    unlinkSync(resolvedPath);
    res.json({ success: true });
  });

  private handleAssociatePlan = this.wrapHandler((req: Request, res: Response): void => {
    const sessionDbId = this.parseIntParam(req, res, "sessionDbId");
    if (sessionDbId === null) return;
    if (!this.validateRequired(req, res, ["planPath", "status"])) return;
    if (!this.isValidPlanStatus(req.body.status)) {
      this.badRequest(res, `Invalid status: ${req.body.status}. Must be PENDING, COMPLETE, or VERIFIED`);
      return;
    }
    const db = this.getDb(res);
    if (!db) return;

    const result = associatePlan(db, sessionDbId, req.body.planPath, req.body.status);
    this.broadcastPlanChange();
    res.json({ plan: result });
  });

  private handleAssociatePlanByContentId = this.wrapHandler((req: Request, res: Response): void => {
    const contentSessionId = req.params.contentSessionId;
    if (!contentSessionId) {
      this.badRequest(res, "Missing contentSessionId");
      return;
    }
    if (!this.validateRequired(req, res, ["planPath", "status"])) return;
    if (!this.isValidPlanStatus(req.body.status)) {
      this.badRequest(res, `Invalid status: ${req.body.status}. Must be PENDING, COMPLETE, or VERIFIED`);
      return;
    }
    const db = this.getDb(res);
    if (!db) return;

    const row = db.prepare("SELECT id FROM sdk_sessions WHERE content_session_id = ?").get(contentSessionId) as
      | { id: number }
      | null;
    if (!row) {
      this.notFound(res, "Session not found");
      return;
    }

    const result = associatePlan(db, row.id, req.body.planPath, req.body.status);
    this.broadcastPlanChange();
    res.json({ plan: result });
  });

  private handleGetSessionPlan = this.wrapHandler((req: Request, res: Response): void => {
    const sessionDbId = this.parseIntParam(req, res, "sessionDbId");
    if (sessionDbId === null) return;
    const db = this.getDb(res);
    if (!db) return;

    const plan = getPlanForSession(db, sessionDbId);
    res.json({ plan });
  });

  private handleGetSessionPlanByContentId = this.wrapHandler((req: Request, res: Response): void => {
    const contentSessionId = req.params.contentSessionId;
    if (!contentSessionId) {
      this.badRequest(res, "Missing contentSessionId");
      return;
    }
    const db = this.getDb(res);
    if (!db) return;

    const plan = getPlanByContentSessionId(db, contentSessionId);
    res.json({ plan });
  });

  private handleClearSessionPlan = this.wrapHandler((req: Request, res: Response): void => {
    const sessionDbId = this.parseIntParam(req, res, "sessionDbId");
    if (sessionDbId === null) return;
    const db = this.getDb(res);
    if (!db) return;

    clearPlanAssociation(db, sessionDbId);
    this.broadcastPlanChange();
    res.json({ success: true });
  });

  private handleUpdatePlanStatus = this.wrapHandler((req: Request, res: Response): void => {
    const sessionDbId = this.parseIntParam(req, res, "sessionDbId");
    if (sessionDbId === null) return;
    if (!this.validateRequired(req, res, ["status"])) return;
    if (!this.isValidPlanStatus(req.body.status)) {
      this.badRequest(res, `Invalid status: ${req.body.status}. Must be PENDING, COMPLETE, or VERIFIED`);
      return;
    }
    const db = this.getDb(res);
    if (!db) return;

    updatePlanStatus(db, sessionDbId, req.body.status);
    this.broadcastPlanChange();
    const plan = getPlanForSession(db, sessionDbId);
    res.json({ plan });
  });

  /** Broadcast plan_association_changed SSE event to connected clients. */
  private broadcastPlanChange(): void {
    this.sseBroadcaster?.broadcast({
      type: "plan_association_changed",
    });
  }

  /** Get the raw bun:sqlite Database from dbManager, or send 503 if unavailable. */
  private getDb(res: Response): Database | null {
    if (!this.dbManager) {
      res.status(503).json({ error: "Database not available" });
      return null;
    }
    return this.dbManager.getSessionStore().db;
  }

  /**
   * Get info about active plan from docs/plans/ directory.
   * Only considers specs modified today to avoid showing stale plans.
   */
  private getActivePlans(projectRoot: string): PlanInfo[] {
    const plansDir = path.join(projectRoot, "docs", "plans");
    if (!existsSync(plansDir)) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activePlans: PlanInfo[] = [];

    try {
      const planFiles = readdirSync(plansDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse();

      for (const planFile of planFiles) {
        const filePath = path.join(plansDir, planFile);
        const stat = statSync(filePath);
        const mtime = new Date(stat.mtime);
        mtime.setHours(0, 0, 0, 0);

        if (mtime.getTime() !== today.getTime()) {
          continue;
        }

        const content = readFileSync(filePath, "utf-8");
        const planInfo = this.parsePlanContent(content, planFile, filePath, stat.mtime);

        if (planInfo && planInfo.status !== "VERIFIED") {
          activePlans.push(planInfo);
        }
      }
    } catch (error) {
      logger.error("HTTP", "Failed to read active plans", {}, error as Error);
    }

    return activePlans;
  }

  /**
   * Get all specs for the Spec viewer, sorted by modification date (newest first).
   */
  private getActiveSpecs(projectRoot: string): PlanInfo[] {
    return this.getAllPlans(projectRoot)
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  }

  /**
   * Get all plans from docs/plans/ directory
   */
  private getAllPlans(projectRoot: string): PlanInfo[] {
    const plansDir = path.join(projectRoot, "docs", "plans");
    if (!existsSync(plansDir)) {
      return [];
    }

    const plans: PlanInfo[] = [];

    try {
      const planFiles = readdirSync(plansDir)
        .filter((f) => f.endsWith(".md"))
        .sort()
        .reverse();

      for (const planFile of planFiles) {
        const filePath = path.join(plansDir, planFile);
        const stat = statSync(filePath);
        const content = readFileSync(filePath, "utf-8");
        const planInfo = this.parsePlanContent(content, planFile, filePath, stat.mtime);

        if (planInfo) {
          plans.push(planInfo);
        }
      }
    } catch (error) {
      logger.error("HTTP", "Failed to read all plans", {}, error as Error);
    }

    return plans.slice(0, 10);
  }

  /**
   * Parse plan file content to extract status information
   */
  private parsePlanContent(content: string, fileName: string, filePath: string, modifiedAt: Date): PlanInfo | null {
    const statusMatch = content.match(/^Status:\s*(\w+)/m);
    if (!statusMatch) {
      return null;
    }

    const status = statusMatch[1] as "PENDING" | "COMPLETE" | "VERIFIED";

    const completedTasks = (content.match(/^- \[x\] Task \d+:/gm) || []).length;
    const remainingTasks = (content.match(/^- \[ \] Task \d+:/gm) || []).length;
    const total = completedTasks + remainingTasks;

    const approvedMatch = content.match(/^Approved:\s*(\w+)/m);
    const approved = approvedMatch ? approvedMatch[1].toLowerCase() === "yes" : false;

    const iterMatch = content.match(/^Iterations:\s*(\d+)/m);
    const iterations = iterMatch ? parseInt(iterMatch[1], 10) : 0;

    let phase: "plan" | "implement" | "verify";
    if (status === "PENDING" && !approved) {
      phase = "plan";
    } else if (status === "PENDING" && approved) {
      phase = "implement";
    } else {
      phase = "verify";
    }

    let name = fileName.replace(".md", "");
    if (name.match(/^\d{4}-\d{2}-\d{2}-/)) {
      name = name.split("-").slice(3).join("-");
    }

    return {
      name,
      status,
      completed: completedTasks,
      total,
      phase,
      iterations,
      approved,
      filePath,
      modifiedAt: modifiedAt.toISOString(),
    };
  }

  /**
   * Get git repository info
   */
  private getGitInfo(projectRoot: string): GitInfo {
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: projectRoot,
        encoding: "utf-8",
        timeout: 2000,
      }).trim();

      const status = execSync("git status --porcelain", {
        cwd: projectRoot,
        encoding: "utf-8",
        timeout: 2000,
      });

      let staged = 0;
      let unstaged = 0;
      let untracked = 0;

      for (const line of status.split("\n")) {
        if (!line) continue;
        const idx = line[0] || " ";
        const wt = line[1] || " ";

        if (idx === "?" && wt === "?") {
          untracked++;
        } else {
          if (idx !== " " && idx !== "?") staged++;
          if (wt !== " ") unstaged++;
        }
      }

      return { branch, staged, unstaged, untracked };
    } catch {
      return { branch: null, staged: 0, unstaged: 0, untracked: 0 };
    }
  }
}
