import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSIGHTS_PUBLISHED_ARTICLES, buildInsightsArticleJsonLd } from '@/lib/seo/insights';
import { buildLlmsTxt } from '@/pages/llms.txt';
import {
  INSIGHTS_SHORT_ANSWERS,
  INSIGHTS_SHORT_ANSWER_MAX_WORDS,
  INSIGHTS_SHORT_ANSWER_MIN_WORDS,
  findInsightsShortAnswerSlot,
  getInsightsShortAnswer,
} from './insightsShortAnswers';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const words = (text: string) => text.trim().split(/\s+/).length;
const articleSource = (slug: string) => read(`editorial-staging/insights/${slug}-display.md`);

describe('Insights short answers (GEO/AEO stage 1)', () => {
  it('covers every published article and nothing else', () => {
    const published = INSIGHTS_PUBLISHED_ARTICLES.map((article) => article.slug).sort();
    expect(Object.keys(INSIGHTS_SHORT_ANSWERS).sort()).toEqual(published);
  });

  it.each(Object.entries(INSIGHTS_SHORT_ANSWERS))('%s: a question and a quotable 40–80 word answer', (_slug, entry) => {
    expect(entry.question.endsWith('?')).toBe(true);
    expect(words(entry.answer)).toBeGreaterThanOrEqual(INSIGHTS_SHORT_ANSWER_MIN_WORDS);
    expect(words(entry.answer)).toBeLessThanOrEqual(INSIGHTS_SHORT_ANSWER_MAX_WORDS);
    expect(entry.answer.endsWith('.')).toBe(true);
    // Neutral editorial summary: the brand is never the answer.
    expect(entry.answer).not.toMatch(/KERSIVO/i);
  });

  it.each(Object.entries(INSIGHTS_SHORT_ANSWERS))('%s: every figure already appears in the article', (slug, entry) => {
    const source = articleSource(slug);
    const figures = entry.answer.match(/£?\d[\d,.]*\d%?p?|£?\d%?p?/g) ?? [];
    for (const figure of figures) {
      expect(source, `${slug}: "${figure}" is not in the article`).toContain(figure);
    }
  });

  it('places the block after the H1, hero figure and italic notes, before the first body paragraph', () => {
    const html =
      '<h1>Title</h1>\n<figure class="hero"><img src="a.jpg" alt="" /><figcaption>Credit</figcaption></figure>\n' +
      '<p><em>General information, not legal advice.</em></p>\n<p>First body paragraph.</p>\n<h2>Section</h2>';
    const slot = findInsightsShortAnswerSlot(html);
    expect(html.slice(slot).trimStart().startsWith('<p>First body paragraph.</p>')).toBe(true);
  });

  it('does not skip a body paragraph that only starts with emphasis', () => {
    const html = '<h1>Title</h1><figure><img src="a.jpg" alt="" /></figure><p><em>Busy</em> shops queue.</p>';
    const slot = findInsightsShortAnswerSlot(html);
    expect(html.slice(slot)).toBe('<p><em>Busy</em> shops queue.</p>');
  });

  it('returns -1 when there is no H1', () => {
    expect(findInsightsShortAnswerSlot('<p>No heading</p>')).toBe(-1);
  });

  it('is rendered by the article layout and passed to Article JSON-LD as abstract', () => {
    const layout = read('src/layouts/InsightsArticleLayout.astro');
    expect(layout).toContain('<InsightsShortAnswer shortAnswer={shortAnswer} />');
    expect(layout).toContain('abstract: shortAnswer?.answer');

    const article = INSIGHTS_PUBLISHED_ARTICLES[0];
    const answer = getInsightsShortAnswer(article.slug)!.answer;
    const [, payload] = buildInsightsArticleJsonLd({ ...article, abstract: answer }) as Record<string, unknown>[];
    expect(payload.abstract).toBe(answer);
  });

  it('gives /llms.txt the question and answer for every article', () => {
    const llms = buildLlmsTxt('https://kersivo.co.uk');
    for (const article of INSIGHTS_PUBLISHED_ARTICLES) {
      const entry = getInsightsShortAnswer(article.slug)!;
      expect(llms).toContain(`(https://kersivo.co.uk${article.path}): ${entry.question} ${entry.answer}`);
    }
  });
});
