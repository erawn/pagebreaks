import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  LabShell
} from '@jupyterlab/application';
// import { IEditorServices } from '@jupyterlab/codeeditor';
import { ISessionContextDialogs } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import _ from 'lodash';
import '../style/index.css';
import { addCommands } from './commands';
import { pagebreakEventHandlers } from './events';
import { buildNotebookSchema, checkIPPlugin, sendSchema } from './schema';
import { schemaManager } from './schemaManager';
import { tagNotebookCells } from './styling';
import { cleanNbTypes, ensurePBCellsAreUndeleteable } from './utils';
import { addVariableListWidget } from './variableListToolbar';
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'pagebreaks:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry | null,
    sessionDialogs: ISessionContextDialogs,
    paths: JupyterFrontEnd.IPaths
  ) => {
    console.log('JupyterLab extension pagebreaks is activated!');
    const manager = new schemaManager();

    // const logger = new Logger();
    // logger.attachTransport(logObj => {
    //   appendFileSync('logs.txt', JSON.stringify(logObj) + '\n');
    // });

    // logger.debug('I am a debug log.');
    // logger.info('I am an info log.');
    // logger.warn('I am a warn log with a json object:', { foo: 'bar' });

    addCommands(
      app,
      notebookTracker,
      () => {
        updatePagebreak(app, notebookTracker, manager);
      },
      manager,
      sessionDialogs
    );

    app.formatChanged.connect(() => {
      console.log('Format CHANGED');
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const startupInterval = setInterval(async () => {
      // for (const widget of app.shell.widgets()) {
      //   if (widget.isVisible) {
      //     if (widget instanceof NotebookPanel) {
      //       updatePagebreak(app, notebookTracker, manager, false, widget);
      //       widget.activate();
      //       widget.content.activate();
      //     }
      //   }
      // }
      console.log('Waiting To Reveal...');
      // const elements = document.getElementsByClassName('jp-pb-pagebreakCell');
      const notebook = notebookTracker.currentWidget;
      if (notebook?.content.isVisible && notebook.isRevealed) {
        console.log('Visible and Revealed');
        // console.log('notebooks:');
        // notebookTracker.forEach(panel => {
        //   console.log(panel.content.widgets);
        //   console.log(
        //     'status',
        //     panel.isAttached,
        //     panel.isDisposed,
        //     panel.isHidden,
        //     panel.isRevealed,
        //     panel.isVisible
        //   );
        // });
        // console.log('end Notebooks');
        // console.log('isattached', notebookTracker.currentWidget?.isAttached);
        // console.log('current widget', notebookTracker.currentWidget);
        // console.log(
        //   'current widget cells',
        //   notebookTracker.currentWidget?.content.widgets
        // );
        // notebook.activate();
        // notebook.content.activate();
        // notebook.content.node.focus();
        // if (notebookTracker.activeCell === null) {
        //   console.log('selecting first cell');
        //   notebook.content.select(notebook.content.widgets[0]);
        // }
        // if (app.shell.currentWidget === null) {
        //   console.log(notebookTracker.currentWidget?.id);
        //   app.shell.activateById(notebookTracker.currentWidget?.id ?? '');
        //   app.shell.update();
        //   app.shell.node.focus();
        //   app.shell.node.click();
        // }
        // console.log(notebookTracker.activeCell);
        // notebookTracker.activeCell?.node.focus();
        // notebookTracker.activeCell?.node.click();
        // notebookTracker.activeCell?.node.dispatchEvent(new MouseEvent('click'));
        // console.log('sending update');
        updatePagebreak(app, notebookTracker, manager, true);
        clearInterval(startupInterval);
        addVariableListWidget(notebookTracker, manager);
        const kernel = notebook?.sessionContext?.session?.kernel;
        kernel?.connectionStatusChanged.connect(slot => {
          updatePagebreak(app, notebookTracker, manager, true);
          checkIPPlugin(notebook, manager);
        });
        notebook?.sessionContext?.connectionStatusChanged.connect(() => {
          updatePagebreak(app, notebookTracker, manager);
          checkIPPlugin(notebook, manager);
        });
      }
    }, 100);
    notebookTracker.restored.then(() => {
      notebookTracker.currentWidget?.revealed.then(() => {
        console.log('current widget');
        updatePagebreak(app, notebookTracker, manager);
      });
      notebookTracker.activeCell?.ready.then(() => {
        updatePagebreak(app, notebookTracker, manager);
      });
    });
    // app.shell.currentChanged?.connect(() => {
    //   console.log('currentchangedshell', app.shell.currentWidget?.isVisible);
    //   // const notebook = app.shell?.currentWidget as NotebookPanel;
    //   // notebook?.content?.widgets.forEach(cell => {
    //   //   console.log(cell.model)
    //   // })
    //   updatePagebreak(app, notebookTracker, manager);
    // });

    // (app.shell as LabShell).currentWidget.con

    // app.started.then(() => {
    //   console.log('started CALL');
    //   console.log('startedshell', app.shell.currentWidget?.isVisible);
    //   // const notebook = app.shell?.currentWidget as NotebookPanel;
    //   // console.log('cells',notebook.content.widgets.toString())
    // });
    // app.restored.then(() => {
    //   console.log('restored');
    //   console.log('restoredshell', app.shell.currentWidget?.isVisible);
    //   const notebook = app.shell?.currentWidget as NotebookPanel;
    //   notebook?.revealed?.then(() => {
    //     console.log('top level CALL');
    //     updatePagebreak(app, notebookTracker, manager);
    //   });
    // });
    // const notebook = app.shell?.currentWidget as NotebookPanel;
    // if (notebook) {
    //   console.log('NOTEBOOKEXISTS')

    // }

    // notebookTracker.currentChanged.connect(() => {
    //   if (notebookTracker.currentWidget instanceof NotebookPanel) {
    //     const notebook = app.shell?.currentWidget as NotebookPanel;
    //     if (notebook) {
    //       notebook.content.cellInViewportChanged.connect(() => {
    //         if (notebookTracker.currentWidget instanceof NotebookPanel) {
    //           const notebook = app.shell?.currentWidget as NotebookPanel;
    //           if (notebook) {
    //             notebook.revealed.then(() => {
    //               console.log('cellinviewport CALL');
    //               updatePagebreak(app, manager);
    //             });
    //           }
    //         }
    //       });
    //       notebook.revealed.then(() => {
    //         console.log('currentChanged CALL');
    //         updatePagebreak(app, manager);
    //       });
    //     }
    //   }
    // });
    notebookTracker.activeCellChanged.connect(() => {
      if (app.shell?.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell?.currentWidget as NotebookPanel;
        if (notebook && notebook.isRevealed) {
          console.log('activeCellChanged CALL');
          checkIPPlugin(notebook, manager);
          manager.updatePluginStatusHeader(notebook);
          updatePagebreak(app, notebookTracker, manager);
          manager.eventHandlers?.update();
        }
      }
    });
    notebookTracker.widgetUpdated.connect(() => {
      updatePagebreak(app, notebookTracker, manager);
      if (
        notebookTracker.currentWidget?.isAttached &&
        notebookTracker.currentWidget instanceof NotebookPanel
      ) {
        const notebook = notebookTracker.currentWidget;
        manager.eventHandlers?.switchNotebooks(notebook.content);
      }
    });
    // if (app.shell.currentWidget instanceof NotebookPanel) {
    //   console.log('found shell');
    //   const notebook = app.shell.currentWidget as NotebookPanel;
    //   Promise.all([notebook.sessionContext.ready]).then(async () => {
    //     console.log('context CALL');
    //     updatePagebreak(app, manager);
    //   });
    // }

    (app.shell as LabShell).activeChanged.connect(() => {
      if (app.shell.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell.currentWidget as NotebookPanel;
        if (notebook && notebook.isRevealed) {
          console.log('LabShell activeChanged CALL');

          updatePagebreak(app, notebookTracker, manager);
        }
      }
    });

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('pagebreaks settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for pagebreaks.', reason);
        });
    }
  }
};

