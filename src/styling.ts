import { NotebookPanel } from '@jupyterlab/notebook';
import { PagebreakScopeList } from './types';

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

  notebook?.content?.widgets.forEach((cell, index) => {
    // add styling for code cells
    if (cell.model.type === 'code') {
      cell.addClass('jp-pb-pagebreakCodeCell');
      if (
        schema.cellsToScopes &&
        schema.cellsToScopes[cell.model.id] !== undefined
      ) {
        const scopeNum = schema.cellsToScopes[cell.model.id];
        if (scopeNum !== undefined) {
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
      const scope = schema.scopes.find(cell => cell.index === index);

      if (scope !== undefined) {
        if (scope.pbNum % 2 === 0) {
          cell.addClass('jp-pb-pagebreakEven');
        } else {
          cell.addClass('jp-pb-pagebreakOdd');
        }
      }
    } else {
      cell.removeClass('jp-pb-pagebreakCell');
    }
  });
}

export { tagNotebookCells };
