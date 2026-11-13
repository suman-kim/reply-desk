import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AiProviderInfo } from '../ai/ai-provider.js';
import type { Env } from '../config/env.schema.js';
import { AppSetting } from './app-setting.entity.js';
import {
  OLLAMA_BASE_URL,
  SETTING_DEFINITIONS,
  type SettingDefinition,
} from './setting-definitions.js';

/** 화면에 내보내는 설정 한 줄 */
export interface SettingView {
  /** 설정 키 */
  key: string;
  /** 이름 */
  label: string;
  /** 도움말 */
  help: string;
  /** 지금 값 */
  value: unknown;
  /** 기본값 */
  defaultValue: unknown;
  /** 기본값에서 바꿨는지 */
  isDefault: boolean;
}

/**
 * 공용 설정 읽기·쓰기. 값은 정의의 스키마로 검증하고, 저장된 값이 없으면 기본값을 쓴다.
 */
@Injectable()
export class SettingsService {
  /**
   * @param repo 설정 저장소
   * @param config 환경 변수 (AI 키가 있는지 볼 때 쓴다)
   */
  constructor(
    @InjectRepository(AppSetting) private readonly repo: Repository<AppSetting>,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * 설정 값 하나를 읽는다. 저장된 값이 정의와 맞지 않으면(예: 예전 모양) 기본값을 쓴다.
   * @param def 설정 정의
   */
  async get<T>(def: SettingDefinition<T>): Promise<T> {
    const row = await this.repo.findOneBy({ key: def.key });
    if (!row) return def.defaultValue;
    const parsed = def.schema.safeParse(row.value);
    return parsed.success ? parsed.data : def.defaultValue;
  }

  /** 모든 설정을 화면용으로 읽는다 */
  async list(): Promise<SettingView[]> {
    const rows = await this.repo.findBy({
      key: In(SETTING_DEFINITIONS.map((d) => d.key)),
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return SETTING_DEFINITIONS.map((def) => {
      const stored = byKey.has(def.key)
        ? def.schema.safeParse(byKey.get(def.key))
        : null;
      const value = stored?.success ? stored.data : def.defaultValue;
      return {
        key: def.key,
        label: def.label,
        help: def.help,
        value,
        defaultValue: def.defaultValue,
        isDefault: !stored?.success,
      };
    });
  }

  /**
   * 설정 값 하나를 바꾼다.
   * @param key 설정 키
   * @param value 새 값 (정의의 스키마로 검증한다)
   */
  async update(key: string, value: unknown): Promise<SettingView> {
    const def = SETTING_DEFINITIONS.find((d) => d.key === key);
    if (!def) throw new NotFoundException(`"${key}" 설정은 없어요`);
    const parsed = def.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => `${def.label}: ${i.message}`),
      );
    }
    await this.repo.save({ key, value: parsed.data });
    return (await this.list()).find((s) => s.key === key)!;
  }

  /**
   * 설정 값 하나를 기본값으로 되돌린다.
   * @param key 설정 키
   */
  async reset(key: string): Promise<SettingView> {
    const def = SETTING_DEFINITIONS.find((d) => d.key === key);
    if (!def) throw new NotFoundException(`"${key}" 설정은 없어요`);
    await this.repo.delete({ key });
    return (await this.list()).find((s) => s.key === key)!;
  }

  /**
   * AI 제공자마다 지금 쓸 수 있는지 알려 준다 (설정 화면에서 고를 때 보여 줄 안내).
   * Ollama가 실제로 켜져 있는지는 분석·작성 작업에서 확인한다.
   */
  async aiProviders(): Promise<AiProviderInfo[]> {
    const hasGemini =
      this.config.get('GEMINI_API_KEY', { infer: true }).length > 0;
    const hasClaude =
      this.config.get('ANTHROPIC_API_KEY', { infer: true }).length > 0;
    const ollamaUrl = await this.get(OLLAMA_BASE_URL);
    return [
      {
        id: 'gemini',
        label: 'Gemini',
        ready: hasGemini,
        note: hasGemini
          ? '유튜브 영상을 직접 보고 분석해요'
          : 'GEMINI_API_KEY가 없어요 · server/.env에 넣어 주세요',
        canWatchVideo: true,
      },
      {
        id: 'claude',
        label: 'Claude',
        ready: hasClaude,
        note: hasClaude
          ? '자막과 영상 정보로 분석하고, 댓글을 잘 써요'
          : 'ANTHROPIC_API_KEY가 없어요 · server/.env에 넣어 주세요',
        canWatchVideo: false,
      },
      {
        id: 'ollama',
        label: 'Ollama (이 맥에서 돌리는 AI)',
        ready: true,
        note: `${ollamaUrl}에서 돌아요 · 키가 필요 없고, 모델은 미리 받아 두세요 (ollama pull)`,
        canWatchVideo: false,
      },
    ];
  }
}
