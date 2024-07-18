import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookContent } from '@jupyterlab/nbformat';
import { INotebookTracker } from '@jupyterlab/notebook';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { Signal } from '@lumino/signaling';
import { activeManager } from './activeManager';
import { pagebreakEventHandlers } from './events';
import { sendJSONDiff, sendLog } from './schema';
import { PagebreakInternalSchema } from './types';
class schemaManager {
  previousSchema: PagebreakInternalSchema | null;
  lastSend: Date;
  future: Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > | null;
  previousJSON: INotebookContent | undefined;
  eventHandlers: pagebreakEventHandlers | null;

  constructor() {
    this.previousSchema = null;
    this.future = null;
    this.lastSend = new Date(0);
    this.eventHandlers = null;
  }
  switchNotebooks(
    notebookTracker: INotebookTracker,
    app: JupyterFrontEnd,
    activeManager: activeManager
  ) {
    Signal.disconnectAll(this);
    this.addCommandHooks(app, notebookTracker, activeManager);
    this.addCellChangeHooks(notebookTracker, activeManager);
  }
  addCommandHooks(
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    activeManager: activeManager
  ) {
    const { commands } = app;
    commands.commandExecuted.connect((registry, args) => {
      // console.log('command fired', registry, args);
      switch (args.id) {
        case 'docmanager:rename':
          sendLog(notebookTracker, 'rename document!', activeManager);
          break;
        case 'docmanager:save':
          sendJSONDiff(notebookTracker, this, activeManager);
          break;
        case 'toolbar-button:add-pagebreak':
          sendLog(notebookTracker, 'add_pagebreak', activeManager);
          break;
        case 'toolbar-button:run-pagebreak':
          sendLog(notebookTracker, 'run_pagebreak', activeManager);
          break;
        case 'toolbar-button:merge-pagebreak':
          sendLog(notebookTracker, 'merge_pagebreak', activeManager);
          break;
        case 'notebook:restart-kernel':
          sendLog(notebookTracker, 'restart_kernel', activeManager);
          break;
      }
    }, this);
  }

  addCellChangeHooks(
    tracker: INotebookTracker,
    isActiveManager: activeManager
  ) {
    const notebook = tracker.currentWidget?.content;
    if (notebook === undefined) {
      return;
    }
    // notebook.model?.cells.changed.connect((list, changes) => {
    //   console.log('cell list change', changes);
    // }, this);
    // notebook.cellInViewportChanged.connect((notebook, cell) => {
    //   // console.log('cell in viewport changed', cell);
    //   if (cell.isDisposed) {
    //     console.log('delete cell', cell.model.id);
    //   }
    // }, this);
    // notebook.modelContentChanged.connect(
    //   (slot, args) => console.log('model content changed', args),
    //   this
    // );
    notebook.stateChanged.connect((notebook, args) => {
      // console.log('nb state changed', args);
      if (args.name === 'mode') {
        console.log('finished editing, sending diff');
        sendJSONDiff(tracker, this, isActiveManager);
      } else if (args.name === 'activeCellIndex') {
        console.log('active cell index changed, sending diff');
        sendJSONDiff(tracker, this, isActiveManager);
      }
    }, this);
    // notebook.modelChanged.connect(
    //   (nb, args) => console.log('nb modelChanged', args),
    //   this
    // );
    // notebook.model?.sharedModel.changed.connect((nb, args) => {
    //   console.log('nb shared model changed', args);
    // }, this);
    // notebook.model?.contentChanged.connect(
    //   (nb, args) => console.log('notebook model contentchanged', args),
    //   this
    // );
    // notebook.widgets.forEach(cell => {
    //   cell.model.stateChanged.connect((cell, args) => {
    //     if (args.name === 'executionCount' && args.newValue !== null) {
    //       // console.log('executed cell, sending log', cell.sharedModel.getId());
    //       // sendLog(
    //       //   panel,
    //       //   'CELL RUN:' + cell.sharedModel.getId(),
    //       //   isActiveManager
    //       // );
    //     }
    //     console.log('cell state changed', cell, args);
    //   }, this);
    //   cell.model.contentChanged.connect(
    //     cell => console.log('cell content changed', cell),
    //     this
    //   );
    //   cell.model.metadataChanged.connect(
    //     (cell, args) => console.log('cell metadata changed', cell, args),
    //     this
    //   );
    //   cell.model.sharedModel.changed.connect(
    //     (cell, change) => console.log('cell sharedmodel changed', cell, change),
    //     this
    //   );
    // });
  }
}

export { schemaManager };
