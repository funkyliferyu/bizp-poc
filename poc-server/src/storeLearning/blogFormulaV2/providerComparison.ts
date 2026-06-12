import type { BlogFormulaSetV2 } from './types.js';
import type { BlogFormulaV2QualityIssue } from './formulaQuality.js';

export type BlogFormulaV2ComparisonInputEntry =
  | {
      mode: string;
      model: string;
      formulaSetId: string;
      formula: BlogFormulaSetV2;
      qualityIssues: BlogFormulaV2QualityIssue[];
      skipped?: false;
    }
  | { mode: string; skipped: true; reason: string };

export type BlogFormulaV2BlockSummary = {
  status: 'confirmed' | 'candidate' | 'weak';
  confidence: number;
};

export type BlogFormulaV2ComparisonModeRow =
  | {
      mode: string;
      skipped: false;
      model: string;
      formulaSetId: string;
      schemaVersion: string;
      titlePatterns: string[];
      blocks: Record<string, BlogFormulaV2BlockSummary>;
      qualityIssueCount: number;
      qualityIssueCodes: string[];
      qualityIssues: BlogFormulaV2QualityIssue[];
    }
  | { mode: string; skipped: true; reason: string };

export type BlogFormulaV2ProviderComparisonReport = {
  modes: BlogFormulaV2ComparisonModeRow[];
  summary: {
    comparedModes: string[];
    skippedModes: string[];
    qualityIssueTotals: Record<string, number>;
    blocksWithStatusDifferences: string[];
  };
  markdown: string;
};

const BLOCK_KEYS = [
  'titleFormula',
  'introFormula',
  'bodyFormula',
  'headingFormula',
  'toneAndMannerFormula',
  'ctaFormula',
  'footerFormula',
  'medicalSafetyFormula'
] as const;

const STATUS_RANK: Record<BlogFormulaV2BlockSummary['status'], number> = {
  weak: 0,
  candidate: 1,
  confirmed: 2
};

function titleBlockSummary(formula: BlogFormulaSetV2): BlogFormulaV2BlockSummary {
  // Represent the title block by its weakest entry so a single shaky pattern
  // is visible in the comparison instead of being averaged away.
  let summary: BlogFormulaV2BlockSummary = { status: 'confirmed', confidence: 1 };
  for (const entry of formula.titleFormula) {
    if (
      STATUS_RANK[entry.status] < STATUS_RANK[summary.status] ||
      (entry.status === summary.status && entry.confidence < summary.confidence)
    ) {
      summary = { status: entry.status, confidence: entry.confidence };
    }
  }
  return summary;
}

function blockSummaries(formula: BlogFormulaSetV2): Record<string, BlogFormulaV2BlockSummary> {
  const blocks: Record<string, BlogFormulaV2BlockSummary> = {
    titleFormula: titleBlockSummary(formula)
  };
  for (const key of BLOCK_KEYS) {
    if (key === 'titleFormula') continue;
    const block = formula[key];
    blocks[key] = { status: block.status, confidence: block.confidence };
  }
  return blocks;
}

function uniqueInOrder(values: string[]) {
  return [...new Set(values)];
}

function renderMarkdown(modes: BlogFormulaV2ComparisonModeRow[]): string {
  const lines: string[] = ['# Blog Formula V2 Provider Comparison', ''];
  for (const row of modes) {
    lines.push(`## ${row.mode}`, '');
    if (row.skipped) {
      lines.push(`Skipped: ${row.reason}`, '');
      continue;
    }
    lines.push(
      `- model: \`${row.model}\``,
      `- formulaSetId: \`${row.formulaSetId}\``,
      `- schemaVersion: \`${row.schemaVersion}\``,
      `- qualityIssues: ${row.qualityIssueCount}` +
        (row.qualityIssueCodes.length > 0 ? ` (${row.qualityIssueCodes.join(', ')})` : ''),
      '',
      'Title patterns:',
      ''
    );
    for (const pattern of row.titlePatterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push('', '| block | status | confidence |', '| --- | --- | --- |');
    for (const key of BLOCK_KEYS) {
      const block = row.blocks[key];
      lines.push(`| ${key} | ${block.status} | ${block.confidence} |`);
    }
    if (row.qualityIssues.length > 0) {
      lines.push('', 'Quality issues:', '');
      for (const issue of row.qualityIssues) {
        lines.push(`- \`${issue.code}\` (${issue.block}): ${issue.message}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function buildBlogFormulaV2ProviderComparison(
  entries: BlogFormulaV2ComparisonInputEntry[]
): BlogFormulaV2ProviderComparisonReport {
  const modes: BlogFormulaV2ComparisonModeRow[] = entries.map((entry) => {
    if (entry.skipped) {
      return { mode: entry.mode, skipped: true, reason: entry.reason };
    }
    return {
      mode: entry.mode,
      skipped: false,
      model: entry.model,
      formulaSetId: entry.formulaSetId,
      schemaVersion: entry.formula.schemaVersion,
      titlePatterns: entry.formula.titleFormula.map((title) => title.pattern),
      blocks: blockSummaries(entry.formula),
      qualityIssueCount: entry.qualityIssues.length,
      qualityIssueCodes: uniqueInOrder(entry.qualityIssues.map((issue) => issue.code)),
      qualityIssues: entry.qualityIssues
    };
  });

  const compared = modes.filter((row) => !row.skipped);
  const qualityIssueTotals: Record<string, number> = {};
  for (const row of compared) {
    if (!row.skipped) qualityIssueTotals[row.mode] = row.qualityIssueCount;
  }

  const blocksWithStatusDifferences = BLOCK_KEYS.filter((key) => {
    const statuses = new Set(
      compared.flatMap((row) => (row.skipped ? [] : [row.blocks[key].status]))
    );
    return statuses.size > 1;
  });

  return {
    modes,
    summary: {
      comparedModes: compared.map((row) => row.mode),
      skippedModes: modes.filter((row) => row.skipped).map((row) => row.mode),
      qualityIssueTotals,
      blocksWithStatusDifferences: [...blocksWithStatusDifferences]
    },
    markdown: renderMarkdown(modes)
  };
}
