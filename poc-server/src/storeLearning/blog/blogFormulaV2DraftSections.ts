export type V2DraftTopicContext = {
  topic?: string | null;
  mainKeyword?: string | null;
  ctaDirection?: string | null;
};

export type V2DraftSection = {
  heading: string;
  body: string;
};

type V2DraftLike = {
  blogDraft: string;
};

function topicValue(topicBrief: V2DraftTopicContext, key: 'topic' | 'mainKeyword') {
  const value = topicBrief[key]?.trim();
  if (value) return value;
  const fallback = key === 'topic' ? topicBrief.mainKeyword?.trim() : topicBrief.topic?.trim();
  return fallback || '본문';
}

function sectionHeading(index: number, topicBrief: V2DraftTopicContext) {
  const topic = topicValue(topicBrief, 'topic');
  const mainKeyword = topicValue(topicBrief, 'mainKeyword');
  const headings = [
    `${topic} 상담 전 확인할 점`,
    `${mainKeyword} 핵심 안내`,
    topicBrief.ctaDirection ? '상담 전 확인사항' : '예약 전 확인사항'
  ];
  return headings[index] ?? `${topic} 추가 안내`;
}

function fallbackBody(topicBrief: V2DraftTopicContext) {
  const mainKeyword = topicValue(topicBrief, 'mainKeyword');
  return `${mainKeyword} 상담 전에는 개인차, 부작용 가능성, 의료진 상담 필요성을 함께 확인해 주세요.`;
}

function draftBlocks(blogDraft: string) {
  return blogDraft
    .replace(/\r\n/gu, '\n')
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean);
}

function markdownHeadingBlock(block: string) {
  const match = block.match(/^#{1,6}\s+([^\n]+)(?:\n+([\s\S]+))?$/u);
  if (!match) return null;
  return {
    heading: match[1]?.trim() ?? '',
    body: match[2]?.trim() ?? ''
  };
}

function ensureMinimumSections(sections: V2DraftSection[], topicBrief: V2DraftTopicContext) {
  const padded = [...sections];
  while (padded.length < 3) {
    const index = padded.length;
    padded.push({
      heading: sectionHeading(index, topicBrief),
      body: fallbackBody(topicBrief)
    });
  }
  return padded;
}

export function bodySectionsFromV2Draft(output: V2DraftLike, topicBrief: V2DraftTopicContext) {
  const blocks = draftBlocks(output.blogDraft);
  const hasMarkdownHeadings = blocks.some((block) => markdownHeadingBlock(block));
  if (!hasMarkdownHeadings) {
    return ensureMinimumSections(
      blocks.map((body, index) => ({
        heading: sectionHeading(index, topicBrief),
        body
      })),
      topicBrief
    );
  }

  const sections: V2DraftSection[] = [];
  const prelude: string[] = [];
  let current: { heading: string; bodyBlocks: string[] } | null = null;

  const pushCurrent = () => {
    if (!current) return;
    sections.push({
      heading: current.heading || sectionHeading(sections.length, topicBrief),
      body: current.bodyBlocks.join('\n\n') || fallbackBody(topicBrief)
    });
    current = null;
  };

  for (const block of blocks) {
    const headingBlock = markdownHeadingBlock(block);
    if (headingBlock) {
      if (current) {
        pushCurrent();
      } else if (prelude.length > 0) {
        sections.push({
          heading: sectionHeading(sections.length, topicBrief),
          body: prelude.join('\n\n')
        });
        prelude.length = 0;
      }
      current = { heading: headingBlock.heading, bodyBlocks: [] };
      if (headingBlock.body) current.bodyBlocks.push(headingBlock.body);
      continue;
    }

    if (current) {
      current.bodyBlocks.push(block);
    } else {
      prelude.push(block);
    }
  }

  pushCurrent();
  if (prelude.length > 0) {
    sections.push({
      heading: sectionHeading(sections.length, topicBrief),
      body: prelude.join('\n\n')
    });
  }

  return ensureMinimumSections(sections, topicBrief);
}

export function imagePromptForV2Section(
  section: { heading: string; body: string },
  topicBrief: V2DraftTopicContext,
  index: number
) {
  const mainKeyword = topicValue(topicBrief, 'mainKeyword');
  const placement = index === 0 ? '대표 이미지' : `본문 이미지 ${index + 1}`;
  const bodySummary = section.body.replace(/\s+/gu, ' ').slice(0, 70);
  return `${mainKeyword} ${placement}: "${section.heading}" 단락의 내용을 표현하는 이미지 설명 - ${bodySummary}`;
}
