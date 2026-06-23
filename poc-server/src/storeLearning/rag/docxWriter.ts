import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { StoreInfoRagDocument, StoreReviewRagDocument } from './ragDocumentTypes.js';

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true })]
  });
}

function paragraph(text: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text })]
  });
}

function muted(text: string) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, color: '666666', size: 20 })]
  });
}

export async function createInfoDocxBuffer(document: StoreInfoRagDocument): Promise<Buffer> {
  const children: Paragraph[] = [
    heading(document.title, HeadingLevel.TITLE),
    muted(`생성일: ${document.generatedAt}`)
  ];

  for (const section of document.sections) {
    children.push(heading(section.title, HeadingLevel.HEADING_1));
    for (const line of section.lines) {
      children.push(paragraph(line));
    }
  }

  if (document.warnings.length > 0) {
    children.push(heading('주의사항', HeadingLevel.HEADING_1));
    for (const warning of document.warnings) children.push(paragraph(warning));
  }

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

export async function createReviewsDocxBuffer(document: StoreReviewRagDocument): Promise<Buffer> {
  const children: Paragraph[] = [
    heading(document.title, HeadingLevel.TITLE),
    muted(`생성일: ${document.generatedAt}`),
    paragraph(`총 수집 리뷰: ${document.totalCollectedReviews}개 / 문서 포함 리뷰: ${document.includedReviewCount}개`),
    paragraph(`선정 기준: ${document.samplingStrategy}`)
  ];

  for (const entry of document.entries) {
    const reviewer = entry.reviewerName ? ` - ${entry.reviewerName}` : '';
    const date = entry.reviewDate ? ` (${entry.reviewDate})` : '';
    const rating = entry.rating !== null ? ` / 평점 ${entry.rating}` : '';
    children.push(heading(`[리뷰 ${entry.ordinal}]${date}${reviewer}${rating}`, HeadingLevel.HEADING_2));
    children.push(paragraph(entry.bodyText));
    if (entry.ownerReplyText) children.push(paragraph(`▶ 사장님 답글: ${entry.ownerReplyText}`));
  }

  if (document.warnings.length > 0) {
    children.push(heading('주의사항', HeadingLevel.HEADING_1));
    for (const warning of document.warnings) children.push(paragraph(warning));
  }

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
