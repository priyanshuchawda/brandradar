/**
 * Crawl Frontier & Priority Queue.
 *
 * Manages pending URLs, tracks visit history, detects duplicate visits,
 * enforces hard budget constraints (maxDepth, maxPages, runtime), and tracks graph edges.
 */

import type {
  CrawlBudget,
  CrawlGraphEdge,
  CrawlQueueItem,
  DiscoveredLink,
} from "./crawl-schema";
import { normalizeUrl } from "./link-normalizer";

export class CrawlFrontier {
  private queue: CrawlQueueItem[] = [];
  private visitedUrls = new Set<string>();
  private enqueuedUrls = new Set<string>();
  private graphEdges: CrawlGraphEdge[] = [];

  private startTime = Date.now();
  private completedPagesCount = 0;
  private geminiCallsCount = 0;

  constructor(public readonly budget: CrawlBudget) {}

  /**
   * Initializes the queue with a starting URL.
   */
  public enqueueStartUrl(url: string): boolean {
    const normalized = normalizeUrl(url);
    if (!normalized) return false;

    this.queue.push({
      url: normalized,
      linkId: "start_root",
      sourcePageId: "root",
      depth: 0,
      priority: 1.0,
      status: "queued",
    });

    this.enqueuedUrls.add(normalized);
    return true;
  }

  /**
   * Checks if there are more URLs to visit and budget permits.
   */
  public hasNext(): boolean {
    if (this.queue.length === 0) return false;
    if (this.completedPagesCount >= this.budget.maxPages) return false;
    if (this.geminiCallsCount >= this.budget.maxGeminiCalls) return false;
    if (Date.now() - this.startTime >= this.budget.maxRuntimeMs) return false;

    return true;
  }

  /**
   * Dequeues the highest-priority pending URL.
   */
  public dequeue(): CrawlQueueItem | null {
    if (!this.hasNext()) return null;

    // Sort queue by priority descending, then depth ascending
    this.queue.sort((a, b) => b.priority - a.priority || a.depth - b.depth);

    const item = this.queue.shift();
    if (!item) return null;

    item.status = "running";
    this.visitedUrls.add(item.url);
    return item;
  }

  /**
   * Enqueues approved links selected by Gemini.
   */
  public enqueueSelected(input: {
    sourcePageId: string;
    currentDepth: number;
    selected: Array<{ linkId: string; url: string; priority: number; reason: string }>;
  }): number {
    const nextDepth = input.currentDepth + 1;
    if (nextDepth > this.budget.maxDepth) {
      return 0;
    }

    let enqueuedCount = 0;
    for (const sel of input.selected) {
      const normalized = normalizeUrl(sel.url);
      if (!normalized) continue;

      // Skip if already visited or already queued
      if (this.visitedUrls.has(normalized) || this.enqueuedUrls.has(normalized)) {
        continue;
      }

      this.queue.push({
        url: normalized,
        linkId: sel.linkId,
        sourcePageId: input.sourcePageId,
        depth: nextDepth,
        priority: sel.priority,
        status: "queued",
        reason: sel.reason,
      });

      this.enqueuedUrls.add(normalized);
      enqueuedCount++;

      // Record graph edge
      this.graphEdges.push({
        sourcePageId: input.sourcePageId,
        linkId: sel.linkId,
        targetUrl: normalized,
        decision: "FOLLOW",
        reason: sel.reason,
      });
    }

    return enqueuedCount;
  }

  /**
   * Records skipped links in graph edge telemetry.
   */
  public recordSkipped(input: {
    sourcePageId: string;
    skipped: Array<{ linkId: string; reason: string }>;
    discoveredLinks: DiscoveredLink[];
  }) {
    for (const sk of input.skipped) {
      const orig = input.discoveredLinks.find((l) => l.linkId === sk.linkId);
      if (orig) {
        this.graphEdges.push({
          sourcePageId: input.sourcePageId,
          linkId: sk.linkId,
          targetUrl: orig.normalizedUrl,
          decision: "SKIP",
          reason: sk.reason,
        });
      }
    }
  }

  /**
   * Increments completed page counter.
   */
  public markCompleted() {
    this.completedPagesCount++;
  }

  /**
   * Increments Gemini call counter.
   */
  public markGeminiCall() {
    this.geminiCallsCount++;
  }

  public isVisited(url: string): boolean {
    const normalized = normalizeUrl(url);
    return normalized ? this.visitedUrls.has(normalized) : false;
  }

  public getVisitedUrls(): string[] {
    return Array.from(this.visitedUrls);
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getCompletedPagesCount(): number {
    return this.completedPagesCount;
  }

  public getGeminiCallsCount(): number {
    return this.geminiCallsCount;
  }

  public getGraphEdges(): CrawlGraphEdge[] {
    return [...this.graphEdges];
  }

  public getBudgetStatus() {
    return {
      pagesRemaining: Math.max(0, this.budget.maxPages - this.completedPagesCount),
      geminiCallsRemaining: Math.max(0, this.budget.maxGeminiCalls - this.geminiCallsCount),
      timeRemainingMs: Math.max(0, this.budget.maxRuntimeMs - (Date.now() - this.startTime)),
      queueSize: this.queue.length,
      visitedCount: this.visitedUrls.size,
    };
  }
}
