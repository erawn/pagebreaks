import { Kernel, KernelMessage } from '@jupyterlab/services';
import { pagebreakEventHandlers } from './events';
import { PagebreakInternalSchema } from './types';
class schemaManager {
  previousSchema: PagebreakInternalSchema | null;
  lastSend: Date;
  future: Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > | null;
  eventHandlers: pagebreakEventHandlers | null;
  constructor() {
    this.previousSchema = null;
    this.future = null;
    this.lastSend = new Date(0);
    this.eventHandlers = null;
  }
}

export { schemaManager };
