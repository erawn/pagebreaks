import { Kernel, KernelMessage } from '@jupyterlab/services';
class schemaManager {
  previousSchema: any | null;
  lastSend: Date;
  future: Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > | null;
  constructor() {
    this.previousSchema = null;
    this.future = null;
    this.lastSend = new Date(0);
  }
}

export { schemaManager };
