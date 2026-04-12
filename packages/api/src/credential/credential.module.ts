import { Module } from '@nestjs/common';
import { CredentialController } from './credential.controller.js';
import { CredentialService } from './credential.service.js';

@Module({
  controllers: [CredentialController],
  providers: [CredentialService],
  exports: [CredentialService],
})
export class CredentialModule {}
