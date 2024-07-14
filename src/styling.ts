import { Cell } from '@jupyterlab/cells';
import { NotebookPanel } from '@jupyterlab/notebook';
import { PagebreakInternalSchema } from './types';
import { findHeaderandFooter, findScopeNumber } from './utils';
function tagNotebookCells(
  notebook: NotebookPanel,
  schema: PagebreakInternalSchema
) {
  // if we have a notebook with no real pagebreak cells, dont change the formatting
  if (
    schema.scopeList[0].find(v => v === 'pagebreaks_simulated')
    // ||
    // notebook?.content?.widgets?.find(
    //   cell => cell.model.getMetadata('pagebreak') === undefined
    // )
  ) {
    return;
  }
  // console.log('styling cells');
  const activeCellScopeNum = notebook?.content?.activeCell
    ? findScopeNumber(notebook?.content?.activeCell, schema)
    : -1;

  notebook?.content?.widgets.forEach((cell, index) => {
    const scopeNum = findScopeNumber(cell, schema);
    const [, , headerIndex, footerIndex] = findHeaderandFooter(
      scopeNum,
      notebook.content,
      schema
    );
    // console.log(index, headerIndex, footerIndex);
    if (index >= headerIndex && index <= footerIndex) {
      conditionalClass(
        cell,
        'jp-pb-pagebreakEven',
        'jp-pb-pagebreakOdd',
        scopeNum % 2 === 0
      );
    } else {
      cell.removeClass('jp-pb-pagebreakEven');
      cell.removeClass('jp-pb-pagebreakOdd');
    }

    toggleClass(cell, 'jp-pb-pagebreakCodeCell', cell.model.type === 'code');

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

    //highlight all cells in the selected pagebreak
    toggleClass(
      cell,
      'jp-pb-selectedPagebreak',
      scopeNum === activeCellScopeNum
    );
    // cell.update();
  });
  // notebook?.content.update();
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

export { tagNotebookCells, toggleClass };
