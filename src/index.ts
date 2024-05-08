/* eslint-disable prettier/prettier */
import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  LabShell
} from '@jupyterlab/application';
// import { IEditorServices } from '@jupyterlab/codeeditor';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import '../style/index.css';
import _ from 'lodash';
import { Kernel, KernelMessage } from '@jupyterlab/services';

class schemaManager {
  previousSchema: any | null;
  future: Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > | null;
  constructor() {
    this.previousSchema = null;
    this.future = null;
  }
}
interface IPagebreakCell {
  index: number;
  id: string;
  type: string;
  variables: Array<string>;
}
interface IPagebreakScope {
  index: number; //index in the list of cells
  pbNum: number; //index in the list of pagebreak scopes
  exportedVariables: Array<string>; //variables this scope exports
}
type PagebreakSchema = Array<IPagebreakCell>;
type PagebreakScopeList = Array<IPagebreakScope>;

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'Pagebreaks:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension Pagebreaks is activated!!!!');

    const notebook = app.shell?.currentWidget as NotebookPanel;

    const manager = new schemaManager();
    if (notebook) {
      notebook.revealed.then(() => {
        console.log('top level CALL');
        updatePagebreak(app, manager);
      });
    } else {
      // setTimeout(() => {
      //   console.log('timeout CALL');
      //   updatePagebreak(app, manager);
      // }, 1000);
    }

    notebookTracker.currentChanged.connect(() => {
      if (notebookTracker.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell?.currentWidget as NotebookPanel;
        if (notebook) {
          notebook.content.cellInViewportChanged.connect(() => {
            if (notebookTracker.currentWidget instanceof NotebookPanel) {
              const notebook = app.shell?.currentWidget as NotebookPanel;
              if (notebook) {
                notebook.revealed.then(() => {
                  console.log('cellinviewport CALL');
                  updatePagebreak(app, manager);
                });
              }
            }
          });
          notebook.revealed.then(() => {
            console.log('currentChanged CALL');
            updatePagebreak(app, manager);
          });
        }
      }
    });
    notebookTracker.activeCellChanged.connect(() => {
      // console.log('activecell updated!');
      // const registry = app.docRegistry;
      // const factory = registry.getWidgetFactory('Notebook');
      // console.log('found factory', factory?.name);
      // (factory as NotebookWidgetFactory).contentFactory.createCodeCell = lambda;
      if (app.shell?.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell?.currentWidget as NotebookPanel;
        if (notebook) {
          notebook.revealed.then(() => {
            // console.log('notebook revealed');
            // console.log('nb id', notebook.id);
            console.log('activeCellChanged CALL');
            updatePagebreak(app, manager);
            // console.log('current selection is:');
            // console.log(notebook.content.activeCellIndex);
          });
        }
      }
    });
    notebookTracker.widgetUpdated.connect(() => {
      console.log('widget updated');
    });
    if (app.shell.currentWidget instanceof NotebookPanel) {
      console.log('found shell');
      const notebook = app.shell.currentWidget as NotebookPanel;
      Promise.all([notebook.sessionContext.ready]).then(async () => {
        console.log('context CALL');
        updatePagebreak(app, manager);
      });
    }

    (app.shell as LabShell).activeChanged.connect(() => {
      if (app.shell.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell.currentWidget as NotebookPanel;
        if (notebook) {
          notebook.revealed.then(() => {
            console.log('LabShell activeChanged CALL');
            updatePagebreak(app, manager);
            // console.log('current selection is:');
            // console.log(notebook.content.activeCellIndex);
          });
        }
      }
    });

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

function tagNotebookCells(
  notebook: NotebookPanel,
  schema: {
    cellsToScopes:
    | {
      [x: string]: number;
    }
    | undefined;
    scopeList: {
      [x: number]: string[];
    };
    scopes: PagebreakScopeList;
  }
) {
  // if we have a notebook with no real pagebreak cells, dont change the formatting
  if (schema.scopeList[0].find(v => v === 'pagebreaks_simulated')) {
    return;
  }

  console.log('schema', schema.cellsToScopes)
  notebook?.content?.widgets.forEach((cell, index) => {
    // add styling for code cells
    if (cell.model.type === 'code') {
      cell.addClass('jp-pb-pagebreakCodeCell');
      if (schema.cellsToScopes && schema.cellsToScopes[cell.model.id] !== undefined) {
        const scopeNum = schema.cellsToScopes[cell.model.id]

        if (scopeNum !== undefined) {
          console.log('scopenum', scopeNum)
          if (scopeNum % 2 === 0) {
            cell.addClass('jp-pb-pagebreakEven');
          } else {
            cell.addClass('jp-pb-pagebreakOdd');
          }

        }
      }
    } else {
      cell.removeClass('jp-pb-pagebreakCodeCell');
    }


    //add styling for pagebreak cells
    if (
      cell.model.type === 'raw' &&
      cell.model.sharedModel.getSource().startsWith('pb')
    ) {
      cell.addClass('jp-pb-pagebreakCell');
      const scope = schema.scopes.find(cell => (cell.index === index))

      if (scope !== undefined) {

        if (scope.pbNum % 2 === 0) {
          console.log('scopeeven', scope)
          cell.addClass('jp-pb-pagebreakEven')
        } else {
          console.log('scopeodd', scope)
          cell.addClass('jp-pb-pagebreakOdd')
        }
      }

    } else {
      cell.removeClass('jp-pb-pagebreakCell');
    }
  });
}

