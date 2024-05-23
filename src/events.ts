/* eslint-disable prettier/prettier */
// import { IEditorServices } from '@jupyterlab/codeeditor';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';

import { JupyterFrontEnd } from '@jupyterlab/application';
import { Cell, MarkdownCell } from '@jupyterlab/cells';
import { NotebookActions } from '@jupyterlab/notebook';
import { ArrayExt, findIndex } from '@lumino/algorithm';
import { Drag } from '@lumino/dragdrop';
import '../style/index.css';
import { PAGEBREAK_CELL_TAG, PAGEBREAK_HEADER_TAG } from './constants';
import { schemaManager } from './schemaManager';

const DROP_TARGET_CLASS = 'jp-mod-dropTarget';
const DROP_SOURCE_CLASS = 'jp-mod-dropSource';
const JUPYTER_CELL_MIME = 'application/vnd.jupyter.cells';
const NB_CELL_CLASS = 'jp-Notebook-cell';

function pgEventHandlers(app: JupyterFrontEnd, manager: schemaManager) {
  const notebookPanel = app.shell.currentWidget as NotebookPanel;
  const notebook = notebookPanel.content;
  //Drag-related overrides
  notebook.node.removeEventListener('lm-dragover', notebook, true);
  notebook.node.removeEventListener('lm-drop', notebook, true);
  notebook.node.addEventListener(
    'lm-dragover',
    (ev: Event) => handleDragOver(ev as Drag.Event, notebook),
    true
  );
  notebook.node.addEventListener(
    'lm-drop',
    (ev: Event) => handleDrop(ev as Drag.Event, notebook),
    true
  );

  notebook.widgets.forEach((cell, index) => {
    if (cell?.model.getMetadata('pagebreakheader')) {
      cell.node.onclick = (ev: MouseEvent) => onHeaderCellClick(ev, cell);
    } else if (cell?.model.getMetadata('pagebreak')) {
      cell.node.onclick = (ev: MouseEvent) => onPagebreakCellClick(ev, cell);
    }
  });
  function onPagebreakCellClick(ev: MouseEvent, cell: Cell) {
    const pbNum =
      manager?.previousSchema?.scopes.find(
        searchCell => searchCell.id === cell.model.id
      )?.pbNum ?? -1;
    const matchingPbHeader =
      notebook?.widgets?.find(
        searchCell =>
          searchCell.model.getMetadata('pagebreakheader') &&
          manager?.previousSchema?.cellsToScopes?.[searchCell.model.id] ===
            pbNum
      ) ?? undefined;
    console.log(matchingPbHeader);
    const matchingPbHeaderIndex = notebook?.widgets?.findIndex(
      searchCell => searchCell.model.id === matchingPbHeader?.model.id
    );
    if (matchingPbHeader !== undefined) {
      const pbIndex = notebook.activeCellIndex;
      console.log('active cell index', pbIndex);
      console.log('matchingpbindex', matchingPbHeaderIndex);
      const { head, anchor } = notebook.getContiguousSelection();
      if (
        (head === matchingPbHeaderIndex && anchor === pbIndex) ||
        (head === pbIndex && anchor === matchingPbHeaderIndex)
      ) {
        return;
      }
      // notebook.content.activeCellIndex = matchingPbHeaderIndex
      // notebook.content.select(matchingPbHeader)
      // notebook.update()
      // notebook.content.update()
      // notebook.content.activeCell?.update()
      // console.log('selectedcellind', notebook.content.activeCellIndex)
      notebook.extendContiguousSelectionTo(matchingPbHeaderIndex);
      notebook.update();
      notebook.update();
    }
  }
  function onHeaderCellClick(ev: MouseEvent, cell: Cell) {
    console.log('clicked!');
    ev.stopPropagation();
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const scopeNum =
      manager?.previousSchema?.cellsToScopes?.[cell.model.id] ?? -1;
    const matchingPbIndex =
      manager?.previousSchema?.scopes.find(scope => scope.pbNum === scopeNum)
        ?.index ?? -1;

    if (matchingPbIndex >= 0) {
      const overlappingHeaders = notebook.widgets.filter(
        (searchCell, index) =>
          searchCell.model.getMetadata('pagebreakheader') &&
          index < matchingPbIndex &&
          index > notebook.activeCellIndex
      );

      if (overlappingHeaders.length === 0) {
        //this should always be true when the order is correct, but if its messed up, we need to be able to select the individual headers to fix it
        notebook.extendContiguousSelectionTo(matchingPbIndex);
        notebook.update();
      }
    }
  }
}
function handleDragOver(event: Drag.Event, notebook: Notebook): void {
  if (!event.mimeData.hasData(JUPYTER_CELL_MIME)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.dropAction = event.proposedAction;
  const elements = notebook.node.getElementsByClassName(DROP_TARGET_CLASS);
  if (elements.length) {
    (elements[0] as HTMLElement).classList.remove(DROP_TARGET_CLASS);
  }
  const target = event.target as HTMLElement;
  const index = findCell(target, notebook);
  if (index === -1) {
    return;
  }
  const targetWidget = notebook.widgets[index];
  const sourceElements =
    notebook.node.getElementsByClassName(DROP_SOURCE_CLASS);

  if (isValidDrop(sourceElements, targetWidget)) {
    targetWidget.node.classList.add(DROP_TARGET_CLASS);
  }
}

function isValidDrop(
  sourceElements: HTMLCollectionOf<Element>,
  targetWidget: Cell
): boolean {
  //search for header and footer
  let header = -1;
  let footer = -1;
  for (let i = 0; i < sourceElements.length; i++) {
    const elem = sourceElements.item(i);
    if (elem?.classList.contains(PAGEBREAK_HEADER_TAG)) {
      header = i;
    }
    if (elem?.classList.contains(PAGEBREAK_CELL_TAG)) {
      footer = i;
    }
  }
  //if we're only dragging a header or footer alone
  if (header !== -1 && footer !== -1 && sourceElements.length === 1) {
    return true;
  }
  //if we're dragging a full pagebreak
  if (header !== -1 && footer !== -1) {
    //only drop in valid locations
    if (targetWidget.node.classList.contains(PAGEBREAK_HEADER_TAG)) {
      return true;
    }
    console.log('full pb');
  }
  //if we're only dragging cells
  if (header === -1 && footer === -1) {
    if (!targetWidget.node.classList.contains(PAGEBREAK_HEADER_TAG)) {
      return true;
    }
  }
  return false;
}

function handleDrop(event: Drag.Event, notebook: Notebook): void {
  if (!event.mimeData.hasData(JUPYTER_CELL_MIME)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (event.proposedAction === 'none') {
    event.dropAction = 'none';
    return;
  }

  let target = event.target as HTMLElement;
  while (target && target.parentElement) {
    if (target.classList.contains(DROP_TARGET_CLASS)) {
      target.classList.remove(DROP_TARGET_CLASS);
      break;
    }
    target = target.parentElement;
  }

  // Model presence should be checked before calling event handlers
  const model = notebook.model!;

  const source: Notebook = event.source;
  if (source === notebook) {
    // Handle the case where we are moving cells within
    // the same notebook.
    event.dropAction = 'move';
    const toMove: Cell[] = event.mimeData.getData('internal:cells');

    // For collapsed markdown headings with hidden "child" cells, move all
    // child cells as well as the markdown heading.
    const cell = toMove[toMove.length - 1];
    if (cell instanceof MarkdownCell && cell.headingCollapsed) {
      const nextParent = NotebookActions.findNextParentHeading(cell, source);
      if (nextParent > 0) {
        const index = findIndex(source.widgets, (possibleCell: Cell) => {
          return cell.model.id === possibleCell.model.id;
        });
        toMove.push(...source.widgets.slice(index + 1, nextParent));
      }
    }

    // Compute the to/from indices for the move.
    const fromIndex = ArrayExt.firstIndexOf(notebook.widgets, toMove[0]);
    let toIndex = findCell(target, notebook);
    // This check is needed for consistency with the view.
    if (toIndex !== -1 && toIndex > fromIndex) {
      toIndex -= 1;
    } else if (toIndex === -1) {
      // If the drop is within the notebook but not on any cell,
      // most often this means it is past the cell areas, so
      // set it to move the cells to the end of the notebook.
      toIndex = notebook.widgets.length - 1;
    }
    // Don't move if we are within the block of selected cells.
    if (toIndex >= fromIndex && toIndex < fromIndex + toMove.length) {
      return;
    }

    // Move the cells one by one
    notebook.moveCell(fromIndex, toIndex, toMove.length);
  } else {
    // Handle the case where we are copying cells between
    // notebooks.
    event.dropAction = 'copy';
    // Find the target cell and insert the copied cells.
    let index = findCell(target, notebook);
    if (index === -1) {
      index = notebook.widgets.length;
    }
    const start = index;
    const values = event.mimeData.getData(JUPYTER_CELL_MIME);
    // Insert the copies of the original cells.
    // We preserve trust status of pasted cells by not modifying metadata.
    model.sharedModel.insertCells(index, values);
    // Select the inserted cells.
    notebook.deselectAll();
    notebook.activeCellIndex = start;
    notebook.extendContiguousSelectionTo(index - 1);
  }
  void NotebookActions.focusActiveCell(notebook);
}

function findCell(node: HTMLElement, notebook: Notebook): number {
  // Trace up the DOM hierarchy to find the root cell node.
  // Then find the corresponding child and select it.
  let n: HTMLElement | null = node;
  while (n && n !== notebook.node) {
    if (n.classList.contains(NB_CELL_CLASS)) {
      const i = ArrayExt.findFirstIndex(
        notebook.widgets,
        widget => widget.node === n
      );
      if (i !== -1) {
        return i;
      }
      break;
    }
    n = n.parentElement;
  }
  return -1;
}

export { pgEventHandlers };
