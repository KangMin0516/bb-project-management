import { PartialType } from '@nestjs/swagger';
import { CreateCredentialDto } from './create-credential.dto.js';

export class UpdateCredentialDto extends PartialType(CreateCredentialDto) {}
