import { Injectable, Logger } from '@nestjs/common';
import { TaskHandler } from './task-handler.interface';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTaskHandler = TaskHandler<any>;

/**
 * Same pattern as JobRegistry: handlers self-register in their
 * constructors so their home modules can wire dependencies without
 * this module knowing about them.
 *
 * Registration is required to be unique per name — double-registration
 * is a bug (probably two handlers claiming the same slug), throw loudly
 * at boot rather than silently overwriting.
 */
@Injectable()
export class TaskHandlerRegistry {
  private readonly logger = new Logger(TaskHandlerRegistry.name);
  private readonly handlers = new Map<string, AnyTaskHandler>();

  register(handler: AnyTaskHandler): void {
    if (this.handlers.has(handler.name)) {
      throw new Error(
        `Duplicate TaskHandler registration: ${handler.name} (already registered by another provider)`,
      );
    }
    this.handlers.set(handler.name, handler);
    this.logger.log(`Registered handler: ${handler.name}`);
  }

  get(name: string): AnyTaskHandler | undefined {
    return this.handlers.get(name);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  list(): string[] {
    return Array.from(this.handlers.keys()).sort();
  }
}
