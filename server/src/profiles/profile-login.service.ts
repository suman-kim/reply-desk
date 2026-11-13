import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ProfileLockService } from '../browser/profile-lock.service.js';
import { EventsService } from '../events/events.service.js';
import {
  ProfileInUseError,
  YOUTUBE_BROWSER,
  type YoutubeBrowser,
} from '../browser/youtube-browser.js';
import { Profile, ProfileLoginStatus } from './profile.entity.js';
import { ProfilesService, type ProfileView } from './profiles.service.js';

/** 로그인 확인 결과 (계정 관리 화면) */
export interface LoginCheckView {
  /** 고친 프로필 */
  profile: ProfileView;
  /** 화면에 보일 한 줄 (결과와 다음 할 일) */
  message: string;
  /** 문제가 있는지 (경고 띠를 보일지) */
  warning: boolean;
}

/**
 * 프로필 로그인: 일반 크롬을 열어 사람이 로그인하게 하고, 끝나면 Playwright로 채널·화면 언어를 읽는다.
 * 비밀번호는 대시보드에 입력하지도 저장하지도 않는다.
 */
@Injectable()
export class ProfileLoginService {
  /**
   * @param repo 프로필 저장소
   * @param profiles 프로필 서비스
   * @param browser 크롬 조작
   * @param lock 프로필 잠금 (게시 중인 프로필은 열지 않는다)
   * @param events 실시간 이벤트 (헤더·계정 관리의 로그인 상태)
   */
  constructor(
    @InjectRepository(Profile) private readonly repo: Repository<Profile>,
    private readonly profiles: ProfilesService,
    @Inject(YOUTUBE_BROWSER) private readonly browser: YoutubeBrowser,
    private readonly lock: ProfileLockService,
    private readonly events: EventsService,
  ) {}

  /**
   * [크롬 열고 직접 로그인]
   * @param id 프로필 ID
   */
  async openLogin(id: number): Promise<{ message: string }> {
    const profile = await this.profiles.findOrFail(id);
    if (this.lock.isBusy(id))
      throw new ConflictException(
        '이 프로필은 지금 게시 중이에요 · 끝난 뒤 다시 시도해 주세요',
      );
    try {
      await this.browser.openForManualLogin(profile.folderPath);
    } catch {
      throw new ServiceUnavailableException(
        '크롬을 열지 못했어요 · Google Chrome이 설치되어 있는지 확인해 주세요',
      );
    }
    return {
      message:
        '크롬 창에서 구글 로그인을 마치고 창을 닫은 뒤 [로그인 확인]을 눌러 주세요',
    };
  }

  /**
   * [로그인 확인]: 로그인·채널 ID·채널 이름·화면 언어를 읽어 저장한다.
   * @param id 프로필 ID
   */
  async check(id: number): Promise<LoginCheckView> {
    const view = await this.checkAndSave(id);
    this.emitProfile(view.profile);
    return view;
  }

  /** 크롬으로 읽고 저장한다 (check의 본문) */
  private async checkAndSave(id: number): Promise<LoginCheckView> {
    const profile = await this.profiles.findOrFail(id);
    const result = await this.lock
      .run(id, '로그인 확인', () => this.browser.checkLogin(profile.folderPath))
      .catch((err: unknown) => {
        if (err instanceof ProfileInUseError)
          throw new ConflictException(err.message);
        if (err instanceof ConflictException) throw err;
        throw new ServiceUnavailableException(
          `크롬으로 확인하지 못했어요 (${String((err as Error)?.message ?? err)
            .split('\n')[0]
            .slice(0, 80)}) · 잠시 뒤 다시 시도해 주세요`,
        );
      });

    const now = new Date();
    if (!result.loggedIn) {
      await this.repo.update(id, {
        loginStatus: ProfileLoginStatus.NeedsLogin,
        lastCheckedAt: now,
        uiLanguage: result.uiLanguage,
      });
      return {
        profile: await this.profiles.get(id),
        message: `${profile.name}은(는) 로그인되어 있지 않아요 · [크롬 열고 직접 로그인]으로 로그인해 주세요`,
        warning: true,
      };
    }
    if (!result.channelId) {
      await this.repo.update(id, {
        loginStatus: ProfileLoginStatus.NeedsLogin,
        lastCheckedAt: now,
        uiLanguage: result.uiLanguage,
      });
      return {
        profile: await this.profiles.get(id),
        message:
          '로그인은 됐지만 유튜브 채널이 없어요 · 유튜브에서 채널을 만든 뒤 다시 확인해 주세요',
        warning: true,
      };
    }

    const owner = await this.repo.findOneBy({
      channelId: result.channelId,
      id: Not(id),
    });
    if (owner) {
      throw new ConflictException(
        `이 채널은 이미 ${owner.name} 프로필에 연결돼 있어요 · 다른 계정으로 로그인해 주세요`,
      );
    }
    await this.repo.update(id, {
      loginStatus: ProfileLoginStatus.Ok,
      channelId: result.channelId,
      channelTitle: result.channelTitle,
      uiLanguage: result.uiLanguage,
      lastCheckedAt: now,
    });
    const korean = (result.uiLanguage ?? '').toLowerCase().startsWith('ko');
    return {
      profile: await this.profiles.get(id),
      message: korean
        ? `연결 완료 · ${result.channelTitle ?? result.channelId} 채널이 내 채널 목록에 들어갔어요`
        : `연결 완료 · 다만 유튜브 화면 언어가 한국어가 아니에요(${result.uiLanguage ?? '알 수 없음'}) · 유튜브 설정에서 한국어로 바꾸면 게시가 안정적이에요`,
      warning: !korean,
    };
  }

  /**
   * 게시 중 로그인이 풀린 것을 알았을 때: 다시 로그인할 때까지 자동 배정과 게시에서 뺀다.
   * @param id 프로필 ID
   */
  async markLoginLost(id: number): Promise<void> {
    await this.saveLoginLost(id);
    this.emitProfile(await this.profiles.findOrFail(id));
  }

  /**
   * 로그인 상태가 바뀌었음을 화면에 알린다
   * @param profile 프로필
   */
  private emitProfile(profile: {
    id: number;
    name: string;
    loginStatus: ProfileLoginStatus;
  }): void {
    this.events.emit({
      type: 'profile.updated',
      profileId: profile.id,
      name: profile.name,
      loginStatus: profile.loginStatus,
    });
  }

  /** 다시 로그인 필요로 저장한다 */
  private async saveLoginLost(id: number): Promise<void> {
    await this.repo.update(id, {
      loginStatus: ProfileLoginStatus.NeedsLogin,
      lastCheckedAt: new Date(),
    });
  }
}
