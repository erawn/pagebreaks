import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  LabShell
} from '@jupyterlab/application';
// import { IEditorServices } from '@jupyterlab/codeeditor';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import _ from 'lodash';
import '../style/index.css';
import { addCommands } from './commands';
import { pagebreakEventHandlers } from './events';
import { buildNotebookSchema, sendSchema } from './schema';
import { schemaManager } from './schemaManager';
import { tagNotebookCells } from './styling';
import { cleanNbTypes } from './utils';
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
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension pagebreaks is activated!');

    const manager = new schemaManager();

    let eventHandlers: pagebreakEventHandlers | null = null;

    addCommands(app, notebookTracker, () => {
      updatePagebreak(app, manager);
    });

    app.formatChanged.connect(() => {
      console.log('Format CHANGED');
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const startupInterval = setInterval(async () => {
      for (const widget of app.shell.widgets()) {
        if (widget.isVisible) {
          if (widget instanceof NotebookPanel) {
            updatePagebreak(app, manager, widget);
            widget.activate();
            widget.content.activate();
          }
        }
      }
      console.log('Waiting To Focus...');
      // const elements = document.getElementsByClassName('jp-pb-pagebreakCell');
      if (notebookTracker.currentWidget?.content.isVisible) {
        console.log('Focused');
        updatePagebreak(app, manager);
        clearInterval(startupInterval);
        addVariableListWidget(notebookTracker, manager);
      }
    }, 100);
    notebookTracker.restored.then(() => {
      notebookTracker.currentWidget?.revealed.then(() => {
        console.log('current widget');
        updatePagebreak(app, manager);
      });
      notebookTracker.activeCell?.ready.then(() => {
        updatePagebreak(app, manager);
      });
    });
    app.shell.currentChanged?.connect(() => {
      console.log('currentchangedshell', app.shell.currentWidget?.isVisible);
      // const notebook = app.shell?.currentWidget as NotebookPanel;
      // notebook?.content?.widgets.forEach(cell => {
      //   console.log(cell.model)
      // })
      updatePagebreak(app, manager);
    });

    // (app.shell as LabShell).currentWidget.con

    app.started.then(() => {
      console.log('started CALL');
      console.log('startedshell', app.shell.currentWidget?.isVisible);
      // const notebook = app.shell?.currentWidget as NotebookPanel;
      // console.log('cells',notebook.content.widgets.toString())
    });
    app.restored.then(() => {
      console.log('restored');
      console.log('restoredshell', app.shell.currentWidget?.isVisible);
      const notebook = app.shell?.currentWidget as NotebookPanel;
      notebook?.revealed?.then(() => {
        console.log('top level CALL');
        updatePagebreak(app, manager);
      });
    });
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
        if (notebook) {
          notebook.revealed.then(() => {
            console.log('activeCellChanged CALL');
            updatePagebreak(app, manager);
            eventHandlers?.update();
          });
        }
      }
    });
    notebookTracker.widgetUpdated.connect(() => {
      updatePagebreak(app, manager);
      if (
        notebookTracker.currentWidget?.isAttached &&
        notebookTracker.currentWidget instanceof NotebookPanel
      ) {
        const notebook = notebookTracker.currentWidget;
        eventHandlers?.switchNotebooks(notebook.content);
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
        if (notebook) {
          notebook.revealed.then(() => {
            console.log('LabShell activeChanged CALL');
            updatePagebreak(app, manager);
            if (eventHandlers === null) {
              if (notebook.content.isAttached) {
                eventHandlers = new pagebreakEventHandlers(
                  notebook.content,
                  manager
                );
              }
            }
          });
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
  manager: schemaManager,
  notebookIn?: NotebookPanel
) {
  const notebook = (app.shell?.currentWidget as NotebookPanel) ?? notebookIn;
  cleanNbTypes(notebook.content);
  const schema = buildNotebookSchema(notebook);
  // if (orderCells(notebook, schema)) {
  //   schema = buildNotebookSchema(notebook);
  // }
  // console.log('schema check');
  tagNotebookCells(notebook, schema);
  const now = new Date();
  // eslint-disable-next-line no-constant-condition
  if (
    !_.isEqual(manager.previousSchema, schema) ||
    now.getTime() - manager.lastSend.getTime() > 100
  ) {
    // console.log('previous schema', manager.previousSchema);
    if (
      !notebook?.sessionContext ||
      !notebook?.sessionContext?.session?.kernel
    ) {
      return;
    }
    manager.lastSend = now;
    manager.previousSchema = schema;
    const jsonSchema = JSON.stringify(schema);
    sendSchema(notebook, jsonSchema, manager);
    app.shell.currentWidget?.update();
    app.shell.update();
    notebook.update();
  }
}
export default plugin;