function buildNotebookSchema(notebook: NotebookPanel) {
  const cellList: PagebreakSchema = [];
  notebook?.content?.widgets.forEach((cell, index) => {
    if (cell.model.type === 'code') {
      const newCell: IPagebreakCell = {
        index: index,
        id: cell.model.id,
        type: cell.model.type,
        variables: []
      };
      cellList.push(newCell);
    } else if (cell.model.type === 'raw') {
      const content = cell.model.sharedModel.getSource();
      if (content.startsWith('pb')) {
        const names = content.split(' ').filter(name => name !== 'pb');
        // console.log('found pb names', names);
        const newCell: IPagebreakCell = {
          index: index,
          id: cell.model.id,
          type: 'pagebreak',
          variables: names
        };
        cellList.push(newCell);
      }
    }
  });
  cellList.sort((cellA, cellB) => cellA.index - cellB.index);

  const scopeList: PagebreakScopeList = cellList
    .filter(cell => cell.type === 'pagebreak')
    .map((cell, index) => ({
      index: cell.index, //index in the list of cells
      pbNum: index, //index in the list of pagebreak scopes
      exportedVariables: cell.variables //variables this scope exports
    }));
  if (scopeList.length === 0) {
    scopeList.push({
      index: cellList.length,
      pbNum: 0,
      exportedVariables: ['pagebreaks_simulated']
    });
  }
  //Builds an Object with structure [cell.id]: matching pagebreak scope
  const cellsToScopes = cellList
    .filter(cell => cell.type === 'code')
    .map(cell => {
      const currentScope = scopeList
        .filter(pbCell => pbCell.index > cell.index)
        ?.sort((cellA, cellB) => cellA.index - cellB.index)
        ?.at(0);
      if (!currentScope) {
        const lastScope = scopeList
          .sort((cellA, cellB) => cellA.index - cellB.index)
          .at(-1);
        if (lastScope) {
          return {
            [cell.id]: lastScope.pbNum + 1
          };
        } else if (scopeList.length === 0) {
          //if we have a nb without any pagebreaks
          return { [cell.id]: 0 };
        } else {
          console.error("Can't find matching scope for cell", cell);
        }
      } else {
        return {
          [cell.id]: currentScope.pbNum
        };
      }
    })
    .reduce((prev, current) => ({
      ...prev,
      ...current
    }));

  return {
    cellsToScopes: cellsToScopes,
    scopeList: scopeList
      .map(cell => ({
        [cell.pbNum]: cell.exportedVariables,
      }))
      .reduce((prev, cur) => ({
        ...prev,
        ...cur
      })),
    scopes: scopeList
  };
}
function sendSchema(
  notebook: NotebookPanel,
  schema: string,
  manager: schemaManager
) {
  // console.log('send Schema');

  const content: KernelMessage.IExecuteRequestMsg['content'] = {
    code: '%pb_update ' + schema,
    silent: true,
    store_history: false
  };
  // const stringSchema = { pagebreakSchema: schema };
  // console.log('schema string:', JSON.stringify(stringSchema));
  const kernel = notebook?.sessionContext?.session?.kernel;
  if (!kernel) {
    throw new Error('Session has no kernel.');
  }
  if (manager.future === null || manager.future.isDisposed) {
    console.log('sending content', schema);
    const future = kernel.requestExecute(content);
    // Handle iopub messages
    future.onIOPub = msg => {
      if (msg.header.msg_type !== 'status') {
        // console.log(msg.content);
      }
    };
    manager.future = future;
  }

  // kernelModel.execute();
}
function updatePagebreak(app: JupyterFrontEnd, manager: schemaManager) {
  const notebook = app.shell?.currentWidget as NotebookPanel;
  const schema = buildNotebookSchema(notebook);
  console.log('schema check');

  // eslint-disable-next-line no-constant-condition
  if (!_.isEqual(manager.previousSchema, schema) || true) {
    // console.log('previous schema', manager.previousSchema);
    if (!notebook.sessionContext || !notebook.sessionContext.session?.kernel) {
      return;
    }
    manager.previousSchema = schema;
    tagNotebookCells(notebook, schema);
    const jsonSchema = JSON.stringify(schema);
    // notebook?.content?.widgets?.map(cell => {
    //   cell.model.setMetadata('pagebreak_schema', jsonSchema);
    // });
    sendSchema(notebook, jsonSchema, manager);
    // console.log('schema changed', jsonSchema);
  }
}
export default plugin;
