import { Cell } from '@jupyterlab/cells';
import { Notebook } from '@jupyterlab/notebook';
import '../style/index.css';
import { BAD_FORMATTING_TAG } from './constants';
import { toggleClass } from './styling';
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

// function findHeaderandFooterFromCell( cell: Cell, notebook: Notebook | undefined | null, schema: PagebreakInternalSchema | undefined | null): [number, number]{
//   const footIndex = schema?.scopeList[]
// }
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

function lookForNewCells(notebook: Notebook) {
  notebook?.widgets?.forEach((cell, index) => {
    if (
      cell?.model.sharedModel.cell_type === 'raw' &&
      cell?.model.sharedModel.getSource() === 'export { }'
    ) {
      cell.model.setMetadata('pagebreak', true);
    } else if (
      cell?.model.sharedModel.cell_type === 'markdown' &&
      cell?.model.sharedModel.getSource() === '# New Pagebreak'
    ) {
      cell?.model.setMetadata('pagebreakheader', true);
    }
  });
}
function checkNbTypes(notebook: Notebook, schema: PagebreakInternalSchema) {
  // console.log('cleaning nb types');
  const lastPbCellIndex = findLastIndex(
    notebook.widgets,
    cell => cell?.model.getMetadata('pagebreak') === true
  );
  notebook?.widgets?.forEach((cell, index) => {
    // console.log(
    //   cell?.model.getMetadata('pagebreak') === true,
    //   cell?.model.sharedModel.cell_type !== 'raw'
    // );
    const isBadHeader =
      cell?.model.getMetadata('pagebreakheader') === true &&
      cell?.model.sharedModel.cell_type !== 'markdown';
    const isBadFooter =
      cell?.model.getMetadata('pagebreak') === true &&
      cell?.model.sharedModel.cell_type !== 'raw';
    if (isBadHeader || isBadFooter) {
      cell.addClass(BAD_FORMATTING_TAG);
    } else {
      cell.removeClass(BAD_FORMATTING_TAG);
    }
    if (
      !isBadHeader &&
      !isBadFooter &&
      cell?.model.sharedModel.cell_type === 'code'
    ) {
      const scopeNum = findScopeNumber(cell, schema);
      const [, , headerIndex, footerIndex] = findHeaderandFooter(
        scopeNum,
        notebook,
        schema
      );
      toggleClass(
        cell,
        BAD_FORMATTING_TAG,
        !(index >= headerIndex && index <= footerIndex) &&
          index < lastPbCellIndex
      );
    }
  });
}

// let inPagebreak = false;
// for (let ind = 0; ind < notebook.widgets.length; ind++) {
//   console.log('iterating cells', ind, inPagebreak);
//   const cell = notebook.widgets[ind];
//   if (cell?.model.getMetadata('pagebreak') === true) {
//     inPagebreak = false;
//     if (cell?.model.sharedModel.cell_type !== 'raw') {
//       console.log('changing to raw');
//       notebook.deselectAll();
//       notebook.select(cell);
//       NotebookActions.changeCellType(notebook, 'raw' as nbformat.CellType);
//     }
//   } else if (cell?.model.getMetadata('pagebreakheader') === true) {
//     inPagebreak = true;
//     if (cell?.model.sharedModel.cell_type !== 'markdown') {
//       console.log('changing to md');
//       const oldActive = notebook.activeCell;
//       notebook.deselectAll();
//       notebook.select(cell);
//       notebook.activeCellIndex = ind;
//       NotebookActions.changeCellType(
//         notebook,
//         'markdown' as nbformat.CellType
//       );
//       NotebookActions.run(notebook);
//       oldActive ? notebook.select(oldActive) : {};
//     }
//   } else if (cell?.model.sharedModel.cell_type === 'code') {
//     if (!inPagebreak && ind < lastPbCellIndex) {
//       console.log('changing code to raw', inPagebreak, ind, lastPbCellIndex);
//       notebook.deselectAll();
//       notebook.select(cell);
//       NotebookActions.changeCellType(notebook, 'raw' as nbformat.CellType);
//     }
//   }
// }

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
  checkNbTypes,
  ensurePBCellsAreUndeleteable,
  findHeaderandFooter,
  findScopeNumber,
  lookForNewCells
};
