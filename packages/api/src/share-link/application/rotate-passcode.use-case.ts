import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import {
  SHARE_LINK_REPOSITORY,
  type ShareLinkRepository,
  type ShareLinkRow,
} from './ports/share-link.repository.js';

export interface RotatePasscodeCommand {
  id: string;
  projectId: string;
  newPasscode: string;
}

const BCRYPT_COST = 10;

@Injectable()
export class RotatePasscodeUseCase {
  constructor(
    @Inject(SHARE_LINK_REPOSITORY)
    private readonly repo: ShareLinkRepository,
  ) {}

  async execute(cmd: RotatePasscodeCommand): Promise<ShareLinkRow> {
    if (cmd.newPasscode.length < 6 || cmd.newPasscode.length > 64) {
      throw new BadRequestException(
        'Passcode must be between 6 and 64 characters',
      );
    }
    const link = await this.repo.findByIdScoped(cmd.id, cmd.projectId);
    if (!link) throw new NotFoundException('Share link not found');

    const passcodeHash = await hash(cmd.newPasscode, BCRYPT_COST);
    return this.repo.rotatePasscode(link.id, passcodeHash);
  }
}
