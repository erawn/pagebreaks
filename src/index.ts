/* eslint-disable prettier/prettier */
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
import { buildNotebookSchema, orderCells, sendSchema } from './schema';
import { schemaManager } from './schemaManager';
import { tagNotebookCells } from './styling';


const plugin: JupyterFrontEndPlugin<void> = {
  id: 'Pagebreaks:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry | null,
  ) => {
    console.log('JupyterLab extension Pagebreaks is activated!');

    const manager = new schemaManager();

    addCommands(app, notebookTracker)

    app.formatChanged.connect(() => {
      console.log('Format CHANGED')
    })

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setInterval(() => {
      // console.log('interval CALL', app.shell.currentWidget?.isVisible);
      if (app.shell.currentWidget?.isVisible) {
        updatePagebreak(app, manager);
      } else {
        app.shell.update();
        updatePagebreak(app, manager);
        console.log()
      }
    }, 1000)
    notebookTracker.restored.then(() => {
      notebookTracker.currentWidget?.revealed.then(() => {
        console.log('curwid', notebookTracker.currentWidget)
        updatePagebreak(app, manager);
      })
      notebookTracker.activeCell?.ready.then(() => {
        updatePagebreak(app, manager);
      })
    })
    app.shell.currentChanged?.connect(() => {
      console.log('currentchangedshell', app.shell.currentWidget?.isVisible)
      // const notebook = app.shell?.currentWidget as NotebookPanel;
      // notebook?.content?.widgets.forEach(cell => {
      //   console.log(cell.model)
      // })
      updatePagebreak(app, manager);
    });

    // (app.shell as LabShell).currentWidget.con

    app.started.then(() => {
      console.log('started CALL');
      console.log('startedshell', app.shell.currentWidget?.isVisible)
      // const notebook = app.shell?.currentWidget as NotebookPanel;
      // console.log('cells',notebook.content.widgets.toString())

    })
    app.restored.then(() => {
      console.log('restored')
      console.log('restoredshell', app.shell.currentWidget?.isVisible)
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
    // notebookTracker.activeCellChanged.connect(() => {
    //   if (app.shell?.currentWidget instanceof NotebookPanel) {
    //     const notebook = app.shell?.currentWidget as NotebookPanel;
    //     if (notebook) {
    //       notebook.revealed.then(() => {
    //         console.log('activeCellChanged CALL');
    //         updatePagebreak(app, manager);
    //       });
    //     }
    //   }
    // });
    // notebookTracker.widgetUpdated.connect(() => {
    //   console.log('widget updated');
    // });
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
          });
        }
      }
    });
    //select whole pagebreak on select header or footer, so users drag whole pagebreaks
    notebookTracker.activeCellChanged.connect((tracker, cell) => {
      if (cell?.model.getMetadata('pagebreakheader')) {
        const notebook = (app.shell.currentWidget as NotebookPanel)
        const scopeNum = manager?.previousSchema?.cellsToScopes?.[cell.model.id] ?? -1;
        const matchingPbIndex = manager?.previousSchema?.scopes.find(
          scope => scope.pbNum === scopeNum)?.index ?? -1;

        if (matchingPbIndex >= 0) {

          const overlappingHeaders = notebook.content.widgets.filter((searchCell, index) =>
            searchCell.model.getMetadata('pagebreakheader') &&
            index < matchingPbIndex &&
            index > notebook.content.activeCellIndex)

          if (overlappingHeaders.length === 0) { //this should always be true when the order is correct, but if its messed up, we need to be able to select the individual headers to fix it 
            notebook.content.extendContiguousSelectionTo(matchingPbIndex)
            notebook.content.update()
          }
        }
      } else if (cell?.model.getMetadata('pagebreak')) {
        const notebook = (app.shell.currentWidget as NotebookPanel)
        const pbNum = manager?.previousSchema?.scopes.find(
          searchCell => searchCell.id === cell.model.id)?.pbNum ?? -1;
        const matchingPbHeader = notebook?.content?.widgets?.find(
          searchCell => (searchCell.model.getMetadata('pagebreakheader') &&
            manager?.previousSchema?.cellsToScopes?.[searchCell.model.id] === pbNum)) ?? undefined

        if (matchingPbHeader !== undefined) {
          const pbIndex = notebook.content.activeCellIndex
          notebook.content.select(matchingPbHeader)
          notebook.content.extendContiguousSelectionTo(pbIndex)
          notebook.content.update()
        }
      }

    })

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('Pagebreaks settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for Pagebreaks.', reason);
        });
    }
  }
};

function updatePagebreak(app: JupyterFrontEnd, manager: schemaManager) {
  const notebook = app.shell?.currentWidget as NotebookPanel;
  let schema = buildNotebookSchema(notebook);
  if (orderCells(notebook, schema)) {
    schema = buildNotebookSchema(notebook);
  }
  // console.log('schema check');
  tagNotebookCells(notebook, schema);
  const now = new Date()
  // eslint-disable-next-line no-constant-condition
  if (!_.isEqual(manager.previousSchema, schema) || (now.getTime() - manager.lastSend.getTime() > 300)) {
    // console.log('previous schema', manager.previousSchema);
    if (!notebook?.sessionContext || !notebook?.sessionContext?.session?.kernel) {
      return;
    }
    manager.lastSend = now
    manager.previousSchema = schema;
    const jsonSchema = JSON.stringify(schema);
    sendSchema(notebook, jsonSchema, manager);
    app.shell.currentWidget?.update()
    app.shell.update()
    notebook.update()
  }
}
export default plugin;