// import { IEditorServices } from '@jupyterlab/codeeditor';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { ReactWidget } from '@jupyterlab/ui-components';
import { Widget } from '@lumino/widgets';
import _ from 'lodash';
import React from 'react';
import '../style/index.css';
import { pluginStatus } from './types';

class PluginStatusHeader extends ReactWidget {
  constructor() {
    super();
    this.addClass('jp-pb-pluginstatus-header');
    this.id = 'pagebreaks-plugin-status-header';
  }
  render() {
    return (
      <>
        <span className="jp-pb-pluginstatus-maintext">
          Pagebreaks IPython Plugin Inactive!
        </span>
        <br></br>
        <span className="jp-pb-pluginstatus-bottomtext">
          Run '%load_ext pagebreaksip' to load
        </span>
      </>
    );
  }
}
export class activeManager {
  private languageMode: string;
  private activeSetting: boolean;
  private loggingSetting: boolean;
  private languagePromiseWaiting: boolean;
  statusFuture: Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > | null;
  private status: pluginStatus;
  headerWidget: Widget | null;
  private updatePluginThrottle: _.DebouncedFunc<
    (notebook: NotebookPanel) => void
  >;
  //   private pluginActive: boolean;
  constructor() {
    this.languageMode = '';
    this.activeSetting = false;
    this.loggingSetting = false;
    this.languagePromiseWaiting = false;
    this.statusFuture = null;
    this.status = 'unset';
    this.headerWidget = null;
    this.updatePluginThrottle = _.throttle(this.checkIPPlugin, 1000);
    // this.pluginActive = false;
  }
  setLanguageMode(mode: string) {
    this.languageMode = mode;
  }
  setActiveSetting(newSetting: boolean) {
    // console.log('setting active to ', newSetting);
    this.activeSetting = newSetting;
  }
  setLoggingSetting(newSetting: boolean) {
    // console.log('setting logging to ', newSetting);
    this.loggingSetting = newSetting;
  }
  //   isActive(): boolean {
  //     return this.pluginActive;
  //   }

  findLanguageSetting(notebookTracker: INotebookTracker) {
    if (
      notebookTracker?.currentWidget?.sessionContext.session?.kernel
        ?.connectionStatus === 'connected'
    ) {
      if (!this.languagePromiseWaiting) {
        const promise =
          notebookTracker?.currentWidget?.sessionContext?.session?.kernel?.requestKernelInfo();
        promise
          .then(msg => {
            const message = msg?.content as KernelMessage.IInfoReply;
            console.log('setting language mode', message.language_info.name);
            this.setLanguageMode(message.language_info.name);
          })
          .finally(() => {
            this.languagePromiseWaiting = false;
          });
        this.languagePromiseWaiting = true;
      }
    }
  }

  checkisActive(notebookTracker: INotebookTracker): boolean {
    if (this.languageMode === '') {
      this.findLanguageSetting(notebookTracker);
    }
    if (!this.activeSetting || this.languageMode !== 'python') {
      return false;
    } else {
      return true;
    }
  }

  isActive(): boolean {
    if (!this.activeSetting || this.languageMode !== 'python') {
      return false;
    } else {
      return true;
    }
  }
  checkIsLogging(): boolean {
    // console.log('logging check:', this.loggingSetting);
    return this.loggingSetting;
  }

  checkIPPlugin(notebook: NotebookPanel) {
    // console.log('send Schema');

    if (this.languageMode !== 'python') {
      this.setPluginStatus('unset', notebook);
      return;
    }
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: 'print("extensions: ", get_ipython().extension_manager.loaded)\nprint(get_ipython().ast_transformers)',
      silent: true,
      store_history: false
    };

    const kernel = notebook?.sessionContext?.session?.kernel;
    if (!kernel) {
      console.log('Session has no kernel.');
      return;
    }

    if (this.statusFuture === null || this.statusFuture.isDisposed) {
      // console.log('sending Schema', schema);
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
            result.content.text.search("'pagebreaksip'") > 0 &&
            result.content.text.search('PagebreaksASTTransformer') > 0
          ) {
            this.setPluginStatus('active', notebook);
            // console.log('Pagebreaks_IP is active!', msg);
          } else if (result.content.text.search('extensions') >= 0) {
            this.setPluginStatus('inactive', notebook);
            // console.log('Pagebreaks_IP is inactive!', msg);
          } else {
            console.log('found weird message!', msg);
          }
        }
      };
      this.statusFuture = future;
    }
  }
  setPluginStatus(newStatus: pluginStatus, notebookPanel: NotebookPanel) {
    if (this.status !== newStatus) {
      console.log('changing status to : ', newStatus);
    }
    this.status = newStatus;
    this.updatePluginStatusHeader(notebookPanel);
  }
  getPluginStatus(): pluginStatus {
    return this.status;
  }

  updatePluginStatusHeader(notebookPanel: NotebookPanel) {
    if (notebookPanel instanceof NotebookPanel) {
      if (this.headerWidget === null) {
        this.headerWidget = new PluginStatusHeader();
      }
      // console.log(this.status);
      if (this.status === 'active') {
        this.headerWidget.setHidden(true);
      } else {
        this.headerWidget.setHidden(false);
      }
      if (!notebookPanel.contentHeader.contains(this.headerWidget)) {
        notebookPanel.contentHeader.addWidget(this.headerWidget);
      }
    }
  }
  updatePlugin(notebookPanel: NotebookPanel) {
    this.updatePluginThrottle(notebookPanel);
  }

  // kernelModel.execute();
}
