import { NotebookPanel } from '@jupyterlab/notebook';
import { KernelMessage } from '@jupyterlab/services';
import { schemaManager } from './schemaManager';
import { IPagebreakCell, PagebreakSchema, PagebreakScopeList } from './types';

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
        [cell.pbNum]: cell.exportedVariables
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

export { buildNotebookSchema, sendSchema };
