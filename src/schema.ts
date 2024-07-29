import { ISharedCodeCell } from '@jupyter/ydoc';
import { INotebookContent } from '@jupyterlab/nbformat';
import {
  INotebookTracker,
  NotebookPanel,
  NotebookTracker
} from '@jupyterlab/notebook';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import _ from 'lodash';
import { activeManager } from './activeManager';
import { schemaManager } from './schemaManager';
import { IPagebreakCell, PagebreakSchema, PagebreakScopeList } from './types';
const sendJSONDiffThrottle = _.throttle(sendJSONDiffInner, 200);

function buildNotebookSchema(notebook: NotebookPanel) {
  const cells = notebook.content.widgets;
  notebook.content.model?.sharedModel.cells.at(0)?.cell_type === 'raw';
  // console.log('cells:', cells);
  // for (const cell of cells.values()) {
  //   console.log(cell.model.id);
  // }
  // console.log('cells length', cells.length);
  // cells.forEach(cell => console.log(cell.model.metadata));
  const cellList: PagebreakSchema = [];
  cells.forEach((cell, index) => {
    if (
      cell.model.type === 'raw' &&
      cell.model.getMetadata('pagebreak') === true
    ) {
      const names = cell.model.sharedModel.getSource();
      let variables = parseExport(names);
      if (variables === null) {
        variables = [];
        cell.node.title =
          'Export Statement Poorly Formed, should look like:\n "export { var1 var2 var3 }"';
        cell.editorWidget?.addClass('jp-pb-poorly-formed-export');
      } else {
        cell.node.title = '';
        cell.editorWidget?.removeClass('jp-pb-poorly-formed-export');
      }
      // console.log('found pb names', names);
      const newCell: IPagebreakCell = {
        index: index,
        id: cell.model.id,
        type: 'pagebreak',
        variables: variables ?? []
      };
      cellList.push(newCell);
    } else if (
      cell.model.type === 'markdown' &&
      cell.model.getMetadata('pagebreakheader') === true
    ) {
      const newCell: IPagebreakCell = {
        index: index,
        id: cell.model.id,
        type: 'header',
        variables: []
      };
      cellList.push(newCell);
    } else {
      const newCell: IPagebreakCell = {
        index: index,
        id: cell.model.id,
        type: cell.model.type,
        variables: []
      };
      cellList.push(newCell);
    }
  });
  cellList.sort((cellA, cellB) => cellA.index - cellB.index);

  const scopeList: PagebreakScopeList = cellList
    .filter(cell => cell.type === 'pagebreak')
    .map((cell, index) => ({
      index: cell.index, //index in the list of cells
      pbNum: index, //index in the list of pagebreak scopes
      exportedVariables: cell.variables, //variables this scope exports
      id: cell.id
    }));
  if (scopeList.length === 0) {
    scopeList.push({
      index: cellList.length,
      pbNum: 0,
      exportedVariables: ['pagebreaks_simulated'],
      id: ''
    });
  }
  //Builds an Object with structure [cell.id]: matching pagebreak scope
  const cellsToScopes = cellList
    .filter(cell => cell.type !== 'pagebreak')
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
    .reduce(
      (prev, current) => ({
        ...prev,
        ...current
      }),
      {}
    );

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
    scopes: scopeList,
    cellList: cellList
  };
}
function sendSchema(
  notebook: NotebookPanel,
  schema: string,
  manager: schemaManager
) {
  // console.log('send Schema');

  const content: KernelMessage.IExecuteRequestMsg['content'] = {
    code: '%%pb_update \n' + schema,
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
    console.log('sending Schema');
    const future = kernel.requestExecute(content);
    // Handle iopub messages
    future.onIOPub = msg => {
      // eslint-disable-next-line no-constant-condition
      if (msg.header.msg_type !== 'status') {
        console.log('sendSchema', msg);
      }
    };
    manager.future = future;
  }

  // kernelModel.execute();
}

