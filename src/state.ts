import { INotebookTracker } from '@jupyterlab/notebook';
import { Kernel, KernelMessage } from '@jupyterlab/services';

import '../style/index.css';
import {
  PagebreakInternalSchema,
  pagebreakSettings,
  pluginStatus
} from './types';
import { PluginStatusHeader } from './statusHeader';
import { INotebookContent } from '@jupyterlab/nbformat';
import { pagebreakEventHandlers } from './events';

export class pagebreaksState {
  loggingSetting: boolean;
  status: pluginStatus;
  headerWidget: PluginStatusHeader | null;
  previousSchema: PagebreakInternalSchema | null;
  future: Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > | null;
  previousJSON: INotebookContent | undefined;
  eventHandlers: pagebreakEventHandlers | null;
  settings: pagebreakSettings | Partial<pagebreakSettings>;

  //   private pluginActive: boolean;
  constructor() {
    this.status = 'unset';
    this.loggingSetting = false;
    this.headerWidget = null;
    // this.pluginActive = false;
    this.previousSchema = null;
    this.future = null;
    this.eventHandlers = null;
    this.settings = {};
  }

  updateSettings(settings: Partial<pagebreakSettings>) {
    this.settings = { ...this.settings, ...settings };
  }

  async checkPagebreaksStatus(kernel: Kernel.IKernelConnection) {
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: 'print("extensions: ", get_ipython().extension_manager.loaded)\nprint(get_ipython().ast_transformers)',
      silent: true,
      store_history: false
    };

    const future = kernel.requestExecute(content);
    // Handle iopub messages
    future.onIOPub = msg => {
      // eslint-disable-next-line no-constant-condition
      if (
        msg.header.msg_type !== 'status' &&
        msg.header.msg_type !== 'stream'
      ) {
        console.log('checkIPPlugin', msg.header.msg_type, msg.content);
      }
      if (KernelMessage.isStreamMsg(msg)) {
        const result = msg as KernelMessage.IStreamMsg;
        // console.log(result);
        if (
          result.content.text.search("'pagebreaksip'") > 0
          // && result.content.text.search('PagebreaksASTTransformer') > 0
        ) {
          this.setPluginStatus('active');
        } else if (result.content.text.search('extensions') >= 0) {
          this.setPluginStatus('inactive');
        } else {
          console.log('found weird message!', msg);
        }
      }
    };
    await future.done;
  }

  async checkIPPlugin(
    notebookTracker: INotebookTracker
  ): Promise<void | pluginStatus> {
    // console.log('send Schema');
    const notebook = notebookTracker.currentWidget!;
    const kernel = notebook.sessionContext?.session?.kernel;
    if (!kernel) {
      console.log('Session has no kernel.');
      return;
    }

    // await notebook.sessionContext?.session?.kernel?.requestKernelInfo()
    //     .then(msg => {
    //         const message = msg?.content as KernelMessage.IInfoReply;
    //         console.log('setting language mode', message.language_info.name);
    //         this.languageMode = message.language_info.name
    //     }).catch(() => {
    //         this.languageMode = "unset"
    //     })

    // if (this.languageMode !== 'python') {
    //     console.log("not python", this.languageMode)
    //     return
    // }

    await this.checkPagebreaksStatus(kernel);
    this.setPluginStatus(this.status);
    console.log('pb status', this.status);
    return this.status;
  }
  setPluginStatus(newStatus: pluginStatus) {
    if (this.status !== newStatus) {
      console.log('changing status to : ', newStatus);
    }
    this.status = newStatus;
    this.headerWidget?.updateHeader(this.status);
  }
  getPluginStatus(): pluginStatus {
    return this.status;
  }

  // private updatePluginStatusHeader(notebookPanel: NotebookPanel) {
  //     if (notebookPanel instanceof NotebookPanel) {
  //         if (this.headerWidget === null) {
  //             this.headerWidget = new PluginStatusHeader();
  //         }
  //         // console.log(this.status);
  //         if (this.status === 'active' || this.status === 'unset') {
  //             this.headerWidget.setHidden(true);
  //         } else {
  //             this.headerWidget.setHidden(false);
  //         }
  //         if (!notebookPanel.contentHeader.contains(this.headerWidget)) {
  //             notebookPanel.contentHeader.addWidget(this.headerWidget);
  //         }
  //     }
  // }
}
