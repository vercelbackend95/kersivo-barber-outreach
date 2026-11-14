import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_POLICY_DIRECT_ANSWER,
  CANCELLATION_POLICY_HOW_TO_USE,
  CANCELLATION_POLICY_TITLE,
} from './cancellationPolicyTemplatePage';
import { NO_SHOW_CALCULATOR_TITLE, NO_SHOW_HERO, NO_SHOW_HOW_TO_USE } from './noShowCalculatorPage';
import { CHAIR_RENT_CALCULATOR_TITLE, CHAIR_RENT_HERO, HOW_TO_USE_SECTION } from './chairRentCalculatorPage';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const words = (text: string) => text.trim().split(/\s+/).length;

/** The first <p> after </h1> in a template must render the given expression. */
function firstParagraphAfterH1(source: string): string {
  const afterH1 = source.slice(source.indexOf('</h1>'));
  const match = afterH1.match(/<p\b[^>]*>([^<]*)<\/p>/);
  return match?.[1].trim() ?? '';
}

const TOOLS = [
  {
    name: 'cancellation policy template',
    title: CANCELLATION_POLICY_TITLE,
    search: /barbershop cancellation policy template uk/i,
    answer: CANCELLATION_POLICY_DIRECT_ANSWER,
    template: 'src/pages/barbershop-cancellation-policy-template/index.astro',
    expression: '{CANCELLATION_POLICY_DIRECT_ANSWER}',
    steps: CANCELLATION_POLICY_HOW_TO_USE,
    stepsTemplate: 'src/pages/barbershop-cancellation-policy-template/index.astro',
    stepsExpression: '{CANCELLATION_POLICY_HOW_TO_USE.steps.map(',
  },
  {
    name: 'no-show calculator',
    title: NO_SHOW_CALCULATOR_TITLE,
    search: /no-show cost calculator/i,
    answer: NO_SHOW_HERO.lead,
    template: 'src/pages/barbershop-no-show-calculator/index.astro',
    expression: '{NO_SHOW_HERO.lead}',
    steps: NO_SHOW_HOW_TO_USE,
    stepsTemplate: 'src/pages/barbershop-no-show-calculator/index.astro',
    stepsExpression: '{NO_SHOW_HOW_TO_USE.steps.map(',
  },
  {
    name: 'chair rent calculator',
    title: CHAIR_RENT_CALCULATOR_TITLE,
    search: /chair rent vs commission/i,
    answer: CHAIR_RENT_HERO.lead,
    template: 'src/components/chairRentCalculator/ChairRentHero.astro',
    expression: '{CHAIR_RENT_HERO.lead}',
    steps: HOW_TO_USE_SECTION,
    stepsTemplate: 'src/components/chairRentCalculator/ChairRentSections.astro',
    stepsExpression: '{HOW_TO_USE_SECTION.steps.map(',
  },
] as const;

describe('free tools: direct answers and how-to steps', () => {
  for (const tool of TOOLS) {
    describe(tool.name, () => {
      it('keeps a title that already contains the main search', () => {
        expect(tool.title).toMatch(tool.search);
        expect(tool.title.length).toBeLessThanOrEqual(60);
      });

      it('has a 40–60 word direct answer as the first paragraph under the H1', () => {
        expect(words(tool.answer)).toBeGreaterThanOrEqual(40);
        expect(words(tool.answer)).toBeLessThanOrEqual(60);
        expect(tool.answer).toMatch(/\bfree\b/);
        expect(firstParagraphAfterH1(read(tool.template))).toBe(tool.expression);
      });

      it('renders a short "How to use it" ordered list', () => {
        expect(tool.steps.heading).toBe('How to use it');
        expect(tool.steps.steps).toHaveLength(3);
        const source = read(tool.stepsTemplate);
        const at = source.indexOf(tool.stepsExpression);
        expect(at).toBeGreaterThan(-1);
        expect(source.lastIndexOf('<ol', at)).toBeGreaterThan(source.lastIndexOf('</ol>', at));
      });
    });
  }
});
