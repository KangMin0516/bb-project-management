import { Module } from '@nestjs/common';
import { FILE_STORAGE_PORT } from '../common/ports/file-storage.port.js';
import { S3Adapter } from './infrastructure/s3.adapter.js';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';

/**
 * UploadModule wires the FILE_STORAGE_PORT to the S3-backed adapter.
 * To swap to a different storage backend (R2, GCS, local disk), bind
 * a different implementation here — no other module changes needed.
 */
@Module({
  controllers: [UploadController],
  providers: [
    UploadService,
    S3Adapter,
    { provide: FILE_STORAGE_PORT, useExisting: S3Adapter },
  ],
  exports: [UploadService],
})
export class UploadModule {}
