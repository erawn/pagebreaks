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
    let scopeNum = -1;
    switch (cell.model.type) {
      case 'markdown':
      case 'code': {
        scopeNum = schema?.cellsToScopes?.[cell.model.id] ?? -1;
        break;
      }
      case 'raw': {
        scopeNum =
          schema.scopes.find(cell => cell.index === index)?.pbNum ?? -1;
        break;
      }
    }
    conditionalClass(
      cell,
      'jp-pb-pagebreakEven',
      'jp-pb-pagebreakOdd',
      scopeNum % 2 === 0
    );

    // add styling for code cells
    toggleClass(cell, 'jp-pb-pagebreakCodeCell', cell.model.type === 'code');

    //add styling for pagebreak cells
    toggleClass(
      cell,
      'jp-pb-pagebreakCell',
      cell.model.type === 'raw' && cell.model.getMetadata('pagebreak')
    );

    toggleClass(
      cell,
      'jp-pb-header',
      cell.model.type === 'markdown' &&
        cell.model.getMetadata('pagebreakheader')
    );
  });
}
function toggleClass(cell: Cell, classname: string, condition: boolean) {
  if (condition) {
    cell.addClass(classname);
  } else {
    cell.removeClass(classname);
  }
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
