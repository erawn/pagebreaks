import { Cell } from '@jupyterlab/cells';
import type * as nbformat from '@jupyterlab/nbformat';
import { Notebook, NotebookActions } from '@jupyterlab/notebook';
import '../style/index.css';
import { PagebreakInternalSchema } from './types';
function findScopeNumber(
  cell: Cell | undefined | null,
  schema: PagebreakInternalSchema | undefined | null
): number {
  switch (cell?.model.type) {
    case 'markdown':
    case 'code': {
      return schema?.cellsToScopes?.[cell.model.id] ?? -1;
    }
    case 'raw': {
      return (
        schema?.scopes.find(searchCell => searchCell.id === cell.model.id)
          ?.pbNum ?? -1
      );
    }
  }
  return -1;
}
function findHeaderandFooter(
  scope: number,
  notebook: Notebook | undefined | null,
  schema: PagebreakInternalSchema | undefined | null
): [Cell | undefined, Cell | undefined, number, number] {
  const headerIndex =
    notebook?.widgets.findIndex(
      cell =>
        findScopeNumber(cell, schema) === scope &&
        cell.model.getMetadata('pagebreakheader')
    ) ?? -1;
  const footerIndex =
    notebook?.widgets.findIndex(
      cell =>
        findScopeNumber(cell, schema) === scope &&
        cell.model.getMetadata('pagebreak')
    ) ?? -1;
  return [
    notebook?.widgets.at(headerIndex),
    notebook?.widgets.at(footerIndex),
    headerIndex,
    footerIndex
  ];
}

function cleanNbTypes(notebook: Notebook) {
  // console.log('cleaning nb types');
  notebook?.widgets?.forEach((cell, index) => {
    // console.log('isheader?', cell?.model.getMetadata('pagebreakheader'));
    // console.log('type', cell?.model.sharedModel.cell_type);
    if (
      cell?.model.getMetadata('pagebreak') &&
      cell?.model.sharedModel.cell_type !== 'raw'
    ) {
      console.log('changing to raw');
      const oldActive = notebook.activeCell;
      notebook.select(cell);
      NotebookActions.changeCellType(notebook, 'raw' as nbformat.CellType);
      oldActive ? notebook.select(oldActive) : {};
    } else if (
      cell?.model.getMetadata('pagebreakheader') &&
      cell?.model.sharedModel.cell_type !== 'markdown'
    ) {
      console.log('changing to md');
      const oldActive = notebook.activeCell;
      notebook.select(cell);
      NotebookActions.changeCellType(notebook, 'markdown' as nbformat.CellType);
      NotebookActions.run(notebook);
      oldActive ? notebook.select(oldActive) : {};
    }
  });
  notebook?.activate();
}

function ensurePBCellsAreUndeleteable(notebook: Notebook) {
  notebook?.widgets?.forEach((cell, index) => {
    if (
      cell?.model.getMetadata('pagebreak') ||
      cell?.model.getMetadata('pagebreakheader')
    ) {
      cell?.model.setMetadata('deletable', false);
    }
  });
}

export {
  cleanNbTypes,
  ensurePBCellsAreUndeleteable,
  findHeaderandFooter,
  findScopeNumber
};
