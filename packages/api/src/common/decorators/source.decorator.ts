import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { getRequestSource, type SourceLiteral } from '../source.js';

/**
 * Resolves to the `SourceLiteral` set on the request by whichever auth
 * guard ran. Defaults to `WEB` when no guard has tagged the request —
 * keeps controllers that haven't been wired through still working.
 *
 * Usage:
 *   ```
 *   @Post()
 *   create(@Source() source: SourceLiteral, @Body() dto: CreateDto) { ... }
 *   ```
 */
export const Source = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SourceLiteral => {
    return getRequestSource(ctx.switchToHttp().getRequest());
  },
);