function parseExport(input: string): string[] | null {
  const outerRE = new RegExp(/export {(.*)}/);

  const outer = outerRE.exec(input);
  // console.log('outer', outer);
  const re = new RegExp(/\s*(\S*)/, 'g');
  // const matched = re.exec(input);
  if (outer) {
    const captureGroup = outer.at(1) ?? '';
    const matches = [...captureGroup.matchAll(re)];
    const vars = matches
      .map(matchArray => matchArray.at(1) ?? '')
      .filter(varName => varName !== '');
    if (vars.some(name => name.search(',') >= 0)) {
      return null;
    }
    return vars;
  }
  // console.log('matches', matches);
  return null;
}
function sendLog(
  notebookTracker: INotebookTracker | NotebookPanel,
  message: string,
  activeManager: activeManager
) {
  // console.log('send Schema');
  if (!activeManager.checkIsLogging()) {
    console.log('Not sending log because its diabled');
    return;
  }

  const notebook =
    notebookTracker instanceof NotebookTracker
      ? notebookTracker.currentWidget
      : (notebookTracker as NotebookPanel);
  const name = notebook?.title.label;
  const content: KernelMessage.IExecuteRequestMsg['content'] = {
    code: '%%pb_log \n' + 'NAME[' + name + ']' + message,
    silent: true,
    store_history: false
  };
  // const stringSchema = { pagebreakSchema: schema };
  // console.log('schema string:', JSON.stringify(stringSchema));
  const kernel = notebook?.sessionContext?.session?.kernel;
  if (!kernel) {
    console.error('Session has no kernel.');
    return;
  }
  // console.log('sending Schema', schema);
  const future = kernel.requestExecute(content);
  // Handle iopub messages
  future.onIOPub = msg => {
    // eslint-disable-next-line no-constant-condition
    if (msg.header.msg_type !== 'status') {
      console.log('sendLog', msg.content);
    }
  };
}
function sendTransform(
  notebookTracker: INotebookTracker | NotebookPanel,
  message: string
):
  | Kernel.IShellFuture<
      KernelMessage.IExecuteRequestMsg,
      KernelMessage.IExecuteReplyMsg
    >
  | undefined {
  const notebook =
    notebookTracker instanceof NotebookTracker
      ? notebookTracker.currentWidget
      : (notebookTracker as NotebookPanel);
  const content: KernelMessage.IExecuteRequestMsg['content'] = {
    code: message,
    silent: true,
    store_history: false
  };
  const kernel = notebook?.sessionContext?.session?.kernel;
  if (!kernel) {
    console.error('Session has no kernel.');
    return undefined;
  }
  // console.log('sending Schema', schema);
  const future = kernel.requestExecute(content);
  // Handle iopub messages

  return future;

  // kernelModel.execute();
}
function sendJSONDiff(
  notebookTracker: INotebookTracker,
  manager: schemaManager,
  isActiveManager: activeManager
) {
  sendJSONDiffThrottle(notebookTracker, manager, isActiveManager);
}

