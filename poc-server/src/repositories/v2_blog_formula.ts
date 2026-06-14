import type { DbConnection } from '../db/connection.js';
import { createRepository, type BaseEntity, type JsonValue } from './base.js';

export type V2BlogFormulaSet = BaseEntity & {
  storeId: string;
  version: string;
  status: string;
  formula: JsonValue;
  sourcePostIds: JsonValue;
  model: string | null;
};

export type V2BlogFormulaRun = BaseEntity & {
  storeId: string;
  formulaSetId: string | null;
  input: JsonValue;
  output: JsonValue;
  validation: JsonValue;
  model: string | null;
  status: string;
};

export type V2BlogFormulaSourcePost = BaseEntity & {
  formulaSetId: string;
  storeId: string;
  collectionItemId: string;
  title: string | null;
  sourceUrl: string | null;
  charCount: number;
  isTruncated: number;
  usedFor: JsonValue;
};

export type V2BlogTopicBrief = BaseEntity & {
  storeId: string;
  topic: string;
  mainKeyword: string;
  secondaryKeywords: JsonValue;
  targetReader: string | null;
  coreConcern: string | null;
  mainAngle: string | null;
  mustInclude: JsonValue;
  mustAvoid: JsonValue;
  ctaDirection: string | null;
};

export type V2BlogTopicBriefSet = BaseEntity & {
  formulaSetId: string;
  storeId: string;
  sourcePostId: string;
  topic: string;
  mainKeyword: string;
  secondaryKeywords: JsonValue;
  targetReader: string | null;
  coreConcern: string | null;
  mainAngle: string | null;
  mustInclude: JsonValue;
  mustAvoid: JsonValue;
  ctaDirection: string | null;
  confidence: number;
  status: string;
};

export type V2BlogRetrievalRun = BaseEntity & {
  storeId: string;
  topicBriefId: string;
  formulaSetId: string | null;
  input: JsonValue;
  output: JsonValue;
};

export type V2BlogRetrievedSample = BaseEntity & {
  retrievalRunId: string;
  storeId: string;
  collectionItemId: string;
  rank: number;
  totalScore: number;
  scoring: JsonValue;
  whySelected: string | null;
};

export type V2BlogDraftGeneration = BaseEntity & {
  storeId: string;
  generationMode: string;
  formulaSetId: string | null;
  topicBriefId: string | null;
  retrievalRunId: string | null;
  input: JsonValue;
  output: JsonValue;
  selectedTitle: string | null;
  blogDraft: string | null;
  model: string | null;
  status: string;
};

export type V2BlogDraftValidation = BaseEntity & {
  storeId: string;
  draftGenerationId: string;
  validation: JsonValue;
  status: string;
  riskLevel: string;
};

const formulaSetColumns = [
  'id',
  'storeId',
  'version',
  'status',
  'formula',
  'sourcePostIds',
  'model',
  'createdAt',
  'updatedAt'
] as const;

const formulaRunColumns = [
  'id',
  'storeId',
  'formulaSetId',
  'input',
  'output',
  'validation',
  'model',
  'status',
  'createdAt',
  'updatedAt'
] as const;

const sourcePostColumns = [
  'id',
  'formulaSetId',
  'storeId',
  'collectionItemId',
  'title',
  'sourceUrl',
  'charCount',
  'isTruncated',
  'usedFor',
  'createdAt',
  'updatedAt'
] as const;

const topicBriefColumns = [
  'id',
  'storeId',
  'topic',
  'mainKeyword',
  'secondaryKeywords',
  'targetReader',
  'coreConcern',
  'mainAngle',
  'mustInclude',
  'mustAvoid',
  'ctaDirection',
  'createdAt',
  'updatedAt'
] as const;

const topicBriefSetColumns = [
  'id',
  'formulaSetId',
  'storeId',
  'sourcePostId',
  'topic',
  'mainKeyword',
  'secondaryKeywords',
  'targetReader',
  'coreConcern',
  'mainAngle',
  'mustInclude',
  'mustAvoid',
  'ctaDirection',
  'confidence',
  'status',
  'createdAt',
  'updatedAt'
] as const;

const retrievalRunColumns = [
  'id',
  'storeId',
  'topicBriefId',
  'formulaSetId',
  'input',
  'output',
  'createdAt',
  'updatedAt'
] as const;

const retrievedSampleColumns = [
  'id',
  'retrievalRunId',
  'storeId',
  'collectionItemId',
  'rank',
  'totalScore',
  'scoring',
  'whySelected',
  'createdAt',
  'updatedAt'
] as const;

