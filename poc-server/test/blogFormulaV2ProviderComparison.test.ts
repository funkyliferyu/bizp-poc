import { describe, expect, it } from 'vitest';
import { buildBlogFormulaV2ProviderComparison } from '../src/storeLearning/blogFormulaV2/providerComparison.js';
import { parseStoredBlogFormulaV2 } from '../src/storeLearning/blogFormulaV2/types.js';
import type { BlogFormulaV2QualityIssue } from '../src/storeLearning/blogFormulaV2/formulaQuality.js';
import { generationReadyFormulaFixture } from './fixtures/blogFormulaV2Fixtures.js';

const formula = parseStoredBlogFormulaV2(generationReadyFormulaFixture);

const noIssues: BlogFormulaV2QualityIssue[] = [];
const oneIssue: BlogFormulaV2QualityIssue[] = [
  {
    code: 'title_pattern_not_slot_based',
    block: 'titleFormula',
    message: '슬롯 기반 패턴이 아닙니다: "그냥 제목"'
  }
];

describe('buildBlogFormulaV2ProviderComparison', () => {
  it('builds per-mode rows with block statuses, title patterns, and quality issue codes', () => {
    const report = buildBlogFormulaV2ProviderComparison([
      {
        mode: 'deterministic',
        model: 'deterministic-blog-formula-v2',
        formulaSetId: 'set_det',
        formula,
        qualityIssues: noIssues
      },
      {
        mode: 'openai',
        model: 'gpt-4o-mini',
        formulaSetId: 'set_oai',
        formula,
        qualityIssues: oneIssue
      }
    ]);

    expect(report.modes.map((row) => row.mode)).toEqual(['deterministic', 'openai']);

    const det = report.modes[0];
    expect(det.skipped).toBe(false);
    if (det.skipped) throw new Error('unreachable');
    expect(det.model).toBe('deterministic-blog-formula-v2');
    expect(det.formulaSetId).toBe('set_det');
    expect(det.schemaVersion).toBe('blog_formula_v2.1');
    expect(det.titlePatterns).toEqual(formula.titleFormula.map((entry) => entry.pattern));
    expect(det.blocks.titleFormula).toEqual({ status: 'confirmed', confidence: 0.8 });
    expect(det.blocks.medicalSafetyFormula).toEqual({ status: 'confirmed', confidence: 0.8 });
    expect(det.qualityIssueCount).toBe(0);
    expect(det.qualityIssueCodes).toEqual([]);

    const oai = report.modes[1];
    if (oai.skipped) throw new Error('unreachable');
    expect(oai.qualityIssueCount).toBe(1);
    expect(oai.qualityIssueCodes).toEqual(['title_pattern_not_slot_based']);
  });

  it('records skipped modes with their reason and excludes them from the summary', () => {
    const report = buildBlogFormulaV2ProviderComparison([
      {
        mode: 'deterministic',
        model: 'deterministic-blog-formula-v2',
        formulaSetId: 'set_det',
        formula,
        qualityIssues: noIssues
      },
      { mode: 'openai', skipped: true, reason: 'OpenAI client is unavailable' }
    ]);

    const oai = report.modes[1];
    expect(oai.skipped).toBe(true);
    if (!oai.skipped) throw new Error('unreachable');
    expect(oai.reason).toBe('OpenAI client is unavailable');
    expect(report.summary.comparedModes).toEqual(['deterministic']);
    expect(report.summary.skippedModes).toEqual(['openai']);
  });

  it('summarizes quality issue totals and blocks whose status differs across modes', () => {
    const weakerFormula = parseStoredBlogFormulaV2({
      ...generationReadyFormulaFixture,
      ctaFormula: { ...generationReadyFormulaFixture.ctaFormula, status: 'candidate' }
    });

    const report = buildBlogFormulaV2ProviderComparison([
      {
        mode: 'safe_mock',
        model: 'safe-mock-blog-formula-v2',
        formulaSetId: 'set_mock',
        formula,
        qualityIssues: noIssues
      },
      {
        mode: 'openai',
        model: 'gpt-4o-mini',
        formulaSetId: 'set_oai',
        formula: weakerFormula,
        qualityIssues: oneIssue
      }
    ]);

    expect(report.summary.qualityIssueTotals).toEqual({ safe_mock: 0, openai: 1 });
    expect(report.summary.blocksWithStatusDifferences).toEqual(['ctaFormula']);
  });

  it('renders a markdown report with one section per mode', () => {
    const report = buildBlogFormulaV2ProviderComparison([
      {
        mode: 'deterministic',
        model: 'deterministic-blog-formula-v2',
        formulaSetId: 'set_det',
        formula,
        qualityIssues: noIssues
      },
      { mode: 'openai', skipped: true, reason: 'OpenAI client is unavailable' }
    ]);

    expect(report.markdown).toContain('## deterministic');
    expect(report.markdown).toContain('## openai');
    expect(report.markdown).toContain('OpenAI client is unavailable');
    expect(report.markdown).toContain(formula.titleFormula[0].pattern);
  });
});
