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
/**
 * Returns the index of the last element in the array where predicate is true, and -1
 * otherwise.
 * @param array The source array to search in
 * @param predicate find calls predicate once for each element of the array, in descending
 * order, until it finds one where predicate returns true. If such an element is found,
 * findLastIndex immediately returns that element index. Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(
  array: ReadonlyArray<T>,
  predicate: (value: T, index: number, obj: readonly T[]) => boolean
): number {
  let l = array.length;
  while (l--) {
    if (predicate(array[l], l, array)) {
      return l;
    }
  }
  return -1;
}
function cleanNbTypes(notebook: Notebook) {
  // console.log('cleaning nb types');
  // notebook?.widgets?.forEach((cell, index) => {
  //   // console.log('isheader?', cell?.model.getMetadata('pagebreakheader'));
  //   // console.log('type', cell?.model.sharedModel.cell_type);
  //   if (
  //     cell?.model.getMetadata('pagebreak') &&
  //     cell?.model.sharedModel.cell_type !== 'raw'
  //   ) {
  //     console.log('changing to raw');
  //     const oldActive = notebook.activeCell;
  //     notebook.select(cell);
  //     NotebookActions.changeCellType(notebook, 'raw' as nbformat.CellType);
  //     oldActive ? notebook.select(oldActive) : {};
  //   } else if (
  //     cell?.model.getMetadata('pagebreakheader') &&
  //     cell?.model.sharedModel.cell_type !== 'markdown'
  //   ) {
  //     console.log('changing to md');
  //     const oldActive = notebook.activeCell;
  //     notebook.select(cell);
  //     NotebookActions.changeCellType(notebook, 'markdown' as nbformat.CellType);
  //     NotebookActions.run(notebook);
  //     oldActive ? notebook.select(oldActive) : {};
  //   }
  // });
  // const lastPbCellIndex = findLastIndex(
  //   notebook.widgets,
  //   cell => cell?.model.getMetadata('pagebreak') === true
  // );
  // let inPagebreak = false;
  for (let ind = 0; ind < notebook.widgets.length; ind++) {
    const cell = notebook.widgets[ind];
    if (cell?.model.getMetadata('pagebreak')) {
      // inPagebreak = false;
      if (cell?.model.sharedModel.cell_type !== 'raw') {
        console.log('changing to raw');
        notebook.deselectAll();
        notebook.select(cell);
        NotebookActions.changeCellType(notebook, 'raw' as nbformat.CellType);
      }
    } else if (cell?.model.getMetadata('pagebreakheader')) {
      // inPagebreak = true;
      if (cell?.model.sharedModel.cell_type !== 'markdown') {
        console.log('changing to md');
        const oldActive = notebook.activeCell;
        notebook.deselectAll();
        notebook.select(cell);
        notebook.activeCellIndex = ind;
        NotebookActions.changeCellType(
          notebook,
          'markdown' as nbformat.CellType
        );
        NotebookActions.run(notebook);
        oldActive ? notebook.select(oldActive) : {};
      }
      // } else if (cell?.model.sharedModel.cell_type === 'code') {
      //   if (!inPagebreak && ind < lastPbCellIndex) {
      //     notebook.deselectAll();
      //     notebook.select(cell);
      //     NotebookActions.changeCellType(notebook, 'raw' as nbformat.CellType);
      //   }
    }
  }
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
