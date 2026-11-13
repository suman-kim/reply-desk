import {
  countChars,
  type CheckContext,
  type CheckResult,
  type DraftCheck,
} from './check.types.js';

/** 결과 한 줄을 만든다 */
function result(
  check: { code: string },
  label: string,
  passed: boolean,
  detail: string,
): CheckResult {
  return { code: check.code, label, passed, detail };
}

/** 1. 길이: 주제의 최소~최대 글자 수 안인지 */
export class LengthCheck implements DraftCheck {
  readonly code = 'length';

  appliesTo(): boolean {
    return true;
  }

  run(ctx: CheckContext): CheckResult {
    const n = countChars(ctx.text.trim());
    const { minLength, maxLength } = ctx.topic;
    if (n < minLength) {
      return result(
        this,
        '길이',
        false,
        `${n}자예요 · ${minLength}자 이상으로 늘려 주세요`,
      );
    }
    if (n > maxLength) {
      return result(
        this,
        '길이',
        false,
        `${n}자예요 · ${maxLength}자 이하로 줄여 주세요`,
      );
    }
    return result(this, '길이', true, `${n}/${maxLength}자`);
  }
}

/**
 * 시점(04:12)을 댓글에서 쓸 법한 표현들로 바꾼다.
 * 예: 04:12 → ['04:12', '4:12', '4분']
 * @param time mm:ss 또는 h:mm:ss
 */
export function timeVariants(time: string): string[] {
  const parts = time.split(':').map((p) => Number(p));
  if (parts.some((p) => Number.isNaN(p)) || parts.length < 2) return [];
  const variants = new Set<string>([time]);
  if (parts.length === 2) {
    const [m, s] = parts;
    variants.add(`${m}:${String(s).padStart(2, '0')}`);
    if (m > 0) variants.add(`${m}분`);
  } else {
    const [h, m] = parts;
    variants.add(`${h}시간 ${m}분`);
  }
  return [...variants];
}

/** 2. 장면 언급: 영상 속 장면(핵심 단어나 시점)을 짚었는지. 맥락 이해의 증거다 */
export class SceneMentionCheck implements DraftCheck {
  readonly code = 'scene_mention';

  appliesTo(): boolean {
    return true;
  }

  run(ctx: CheckContext): CheckResult {
    if (!ctx.analysis) {
      return result(
        this,
        '장면 언급',
        false,
        '영상 분석이 없어 확인할 수 없어요 · 다시 생성해 주세요',
      );
    }
    const candidates = [
      ...ctx.analysis.sceneKeywords,
      ...ctx.analysis.sceneTimes.flatMap(timeVariants),
    ].filter((w) => w.trim().length > 0);
    const hit = candidates.find((w) => ctx.text.includes(w));
    return hit
      ? result(this, '장면 언급', true, `"${hit}" 언급`)
      : result(
          this,
          '장면 언급',
          false,
          '영상 속 장면을 짚지 않았어요 · 시점이나 장면 속 말을 넣어 주세요',
        );
  }
}

/** 3. 브랜드 언급: 브랜드 단어가 딱 한 번 들어갔는지. 여러 번이면 광고처럼 보인다 */
export class BrandMentionCheck implements DraftCheck {
  readonly code = 'brand_mention';

  appliesTo(): boolean {
    return true;
  }

  run(ctx: CheckContext): CheckResult {
    const word = ctx.topic.brandWord;
    const label = `${word} 언급`;
    const count = word ? ctx.text.split(word).length - 1 : 0;
    if (count === 0)
      return result(
        this,
        label,
        false,
        `"${word}"이(가) 없어요 · 한 번 넣어 주세요`,
      );
    if (count > 1)
      return result(
        this,
        label,
        false,
        `${count}번 나와요 · 한 번만 넣어 주세요`,
      );
    return result(this, label, true, '1번');
  }
}

/** 링크로 보이는 글 (http, www., 도메인 형태) */
const LINK_PATTERN =
  /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|kr|co|io|me|ly|gg|link|shop|site)\b)/i;
/** 해시태그 (#다음에 글자) */
const HASHTAG_PATTERN = /#[^\s#]+/;

/** 4. 링크·해시태그 없음: 스팸으로 보이거나 유튜브가 숨기는 요소를 막는다 */
export class NoLinkHashtagCheck implements DraftCheck {
  readonly code = 'no_link_hashtag';

  appliesTo(): boolean {
    return true;
  }

  run(ctx: CheckContext): CheckResult {
    if (LINK_PATTERN.test(ctx.text)) {
      return result(
        this,
        '링크·해시태그 없음',
        false,
        '링크가 들어 있어요 · 지워 주세요',
      );
    }
    if (HASHTAG_PATTERN.test(ctx.text)) {
      return result(
        this,
        '링크·해시태그 없음',
        false,
        '해시태그가 들어 있어요 · 지워 주세요',
      );
    }
    return result(this, '링크·해시태그 없음', true, '없음');
  }
}

/**
 * 직접 겪은 것처럼 쓰는 표현. 브랜드를 써 봤다고 지어내면 거짓 후기가 된다.
 * "잘 본다던데"처럼 들은 말, "보고 싶다"처럼 바람은 괜찮다.
 */
const FAKE_REVIEW_PATTERNS: RegExp[] = [
  /후기/,
  // 직접 받아 본 경험 ("영상 봤는데"처럼 영상을 본 말은 걸리지 않게 '받아 봤'만 잡는다)
  /(받아\s?봤|받아\s?보니|받았더니|받았는데|다녀왔|다녀와\s?봤|상담\s?받)/,
  // 결과가 맞았다는 말
  /(맞았어|맞췄|맞더라|용하더라|정확했|정확하더라|소름\s?돋게\s?맞)/,
  /추천(해요|합니다|드려요)/,
];

/** 5. 지어낸 후기 없음: 써 본 척, 효과를 본 척하는 문장을 막는다 */
export class NoFakeReviewCheck implements DraftCheck {
  readonly code = 'no_fake_review';

  appliesTo(): boolean {
    return true;
  }

  run(ctx: CheckContext): CheckResult {
    const hit = FAKE_REVIEW_PATTERNS.map((p) => ctx.text.match(p)?.[0]).find(
      Boolean,
    );
    return hit
      ? result(
          this,
          '지어낸 후기 없음',
          false,
          `"${hit}"는 써 본 것처럼 읽혀요 · 들은 말이나 궁금증으로 바꿔 주세요`,
        )
      : result(this, '지어낸 후기 없음', true, '없음');
  }
}

/** 6. 주제별 추가 금지 표현 (주제에 금지 표현이 있을 때만) */
export class BannedWordsCheck implements DraftCheck {
  readonly code = 'banned_words';

  appliesTo(ctx: CheckContext): boolean {
    return ctx.topic.bannedWords.some((w) => w.trim().length > 0);
  }

  run(ctx: CheckContext): CheckResult {
    const hit = ctx.topic.bannedWords.find(
      (w) => w.trim() && ctx.text.includes(w.trim()),
    );
    return hit
      ? result(
          this,
          '금지 표현 없음',
          false,
          `금지 표현 "${hit}"이(가) 있어요 · 지워 주세요`,
        )
      : result(this, '금지 표현 없음', true, '없음');
  }
}

/** 기본 검사 목록. 화면의 체크리스트 순서와 같다 */
export const DEFAULT_CHECKS: DraftCheck[] = [
  new LengthCheck(),
  new SceneMentionCheck(),
  new BrandMentionCheck(),
  new NoLinkHashtagCheck(),
  new NoFakeReviewCheck(),
  new BannedWordsCheck(),
];
