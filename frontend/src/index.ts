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

    const notebook = app.shell.currentWidget as NotebookPanel;

    const manager = new schemaManager();
    if (notebook) {
      notebook.revealed.then(() => {
        updatePagebreak(app, manager);
      });
    }

    notebookTracker.activeCellChanged.connect(() => {
      // console.log('activecell updated!');
      // const registry = app.docRegistry;
      // const factory = registry.getWidgetFactory('Notebook');
      // console.log('found factory', factory?.name);
      // (factory as NotebookWidgetFactory).contentFactory.createCodeCell = lambda;
      if (app.shell.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell.currentWidget as NotebookPanel;
        if (notebook) {
          notebook.revealed.then(() => {
            // console.log('notebook revealed');
            // console.log('nb id', notebook.id);
            updatePagebreak(app, manager);
            // console.log('current selection is:');
            // console.log(notebook.content.activeCellIndex);
          });
        }
      }
    });

    (app.shell as LabShell).activeChanged.connect(() => {
      if (app.shell.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell.currentWidget as NotebookPanel;
        if (notebook) {
          notebook.revealed.then(() => {
            // console.log('notebook revealed');
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

function tagNotebookCells(notebook: NotebookPanel) {
  notebook?.content?.widgets.forEach((cell, index) => {
    if (cell.model.type === 'code') {
      cell.addClass('jp-pb-pagebreakCodeCell');
    } else {
      cell.removeClass('jp-pb-pagebreakCodeCell');
    }

    if (
      cell.model.type === 'raw' &&
      cell.model.sharedModel.getSource().startsWith('pb')
    ) {
      cell.addClass('jp-pb-pagebreakCell');
    } else {
      cell.removeClass('jp-pb-pagebreakCell');
    }
  });
}
function buildNotebookSchema(notebook: NotebookPanel) {
  const schema: PagebreakSchema = [];
  notebook?.content?.widgets.forEach((cell, index) => {
    if (cell.model.type === 'code') {
      const newCell: IPagebreakCell = {
        index: index,
        id: cell.model.id,
        type: cell.model.type,
        variables: []
      };
      schema.push(newCell);
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
        schema.push(newCell);
      }
    }
  });
  schema.sort((cellA, cellB) => cellA.index - cellB.index);
  // const pagebreakCells = schema.filter(cell => cell.type === 'pagebreak');
  // pagebreakCells.sort((cellA, cellB) => cellA.index - cellB.index);
  // const pagebreakSchema = pagebreakCells.map((cell, index) => ({
  //   [cell.index]: cell.variables
  // }));
  // const currentPagebreak = 0;
  // for (let index = 0; index < numCells; index++) {
  //   const cell = schema.find(cell => cell.index === index);
  // }

  const scopeList: PagebreakScopeList = schema
    .filter(cell => cell.type === 'pagebreak')
    .map((cell, index) => ({
      index: cell.index, //index in the list of cells
      pbNum: index, //index in the list of pagebreak scopes
      exportedVariables: cell.variables //variables this scope exports
    }));
  //Builds an Object with structure [cell.id]: matching pagebreak scope
  const cellsToScopes = schema
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
        } else {
          console.error("Can't find matching scope for cell", cell);
          return {};
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
        [cell.pbNum]: cell.exportedVariables
      }))
      .reduce((prev, cur) => ({
        ...prev,
        ...cur
      }))
  };
}
function sendSchema(
  notebook: NotebookPanel,
  schema: string,
  manager: schemaManager
) {
  console.log('send Schema');

  const content: KernelMessage.IExecuteRequestMsg['content'] = {
    code: '%pb_update ' + schema
  };
  // const stringSchema = { pagebreakSchema: schema };
  // console.log('schema string:', JSON.stringify(stringSchema));
  const kernel = notebook?.sessionContext?.session?.kernel;
  if (!kernel) {
    throw new Error('Session has no kernel.');
  }
  if (manager.future === null || manager.future.isDisposed) {
    console.log('sending content', schema);
    const future = kernel.requestExecute(content, true, {});
    // Handle iopub messages
    future.onIOPub = msg => {
      if (msg.header.msg_type !== 'status') {
        console.log(msg.content);
      }
    };
    manager.future = future;
  }

  // kernelModel.execute();
}
function updatePagebreak(app: JupyterFrontEnd, manager: schemaManager) {
  const notebook = app.shell.currentWidget as NotebookPanel;
  const schema = buildNotebookSchema(notebook);
  console.log('schema check');
  if (!_.isEqual(manager.previousSchema, schema)) {
    // console.log('previous schema', manager.previousSchema);
    if (!notebook.sessionContext || !notebook.sessionContext.session?.kernel) {
      return;
    }
    manager.previousSchema = schema;
    tagNotebookCells(notebook);
    // const jsonSchema: any = schema.map(
    //   (value, index) => ({
    //     [value.id]: {
    //       index: value.index,
    //       id: value.id,
    //       type: value.type,
    //       variables: value.variables ? value.variables.toLocaleString() : ''
    //     }
    //   }),
    //   {}
    // );
    const jsonSchema = JSON.stringify(schema);
    notebook?.content?.widgets.map(cell => {
      cell.model.setMetadata('pagebreak_schema', jsonSchema);
    });
    sendSchema(notebook, jsonSchema, manager);
    // console.log('schema changed', jsonSchema);
  }
}
export default plugin;
