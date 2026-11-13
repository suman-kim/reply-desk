import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppSetting } from './app-setting.entity.js';
import {
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
 * AI 제공자 안내는 ai 모듈(AiService.providerInfos)이 맡는다.
 */
@Injectable()
export class SettingsService {
  /**
   * @param repo 설정 저장소
   */
  constructor(
    @InjectRepository(AppSetting) private readonly repo: Repository<AppSetting>,
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
    const def = this.definition(key);
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
    this.definition(key);
    await this.repo.delete({ key });
    return (await this.list()).find((s) => s.key === key)!;
  }

  /** 키로 정의를 찾고, 없으면 404 */
  private definition(key: string): SettingDefinition<unknown> {
    const def = SETTING_DEFINITIONS.find((d) => d.key === key);
    if (!def) throw new NotFoundException(`"${key}" 설정은 없어요`);
    return def;
  }
}
