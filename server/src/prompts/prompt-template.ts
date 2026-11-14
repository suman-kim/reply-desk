import { z } from 'zod';

/**
 * 프롬프트 틀. 설정 화면에서 고치는 프롬프트는 글에 {{이름}} 자리를 두고, 코드가 영상·주제 값으로 채운다.
 * (분석 이유에 AI가 쓰는 {조회수} 같은 한 겹 괄호와 겹치지 않게 두 겹 괄호를 쓴다)
 */

/** 자리 표시 {{이름}} */
const SLOT = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** 틀에서 쓸 수 있는 자리 하나 (설정 화면 안내) */
export interface PromptVar {
  /** 자리 이름 (틀에는 {{이름}}으로 쓴다) */
  name: string;
  /** 무엇이 들어가는지 */
  help: string;
}

/**
 * 틀을 채운다. 자리가 있는 줄인데 그 자리가 모두 비면 줄째 뺀다
 * (예: 금지 표현이 없는 주제는 "[쓰면 안 되는 말]" 줄이 없어진다).
 * @param template 틀
 * @param values 자리 이름 → 넣을 값 (여러 줄이어도 된다)
 */
export function renderTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template
    .split('\n')
    .flatMap((line) => {
      const names = [...line.matchAll(SLOT)].map((m) => m[1].trim());
      if (names.length === 0) return [line];
      if (names.every((n) => !values[n])) return [];
      return [line.replace(SLOT, (_, n: string) => values[n.trim()] ?? '')];
    })
    .join('\n');
}

/**
 * 틀에 쓴 자리 중 모르는 이름 (오타 등)
 * @param template 틀
 * @param vars 쓸 수 있는 자리
 */
export function unknownSlots(template: string, vars: PromptVar[]): string[] {
  const known = new Set(vars.map((v) => v.name));
  return [
    ...new Set(
      [...template.matchAll(SLOT)]
        .map((m) => m[1].trim())
        .filter((n) => !known.has(n)),
    ),
  ];
}

/**
 * 프롬프트 글 하나의 검증 (비지 않게, 너무 길지 않게, 모르는 자리 없게)
 * @param label 화면 이름 (오류 안내)
 * @param vars 쓸 수 있는 자리 (없으면 자리를 쓰지 않는 글)
 */
export function promptText(label: string, vars: PromptVar[] = []) {
  return z
    .string()
    .trim()
    .min(10, `${label}을(를) 10자 이상 적어 주세요`)
    .max(8000, `${label}은(는) 8,000자까지예요`)
    .superRefine((text, ctx) => {
      const unknown = unknownSlots(text, vars);
      if (unknown.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `${label}에 모르는 자리가 있어요: ${unknown.map((n) => `{{${n}}}`).join(', ')} · 쓸 수 있는 자리: ${
            vars.length > 0
              ? vars.map((v) => `{{${v.name}}}`).join(', ')
              : '없음'
          }`,
        });
      }
    });
}

/** 응답 모양 한 칸 (설정 화면에 읽기 전용으로 보인다) */
export interface ResponseField {
  /** 칸 이름 (예: scenes.quote) */
  name: string;
  /** AI에게 함께 보내는 설명 */
  description: string;
}

/**
 * 응답 스키마에서 칸 이름과 설명을 뽑는다 (구조화 출력으로 AI에게 함께 가는 글)
 * @param schema 응답 모양
 */
export function responseFields(schema: z.ZodType): ResponseField[] {
  const out: ResponseField[] = [];
  type Node = {
    description?: string;
    properties?: Record<string, Node>;
    items?: Node;
  };
  const walk = (node: Node, prefix: string) => {
    for (const [key, child] of Object.entries(node.properties ?? {})) {
      const name = prefix ? `${prefix}.${key}` : key;
      if (child.description) out.push({ name, description: child.description });
      if (child.items?.properties) walk(child.items, name);
    }
  };
  walk(z.toJSONSchema(schema) as Node, '');
  return out;
}
