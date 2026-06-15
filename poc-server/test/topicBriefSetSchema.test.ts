import { describe, expect, it } from 'vitest';
import {
  TopicBriefSetV2Schema,
  TopicBriefSetV2ResponseFormatSchema
} from '../src/storeLearning/blogFormulaV2/types.js';

describe('TopicBriefSetV2 schemas', () => {
  it('parses a full topic brief set with single-post evidence', () => {
    const parsed = TopicBriefSetV2Schema.parse({
      id: 'tbs_1',
      sourcePostIds: ['collection_item_v2_owner_1'],
      confidence: 0.7,
      status: 'candidate',
      topic: '리팟레이저',
      mainKeyword: '리팟레이저 부작용',
      secondaryKeywords: ['흑자 제거'],
      targetReader: '리팟레이저 정보를 찾는 고객',
      coreConcern: '부작용 걱정',
      mainAngle: '원리 설명 중심',
      mustInclude: ['개인차'],
      mustAvoid: [],
      ctaDirection: '상담 안내'
    });
    expect(parsed.sourcePostIds).toEqual(['collection_item_v2_owner_1']);
    expect(parsed.status).toBe('candidate');
  });

  it('accepts nullable interpretive fields', () => {
    const parsed = TopicBriefSetV2Schema.parse({
      id: 'tbs_2',
      sourcePostIds: ['p2'],
      confidence: 0.4,
      status: 'candidate',
      topic: '울쎄라',
      mainKeyword: '울쎄라',
      secondaryKeywords: [],
      targetReader: null,
      coreConcern: null,
      mainAngle: null,
      mustInclude: [],
      mustAvoid: [],
      ctaDirection: null
    });
    expect(parsed.targetReader).toBeNull();
  });

  it('response-format schema parses an array of model items keyed by post id', () => {
    const parsed = TopicBriefSetV2ResponseFormatSchema.parse({
      topicBriefSets: [
        {
          id: 'collection_item_v2_owner_1',
          topic: '리팟레이저',
          mainKeyword: '리팟레이저 부작용',
          secondaryKeywords: ['흑자 제거'],
          targetReader: null,
          coreConcern: '부작용 걱정',
          mainAngle: '원리 설명',
          mustInclude: ['개인차'],
          mustAvoid: [],
          ctaDirection: '상담 안내'
        }
      ]
    });
    expect(parsed.topicBriefSets[0].id).toBe('collection_item_v2_owner_1');
  });
});