function updatePagebreak(
  app: JupyterFrontEnd,
  notebookTracker: INotebookTracker,
  manager: schemaManager,
  force: boolean = false,
  notebookIn?: NotebookPanel
) {
  // console.log(
  //   'updating pagebreak',
  //   notebookTracker.currentWidget?.content.widgets
  // );
  const notebook = notebookTracker.currentWidget;
  if (notebook === undefined || notebook === null) {
    console.error('ERROR: notebook was undefined or null!!!');
    return;
  }
  if (!manager.eventHandlers) {
    if (notebook.content.isAttached) {
      manager.eventHandlers = new pagebreakEventHandlers(
        notebook.content,
        manager
      );
    }
  }
  // console.log('passedCheck', notebook.content.widgets);
  cleanNbTypes(notebook?.content);
  ensurePBCellsAreUndeleteable(notebook?.content);
  const schema = buildNotebookSchema(notebook);
  // if (orderCells(notebook, schema)) {
  //   schema = buildNotebookSchema(notebook);
  // }
  // console.log('tagging', schema);
  tagNotebookCells(notebook, schema);
  const now = new Date();
  // eslint-disable-next-line no-constant-condition
  if (
    !_.isEqual(manager.previousSchema, schema) ||
    now.getTime() - manager.lastSend.getTime() > 100 ||
    force
  ) {
    // console.log('previous schema', manager.previousSchema);
    if (
      !notebook?.sessionContext ||
      !notebook?.sessionContext?.session?.kernel ||
      force
    ) {
      return;
    }
    manager.lastSend = now;
    manager.previousSchema = schema;
    const jsonSchema = JSON.stringify(schema);
    sendSchema(notebook, jsonSchema, manager);
    notebook.update();
  }
}
export default plugin;