const draftGenerationColumns = [
  'id',
  'storeId',
  'generationMode',
  'formulaSetId',
  'topicBriefId',
  'retrievalRunId',
  'input',
  'output',
  'selectedTitle',
  'blogDraft',
  'model',
  'status',
  'createdAt',
  'updatedAt'
] as const;

const draftValidationColumns = [
  'id',
  'storeId',
  'draftGenerationId',
  'validation',
  'status',
  'riskLevel',
  'createdAt',
  'updatedAt'
] as const;

export function createV2BlogFormulaSetsRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogFormulaSet>(connection, {
    tableName: 'v2_blog_formula_sets',
    columns: formulaSetColumns,
    jsonColumns: ['formula', 'sourcePostIds'],
    columnOverrides: {
      formula: 'formula_json',
      sourcePostIds: 'source_post_ids_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId)
  };
}

export function createV2BlogFormulaRunsRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogFormulaRun>(connection, {
    tableName: 'v2_blog_formula_runs',
    columns: formulaRunColumns,
    jsonColumns: ['input', 'output', 'validation'],
    columnOverrides: {
      input: 'input_json',
      output: 'output_json',
      validation: 'validation_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByFormulaSetId: (formulaSetId: string) => repository.findManyBy('formulaSetId', formulaSetId)
  };
}

export function createV2BlogFormulaSourcePostsRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogFormulaSourcePost>(connection, {
    tableName: 'v2_blog_formula_source_posts',
    columns: sourcePostColumns,
    jsonColumns: ['usedFor'],
    columnOverrides: {
      usedFor: 'used_for_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByFormulaSetId: (formulaSetId: string) => repository.findManyBy('formulaSetId', formulaSetId)
  };
}

export function createV2BlogTopicBriefsRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogTopicBrief>(connection, {
    tableName: 'v2_blog_topic_briefs',
    columns: topicBriefColumns,
    jsonColumns: ['secondaryKeywords', 'mustInclude', 'mustAvoid'],
    columnOverrides: {
      secondaryKeywords: 'secondary_keywords_json',
      mustInclude: 'must_include_json',
      mustAvoid: 'must_avoid_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId)
  };
}

export function createV2BlogTopicBriefSetsRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogTopicBriefSet>(connection, {
    tableName: 'v2_blog_topic_brief_sets',
    columns: topicBriefSetColumns,
    jsonColumns: ['secondaryKeywords', 'mustInclude', 'mustAvoid'],
    columnOverrides: {
      secondaryKeywords: 'secondary_keywords_json',
      mustInclude: 'must_include_json',
      mustAvoid: 'must_avoid_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByFormulaSetId: (formulaSetId: string) => repository.findManyBy('formulaSetId', formulaSetId)
  };
}

export function createV2BlogRetrievalRunsRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogRetrievalRun>(connection, {
    tableName: 'v2_blog_retrieval_runs',
    columns: retrievalRunColumns,
    jsonColumns: ['input', 'output'],
    columnOverrides: {
      input: 'input_json',
      output: 'output_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByTopicBriefId: (topicBriefId: string) => repository.findManyBy('topicBriefId', topicBriefId)
  };
}

export function createV2BlogRetrievedSamplesRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogRetrievedSample>(connection, {
    tableName: 'v2_blog_retrieved_samples',
    columns: retrievedSampleColumns,
    jsonColumns: ['scoring'],
    columnOverrides: {
      scoring: 'scoring_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByRetrievalRunId: (retrievalRunId: string) => repository.findManyBy('retrievalRunId', retrievalRunId)
  };
}

export function createV2BlogDraftGenerationsRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogDraftGeneration>(connection, {
    tableName: 'v2_blog_draft_generations',
    columns: draftGenerationColumns,
    jsonColumns: ['input', 'output'],
    columnOverrides: {
      input: 'input_json',
      output: 'output_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByFormulaSetId: (formulaSetId: string) => repository.findManyBy('formulaSetId', formulaSetId),
    listByTopicBriefId: (topicBriefId: string) => repository.findManyBy('topicBriefId', topicBriefId)
  };
}

export function createV2BlogDraftValidationsRepository(connection: DbConnection) {
  const repository = createRepository<V2BlogDraftValidation>(connection, {
    tableName: 'v2_blog_draft_validations',
    columns: draftValidationColumns,
    jsonColumns: ['validation'],
    columnOverrides: {
      validation: 'validation_json'
    }
  });
  return {
    ...repository,
    listByStoreId: (storeId: string) => repository.findManyBy('storeId', storeId),
    listByDraftGenerationId: (draftGenerationId: string) =>
      repository.findManyBy('draftGenerationId', draftGenerationId)
  };
}
