import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { idParam } from '../common/id-param.js';
import {
  createProfileSchema,
  updateProfileSchema,
  type CreateProfileDto,
  type UpdateProfileDto,
} from './profile.schemas.js';
import { ProfileLoginService } from './profile-login.service.js';
import { ProfilesService } from './profiles.service.js';

/**
 * 크롬 프로필(계정 관리) API.
 * - GET    /api/profiles       목록 (오늘 게시 수, 쓰는 주제 포함)
 * - POST   /api/profiles       만들기 { name, slug? } → 폴더도 만든다
 * - GET    /api/profiles/:id   하나
 * - PATCH  /api/profiles/:id   이름 바꾸기 { name }
 * - DELETE /api/profiles/:id   지우기 (크롬 폴더는 남긴다)
 * - POST   /api/profiles/:id/login   [크롬 열고 직접 로그인] (일반 크롬을 그 프로필로 연다)
 * - POST   /api/profiles/:id/check   [로그인 확인] (채널 ID·이름·화면 언어를 읽어 저장)
 */
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly login: ProfileLoginService,
  ) {}

  /**
   * [크롬 열고 직접 로그인]
   * @param id 프로필 ID
   */
  @Post(':id/login')
  openLogin(@Param('id', { schema: idParam }) id: number) {
    return this.login.openLogin(id);
  }

  /**
   * [로그인 확인]
   * @param id 프로필 ID
   */
  @Post(':id/check')
  check(@Param('id', { schema: idParam }) id: number) {
    return this.login.check(id);
  }

  /** 목록 */
  @Get()
  list() {
    return this.profiles.list();
  }

  /**
   * 만들기
   * @param dto 이름과 폴더 이름
   */
  @Post()
  create(@Body({ schema: createProfileSchema }) dto: CreateProfileDto) {
    return this.profiles.create(dto);
  }

  /**
   * 하나
   * @param id 프로필 ID
   */
  @Get(':id')
  get(@Param('id', { schema: idParam }) id: number) {
    return this.profiles.get(id);
  }

  /**
   * 이름 바꾸기
   * @param id 프로필 ID
   * @param dto 새 이름
   */
  @Patch(':id')
  update(
    @Param('id', { schema: idParam }) id: number,
    @Body({ schema: updateProfileSchema }) dto: UpdateProfileDto,
  ) {
    return this.profiles.update(id, dto);
  }

  /**
   * 지우기
   * @param id 프로필 ID
   */
  @Delete(':id')
  remove(@Param('id', { schema: idParam }) id: number) {
    return this.profiles.remove(id);
  }
}
