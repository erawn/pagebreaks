import { Cell } from '@jupyterlab/cells';
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

  // Clear all the tags so we can start over
  // notebook?.content?.widgets.forEach((cell, index) => {
  //   cell.clas;
  // });

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
          conditionalClass(
            cell,
            'jp-pb-pagebreakEven',
            'jp-pb-pagebreakOdd',
            scopeNum % 2 === 0
          );
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
        conditionalClass(
          cell,
          'jp-pb-pagebreakEven',
          'jp-pb-pagebreakOdd',
          scope.pbNum % 2 === 0
        );
      }
    } else {
      cell.removeClass('jp-pb-pagebreakCell');
    }
  });
}

function conditionalClass(
  cell: Cell,
  class1: string,
  class2: string,
  condition: boolean
) {
  if (condition) {
    cell.addClass(class1);
    cell.removeClass(class2);
  } else {
    cell.addClass(class2);
    cell.removeClass(class1);
  }
}

export { tagNotebookCells };
