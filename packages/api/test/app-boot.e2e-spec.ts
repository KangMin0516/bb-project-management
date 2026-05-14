import { describe, expect, it } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * DI-graph smoke test. Boots AppModule with a stub PrismaService so
 * the test doesn't need a live Postgres — its job is to catch
 * `UnknownDependenciesException` and similar wiring bugs at
 * compile() time, before any DB call. Run as part of CI to fail
 * fast when a refactor breaks DI.
 */
describe('AppModule boot', () => {
  it('compiles the full DI graph without unresolved dependencies', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(stubPrisma())
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});

/** Bare-minimum Prisma stub — every method touched during module
 *  init is no-oped. Real DB calls happen at request time, so init
 *  only needs the lifecycle hooks not to throw. */
function stubPrisma(): Partial<PrismaService> {
  return {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: async () => {},
    $disconnect: async () => {},
  } as unknown as PrismaService;
}