function sendJSONDiffInner(
  notebookTracker: INotebookTracker,
  manager: schemaManager,
  isActiveManager: activeManager
) {
  // console.log('NBFORMAT', notebook.model?.nbformatMinor);
  //from https://github.com/jupyter-server/jupyter_ydoc/blob/eefbbcc7812e53c36ccc7fca9f031513562c0da6/javascript/src/ynotebook.ts#L446
  // strip cell ids if we have notebook format 4.0-4.4
  const notebook = notebookTracker.currentWidget;
  if (notebook === null) {
    return;
  }
  if (notebook.model === undefined || notebook.model === null) {
    return;
  }
  // console.log(notebook.content.title);

  const json: INotebookContent = {
    metadata: notebook.model.sharedModel.metadata,
    nbformat_minor: notebook.model.sharedModel.nbformat_minor,
    nbformat: notebook.model.sharedModel.nbformat,
    notebookName: notebook.title.label,
    cells: notebook.model.sharedModel.cells.map(c => {
      const raw = c.toJSON();
      if (c.cell_type === 'code') {
        // console.log((c as ISharedCodeCell).outputs);
        const outputTypes = (c as ISharedCodeCell)
          .getOutputs()
          .flatMap(output => {
            if (output.data) {
              return Object.keys(output.data);
            } else {
              return [];
            }
          });
        raw.output_types = outputTypes;
        // console.log(outputTypes);
      }
      return raw;
    })
  };

  json.cells.forEach((cell, index) => {
    cell.attachments ? (cell.attachments = {}) : {};
    cell.outputs ? (cell.outputs = {}) : {};
    cell.index = index;
    cell.execution_count ? (cell.execution_count = null) : {};
  });
  if (isActiveManager.checkisActive(notebookTracker)) {
    const schema = buildNotebookSchema(notebook);
    json.cells.forEach((cell, index) => {
      const isHeader = cell.metadata.pagebreakheader === true;
      const isFooter = cell.metadata.pagebreak === true;
      cell.metadata ? (cell.metadata = {}) : {};
      isHeader ? (cell.metadata.pagebreakheader = true) : {};
      isFooter ? (cell.metadata.pagebreak = true) : {};
      const id = cell.id?.toString();
      if (id && schema.cellsToScopes) {
        const scopeNum = schema.cellsToScopes[id];
        if (scopeNum !== undefined) {
          cell.pagebreak = scopeNum;
        }
      }
    });
  }
  // sendLog(notebookTracker, 'NAME' + notebook.title.label, isActiveManager);
  console.log('Sending JSON Log');
  sendLog(
    notebookTracker,
    'RELOAD_NOTEBOOK:' + JSON.stringify(json),
    isActiveManager
  );
}

// function orderCells(notebook: NotebookPanel, schema: PagebreakInternalSchema) {
//   let didModify = false;
//   notebook?.content?.widgets?.forEach((cell, index) => {
//     if (
//       cell.model.getMetadata('pagebreakheader') &&
//       cell.model.type === 'markdown'
//     ) {
//       // console.log('index', index, 'id', cell.model.id);
//       // console.log('cellstoscopes', schema.cellsToScopes);
//       const scopeNum = schema.cellsToScopes?.[cell.model.id] ?? 0;
//       // console.log('scopenum', scopeNum);
//       const matchingPbIndex =
//         schema.scopes.find(scope => scope.pbNum === scopeNum)?.index ?? -1;
//       let previousPbIndex = -1;
//       // console.log('matching index', matchingPbIndex);
//       if (matchingPbIndex > 0) {
//         previousPbIndex =
//           schema.scopes.find(scope => scope.pbNum === scopeNum - 1)?.index ??
//           -1;
//       } else {
//         previousPbIndex = 0;
//       }
//       // console.log('index', index);
//       // console.log('previndex', previousPbIndex);
//       if (index !== previousPbIndex + 1) {
//         // console.log('header', index, "isn't formatted");
//         //If our pb header isn't directly under the previous pagebreak
//         notebook?.content?.widgets
//           .filter(
//             (searchCell, searchIndex) =>
//               searchCell.model.type === 'code' &&
//               searchIndex > previousPbIndex &&
//               searchIndex < matchingPbIndex
//           )
//           .forEach(cellToMove => {
//             console.log('moving cells', cellToMove.model.id);
//             // const findIndex = notebook.content.widgets.findIndex(
//             //   searchCell => searchCell.model.id === cellToMove.model.id
//             // );
//             // notebook.content.moveCell(findIndex, index + 1);
//             // cellToMove.update();
//           });
//         didModify = true;
//       }
//     }
//   });
//   return didModify;
// }

export {
  buildNotebookSchema,
  parseExport,
  sendJSONDiff,
  sendLog,
  sendSchema,
  sendTransform
};
