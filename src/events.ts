// import { IEditorServices } from '@jupyterlab/codeeditor';
import { Notebook, NotebookPanel } from '@jupyterlab/notebook';

import { Cell, ICodeCellModel, MarkdownCell } from '@jupyterlab/cells';
import * as nbformat from '@jupyterlab/nbformat';
import { NotebookActions } from '@jupyterlab/notebook';
import { ArrayExt, findIndex } from '@lumino/algorithm';
import { MimeData } from '@lumino/coreutils';
import { Drag } from '@lumino/dragdrop';
import { h, VirtualDOM } from '@lumino/virtualdom';
import '../style/index.css';
import { activeManager } from './activeManager';
import {
  DROP_TARGET_CLASS_BOTTOM,
  PAGEBREAK_CELL_TAG,
  PAGEBREAK_HEADER_TAG
} from './constants';
import { sendLog } from './schema';
import { schemaManager } from './schemaManager';

const DROP_TARGET_CLASS = 'jp-mod-dropTarget';
const DROP_SOURCE_CLASS = 'jp-mod-dropSource';
const JUPYTER_CELL_MIME = 'application/vnd.jupyter.cells';
const NB_CELL_CLASS = 'jp-Notebook-cell';
const DRAG_THRESHOLD = 5;
const DRAG_IMAGE_CLASS = 'jp-dragImage';

// const MARKDOWN_COLLAPSED_CLASS = 'jp-MarkdownHeadingCollapsed';
/**
 * The class name added to singular drag images
 */
const SINGLE_DRAG_IMAGE_CLASS = 'jp-dragImage-singlePrompt';

/**
 * The class name added to the drag image cell content.
 */
const CELL_DRAG_CONTENT_CLASS = 'jp-dragImage-content';

/**
 * The class name added to the drag image cell content.
 */
const CELL_DRAG_PROMPT_CLASS = 'jp-dragImage-prompt';

/**
 * The class name added to the drag image cell content.
 */
const CELL_DRAG_MULTIPLE_BACK = 'jp-dragImage-multipleBack';

export class pagebreakEventHandlers {
  private _drag: Drag | null = null;
  _dragData: {
    pressX: number;
    pressY: number;
    index: number;
  } | null = null;
  _mouseMode: 'select' | 'couldDrag' | null = null;
  _notebook: Notebook;
  _notebookPanel: NotebookPanel;
  _manager: schemaManager;
  _activeManager: activeManager;

  constructor(
    notebookPanel: NotebookPanel,
    manager: schemaManager,
    activeManager: activeManager
  ) {
    this._manager = manager;
    this._activeManager = activeManager;
    this._notebook = notebookPanel.content;
    this._notebookPanel = notebookPanel;
    if (this._activeManager.isActive()) {
      this.addListeners();
    }
    this.addStudyListeners();
  }

  public get currentNotebook(): Notebook {
    return this._notebook;
  }
  update(notebookPanel: NotebookPanel) {
    this._notebook = notebookPanel.content;
    this._notebookPanel = notebookPanel;
    if (this._activeManager.isActive()) {
      this.addListeners();
    }
    this.addStudyListeners();
  }
  addStudyListeners() {
    // this._notebookPanel.node.addEventListener('scrollend', this, {
    //   passive: true
    // });
    this._notebookPanel.node
      .querySelector('[data-lm-dragscroll="true"]')
      ?.addEventListener('scrollend', this, {
        passive: true
      });
    // const elems = document.querySelectorAll('[data-lm-dragscroll="true"]');
    // elems.forEach(elem => {
    //   elem.classList;
    // });
    // console.log(this._notebookPanel.node.getAttribute('data-lm-dragscroll'));
    // const elements = this._notebookPanel.node.getElements;
    // console.log(elements);
    // for (let i = 0; i < elements.length; i++) {
    //   const item = elements.item(i);
    //   console.log(item);
    //   // console.log(item?.getAttributeNames());
    //   const children = item?.getElementsByClassName('jp-WindowedPanel-outer');
    //   console.log(children);
    //   if (children && children?.length > 0) {
    //     console.log('added event listener!');
    //     children.item(0)?.addEventListener('scrollend', this, {
    //       passive: true
    //     });
    //   }
    // }
    // .getElementsByClassName('data-lm-dragscroll')
    // if (this._notebook.outerNode === undefined) {
    //   console.log("Pagebreaks: Can't Attach ScrollEnd");
    //   if (this._notebookPanel.content.outerNode) {
    //     this._notebookPanel.content.outerNode.addEventListener(
    //       'scrollend',
    //       this,
    //       { passive: true }
    //     );
    //   }
    // } else {
    //   this._notebook.outerNode?.addEventListener('scrollend', this, {
    //     passive: true
    //   });
    // }
  }
  removeStudyListeners() {
    if (this._notebook.outerNode === undefined) {
      console.log("Pagebreaks: Can't Attach ScrollEnd");
    } else {
      this._notebook.outerNode?.removeEventListener('scrollend', this);
    }
  }

  addListeners() {
    // console.log('adding listeners', this._notebook.node);
    this.removeNotebookListeners();
    const node = this._notebook.node;
    node.addEventListener('mousedown', this);
    node.addEventListener('mousedown', this, true);
    node.addEventListener('lm-dragover', this, true);
    node.addEventListener('lm-drop', this, true);
    node.addEventListener('lm-dragleave', this, true);
  }
  removeNotebookListeners() {
    const notebook = this._notebook;
    notebook.node.removeEventListener('lm-dragover', this._notebook, true);
    notebook.node.removeEventListener('lm-dragover', this._notebook);
    notebook.node.removeEventListener('lm-drop', this._notebook, true);
    notebook.node.removeEventListener('lm-drop', this._notebook);
    notebook.node.removeEventListener('mousemove', this._notebook, true);
    notebook.node.removeEventListener('mousedown', this._notebook, true);
    notebook.node.removeEventListener('mousedown', this._notebook);
  }
  removeListeners() {
    const node = this._notebook.node;
    window.removeEventListener('scrollend', this);
    node.removeEventListener('mousedown', this);
    node.removeEventListener('mousedown', this, true);
    node.removeEventListener('lm-dragover', this, true);
    node.removeEventListener('lm-drop', this, true);
    document.removeEventListener('mousemove', this, true);
    document.removeEventListener('mouseup', this, true);
  }

  switchNotebooks(newNotebookPanel: NotebookPanel) {
    // console.log('switching listeners');
    this.removeListeners();
    this.removeStudyListeners();
    this._notebook = newNotebookPanel.content;
    this._notebookPanel = newNotebookPanel;
    if (this._activeManager.isActive()) {
      this.addListeners();
    }
    this.addStudyListeners();
  }
  handleEvent(event: Event): void {
    if (!this._notebook.model) {
      console.log('no model');
      return;
    }
    switch (event.type) {
      case 'scroll':
        console.log('SCROLLTOP');
        break;
      case 'scrollend':
        this.handleScrollEnd(event as MouseEvent);
        break;
      case 'mousedown':
        if (event.eventPhase === Event.CAPTURING_PHASE) {
          this.handleMouseDownCapture(event as MouseEvent);
        } else {
          // Skip processing the event when it resulted from a toolbar button click
          if (!event.defaultPrevented) {
            this.handleMouseDown(event as MouseEvent);
          }
        }
        break;
      case 'mouseup':
        if (event.currentTarget === document) {
          this._evtDocumentMouseup(event as MouseEvent);
        }
        break;
      case 'mousemove':
        if (event.currentTarget === document) {
          this._evtDocumentMousemove(event as MouseEvent);
        }
        break;
      case 'lm-dragover':
        this.handleDragOver(event as Drag.Event);
        break;
      case 'lm-drop':
        this.handleDrop(event as Drag.Event);
        break;
      case 'lm-dragleave':
        this.handleDragLeave(event as Drag.Event);
        break;
      // default:
      //     super.handleEvent(event);
      //     break;
    }
  }

  // notebookEventHandlers(app: JupyterFrontEnd) {
  //     const notebookPanel = app.shell.currentWidget as NotebookPanel;
  //     const notebook = notebookPanel.content;
  //     //Drag-related overrides
  //     // notebook.node.removeEventListener('lm-dragenter', notebook, true);
  //     notebook.node.removeEventListener('lm-dragover', notebook, true);
  //     notebook.node.removeEventListener('lm-drop', notebook, true);

  //     //addEventListener will not add duplicates, so we can run it many times

  //     //we just want to pre-empt the mousemove event to select the whole pb,
  //     //so we add the listener to the shell
  //     // app.shell.node.addEventListener(
  //     //     'mousemove',
  //     //     (ev: Event) => handleMouseMove(ev as Drag.Event, notebook),
  //     //     true
  //     // );
  //     // notebook.node.addEventListener(
  //     //     'lm-dragover',
  //     //     (ev: Event) => handleDragOver(ev as Drag.Event, notebook),
  //     //     true
  //     // );
  //     // notebook.node.addEventListener(
  //     //     'lm-drop',
  //     //     (ev: Event) => handleDrop(ev as Drag.Event, notebook),
  //     //     true
  //     // );
  // }

  // pgEventHandlers(app: JupyterFrontEnd, manager: schemaManager) {
  //   const notebookPanel = app.shell.currentWidget as NotebookPanel;
  //   const notebook = notebookPanel.content;

  //   notebook.widgets.forEach((cell, index) => {
  //     if (cell?.model.getMetadata('pagebreakheader')) {
  //       cell.node.onclick = (ev: MouseEvent) => onHeaderCellClick(ev, cell);
  //     } else if (cell?.model.getMetadata('pagebreak')) {
  //       cell.node.onclick = (ev: MouseEvent) => onPagebreakCellClick(ev, cell);
  //     }
  //   });
  //   function onPagebreakCellClick(ev: MouseEvent, cell: Cell) {
  //     const pbNum =
  //       manager?.previousSchema?.scopes.find(
  //         searchCell => searchCell.id === cell.model.id
  //       )?.pbNum ?? -1;
  //     const matchingPbHeader =
  //       notebook?.widgets?.find(
  //         searchCell =>
  //           searchCell.model.getMetadata('pagebreakheader') &&
  //           manager?.previousSchema?.cellsToScopes?.[searchCell.model.id] ===
  //             pbNum
  //       ) ?? undefined;
  //     console.log(matchingPbHeader);
  //     const matchingPbHeaderIndex = notebook?.widgets?.findIndex(
  //       searchCell => searchCell.model.id === matchingPbHeader?.model.id
  //     );
  //     if (matchingPbHeader !== undefined) {
  //       const pbIndex = notebook.activeCellIndex;
  //       console.log('active cell index', pbIndex);
  //       console.log('matchingpbindex', matchingPbHeaderIndex);
  //       const { head, anchor } = notebook.getContiguousSelection();
  //       if (
  //         (head === matchingPbHeaderIndex && anchor === pbIndex) ||
  //         (head === pbIndex && anchor === matchingPbHeaderIndex)
  //       ) {
  //         return;
  //       }
  //       // notebook.content.activeCellIndex = matchingPbHeaderIndex
  //       // notebook.content.select(matchingPbHeader)
  //       // notebook.update()
  //       // notebook.content.update()
  //       // notebook.content.activeCell?.update()
  //       // console.log('selectedcellind', notebook.content.activeCellIndex)
  //       notebook.extendContiguousSelectionTo(matchingPbHeaderIndex);
  //       notebook.update();
  //       notebook.update();
  //     }
  //   }
  //   function onHeaderCellClick(ev: MouseEvent, cell: Cell) {
  //     console.log('clicked!');
  //     ev.stopPropagation();
  //     ev.preventDefault();
  //     ev.stopImmediatePropagation();
  //     const scopeNum =
  //       manager?.previousSchema?.cellsToScopes?.[cell.model.id] ?? -1;
  //     const matchingPbIndex =
  //       manager?.previousSchema?.scopes.find(scope => scope.pbNum === scopeNum)
  //         ?.index ?? -1;

  //     if (matchingPbIndex >= 0) {
  //       const overlappingHeaders = notebook.widgets.filter(
  //         (searchCell, index) =>
  //           searchCell.model.getMetadata('pagebreakheader') &&
  //           index < matchingPbIndex &&
  //           index > notebook.activeCellIndex
  //       );

  //       if (overlappingHeaders.length === 0) {
  //         //this should always be true when the order is correct, but if its messed up, we need to be able to select the individual headers to fix it
  //         notebook.extendContiguousSelectionTo(matchingPbIndex);
  //         notebook.update();
  //       }
  //     }
  //   }
  // }
  // handleMouseMove(event: Drag.Event): void {
  //     const notebook = this._notebook
  //     const data = this._dragData!;
  //     const dx = Math.abs(event.clientX - data.pressX);
  //     const dy = Math.abs(event.clientY - data.pressY);
  //     if (dx >= DRAG_THRESHOLD || dy >= DRAG_THRESHOLD) {
  //         ;
  //     }

  //     // If in select mode, update the selection
  //     // switch (this._mouseMode) {
  //     //     case 'select': {
  //     //       const target = event.target as HTMLElement;
  //     //       const index = this._findCell(target);
  //     //       if (index !== -1) {
  //     //         this.extendContiguousSelectionTo(index);
  //     //       }
  //     //       break;
  //     //     }
  //     //     case 'couldDrag': {
  //     //       // Check for a drag initialization.
  //     //       const data = this._dragData!;
  //     //       const dx = Math.abs(event.clientX - data.pressX);
  //     //       const dy = Math.abs(event.clientY - data.pressY);
  //     //       if (dx >= DRAG_THRESHOLD || dy >= DRAG_THRESHOLD) {
  //     //         this._mouseMode = null;
  //     //         this._startDrag(data.index, event.clientX, event.clientY);
  //     //       }
  //     //       break;
  //     //     }
  //     //     default:
  //     //       break;
  //     //   }
  // }
  handleScrollEnd(event: MouseEvent): void {
    // console.log('SCROLLEND', event);
    const onScreen = this._notebook.widgets
      .map((cell, index) => {
        const rect = cell.node.getBoundingClientRect();
        const isVisible =
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <=
            (window.innerHeight ||
              document.documentElement
                .clientHeight) /* or $(window).height() */ &&
          rect.right <=
            (window.innerWidth || document.documentElement.clientWidth);
        return [index, isVisible];
      })
      .filter(value => value[1])
      .sort((a, b) => (a[0] as number) - (b[0] as number));
    const firstVisible = onScreen.at(0)?.at(0);
    const lastVisible = onScreen.at(-1)?.at(0);
    // console.log(firstVisible, lastVisible);
    sendLog(
      this._notebookPanel,
      'SCROLLEND [' + firstVisible + ',' + lastVisible + ']',
      this._activeManager
    );
  }
  handleDragLeave(event: Drag.Event): void {
    if (!event.mimeData.hasData(JUPYTER_CELL_MIME)) {
      return;
    }
    const elements =
      this._notebook.node.getElementsByClassName(DROP_TARGET_CLASS);
    if (elements.length) {
      (elements[0] as HTMLElement).classList.remove(DROP_TARGET_CLASS);
    }
    const bottomElements = this._notebook.node.getElementsByClassName(
      DROP_TARGET_CLASS_BOTTOM
    );
    if (bottomElements.length) {
      (bottomElements[0] as HTMLElement).classList.remove(
        DROP_TARGET_CLASS_BOTTOM
      );
    }
  }
  /**
   * Handle `mousedown` event in the capture phase for the widget.
   */
  handleMouseDownCapture(event: MouseEvent): void {
    // console.log('mousedown capture');
    const { button, shiftKey } = event;

    const [target, index] = this.findEventTargetAndCell(event, this._notebook);
    const widget = this._notebook.widgets[index];

    // // On OS X, the context menu may be triggered with ctrl-left-click. In
    // // Firefox, ctrl-left-click gives an event with button 2, but in Chrome,
    // // ctrl-left-click gives an event with button 0 with the ctrl modifier.
    if (
      button === 2 &&
      !shiftKey &&
      widget &&
      widget.editorWidget?.node.contains(target)
    ) {
      this._notebook.mode = 'command';
      // this.mode = 'command';
      // Prevent CodeMirror from focusing the editor.
      // TODO: find an editor-agnostic solution.
      event.preventDefault();
    }
  }
  handleMouseDown(event: MouseEvent): void {
    // console.log('mousedown');
    const notebook = this._notebook;
    const { button, shiftKey } = event;

    // We only handle main or secondary button actions.
    if (!(button === 0 || button === 2)) {
      return;
    }

    // Shift right-click gives the browser default behavior.
    if (shiftKey && button === 2) {
      return;
    }

    const [target, index] = this.findEventTargetAndCell(event, notebook);
    const widget = notebook.widgets[index];

    let targetArea: 'input' | 'prompt' | 'cell' | 'notebook';
    if (widget) {
      if (widget.editorWidget?.node.contains(target)) {
        targetArea = 'input';
      } else if (widget.promptNode?.contains(target)) {
        targetArea = 'prompt';
      } else {
        targetArea = 'cell';
      }
    } else {
      targetArea = 'notebook';
    }
    // Make sure we go to command mode if the click isn't in the cell editor If
    // we do click in the cell editor, the editor handles the focus event to
    // switch to edit mode.
    if (targetArea !== 'input') {
      notebook.mode = 'command';
    }
    // console.log('target area: ', targetArea);
    if (targetArea === 'notebook') {
      // notebook.deselectAll();
    } else if (targetArea === 'prompt' || targetArea === 'cell') {
      // We don't want to prevent the default selection behavior
      // if there is currently text selected in an output.
      const hasSelection = (window.getSelection() ?? '').toString() !== '';
      if (
        button === 0 &&
        shiftKey &&
        !hasSelection &&
        !['INPUT', 'OPTION'].includes(target.tagName)
      ) {
        // Prevent browser selecting text in prompt or output
        event.preventDefault();
        // Shift-click - extend selection
        try {
          notebook.extendContiguousSelectionTo(index);
        } catch (e) {
          console.error(e);
          notebook.deselectAll();
          return;
        }
        // Enter selecting mode
        this._mouseMode = 'select';
        document.addEventListener('mouseup', this, true);
        document.addEventListener('mousemove', this, true);
        // console.log('added mousemove listener');
      } else if (button === 0 && !shiftKey) {
        // Prepare to start a drag if we are on the drag region.
        if (targetArea === 'prompt') {
          // Prepare for a drag start
          this._dragData = {
            pressX: event.clientX,
            pressY: event.clientY,
            index: index
          };

          // Enter possible drag mode
          this._mouseMode = 'couldDrag';
          // console.log('could Drag');
          document.addEventListener('mouseup', this, true);
          //because the notebook by default adds a listener to document,
          // we have to preempt with a listener on window
          // window.addEventListener('mousemove', this, true);
          document.addEventListener('mousemove', this, true);
          event.preventDefault();
        }
        if (!notebook.isSelectedOrActive(widget)) {
          notebook.deselectAll();
          notebook.activeCellIndex = index;
        }
      } else if (button === 2) {
        if (!notebook.isSelectedOrActive(widget)) {
          notebook.deselectAll();
          notebook.activeCellIndex = index;
        }
        event.preventDefault();
      }
    } else if (targetArea === 'input') {
      if (button === 2 && !notebook.isSelectedOrActive(widget)) {
        notebook.deselectAll();
        notebook.activeCellIndex = index;
      }
    }

    // If we didn't set focus above, make sure we get focus now.
    notebook.activate();
  }

  /**
   * Handle the `'mouseup'` event on the document.
   */
  _evtDocumentMouseup(event: MouseEvent): void {
    // Remove the event listeners we put on the document
    // window.removeEventListener('mousemove', this, true);
    document.removeEventListener('mousemove', this, true);
    document.removeEventListener('mouseup', this, true);

    this._mouseMode = null;
  }

  /**
   * Handle the `'mousemove'` event for the widget.
   */
  private _evtDocumentMousemove(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    // //have to remove the default listener which gets attached on mousedown
    // document.removeEventListener('mousemove', this._notebook, true);

    // console.log('mousemove', event.target);
    // If in select mode, update the selection
    switch (this._mouseMode) {
      case 'select': {
        const target = event.target as HTMLElement;
        const index = this.findCell(target, this._notebook);
        if (index !== -1) {
          this._notebook.extendContiguousSelectionTo(index);
        }
        break;
      }
      case 'couldDrag': {
        // console.log('could drag');
        // Check for a drag initialization.
        const data = this._dragData!;
        const dx = Math.abs(event.clientX - data.pressX);
        const dy = Math.abs(event.clientY - data.pressY);
        if (dx >= DRAG_THRESHOLD || dy >= DRAG_THRESHOLD) {
          this._mouseMode = null;

          const target = event.target as HTMLElement;
          const targetIndex = this.findCell(target, this._notebook);
          if (targetIndex === -1) {
            console.error("Couldn't find Cell");
            return;
          }
          const targetCell = this._notebook.widgets.at(targetIndex);

          // console.log('initiating drag on ', targetCell);
          const isHeader =
            targetCell?.model?.getMetadata('pagebreakheader') === true;
          const isFooter = targetCell?.model?.getMetadata('pagebreak') === true;
          if (isHeader || isFooter) {
            let headerIndex = -1;
            let footerIndex = -1;
            const schema = this._manager?.previousSchema;
            if (isHeader) {
              headerIndex = targetIndex;
              const scopeNum = schema?.cellsToScopes?.[targetCell.model.id];
              const matchingPbIndex = schema?.scopes.find(
                scope => scope.pbNum === scopeNum
              )?.index;
              if (matchingPbIndex) {
                footerIndex = matchingPbIndex;
                if (
                  targetCell.model.type === ('markdown' as nbformat.CellType)
                ) {
                  const mdCell = targetCell as MarkdownCell;
                  if (mdCell.headingCollapsed) {
                    const lastCollapsed = mdCell.numberChildNodes + targetIndex;
                    if (footerIndex !== lastCollapsed) {
                      console.error(
                        'collapsed heading malformed',
                        targetIndex,
                        footerIndex,
                        lastCollapsed
                      );
                      return;
                    }
                  }
                } else {
                  return;
                }
              }
            } else if (isFooter) {
              footerIndex = targetIndex;
              const footerCell = this._notebook.widgets[targetIndex];
              const footerPbNum =
                schema?.scopes.find(
                  searchCell => searchCell.id === footerCell.model.id
                )?.pbNum ?? undefined;
              const matchingPbHeader =
                this._notebook?.widgets?.find(
                  searchCell =>
                    searchCell.model.getMetadata('pagebreakheader') &&
                    this._manager?.previousSchema?.cellsToScopes?.[
                      searchCell.model.id
                    ] === footerPbNum
                ) ?? undefined;
              const matchingPbHeaderIndex =
                this._notebook?.widgets?.findIndex(
                  searchCell =>
                    searchCell.model.id === matchingPbHeader?.model.id
                ) ?? undefined;
              if (matchingPbHeaderIndex) {
                headerIndex = matchingPbHeaderIndex;
              }
            }
            // console.log('found header/footer', headerIndex, ':', footerIndex);
            if (headerIndex !== -1 && footerIndex !== -1) {
              //check for overlapping headers
              const overlappingHeaders = this._notebook.widgets.filter(
                (searchCell, searchIndex) =>
                  searchCell.model.getMetadata('pagebreakheader') &&
                  searchIndex < footerIndex &&
                  searchIndex > headerIndex
              );

              if (overlappingHeaders.length > 0) {
                console.error('Bad Selection');
                return;
              }
              // console.log(
              //   'Found Drag Selection ',
              //   headerIndex,
              //   ':',
              //   footerIndex
              // );
              // this._notebook.activeCell.coll
              //select whole pagebreak
              const headerCell = this._notebook.widgets[headerIndex];
              if (
                headerCell instanceof MarkdownCell &&
                (headerCell as MarkdownCell).headingCollapsed
              ) {
                console.log('collapsed');
              } else {
                this._notebook.deselectAll();
                this._notebook.activeCellIndex = footerIndex;
                this._notebook.extendContiguousSelectionTo(headerIndex);
              }
            }
          }
          this.startDrag(data.index, event.clientX, event.clientY);
        }
        break;
      }
      default:
        break;
    }
  }
  handleDragOver(event: Drag.Event): void {
    const notebook = this._notebook;
    console.log('dragover');
    if (!event.mimeData.hasData(JUPYTER_CELL_MIME)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dropAction = event.proposedAction;
    const elements = notebook.node.getElementsByClassName(DROP_TARGET_CLASS);
    if (elements.length) {
      const elem = elements[0] as HTMLElement;
      elem.classList.remove(DROP_TARGET_CLASS);
      elem.classList.remove(DROP_TARGET_CLASS_BOTTOM);
    }
    const bottomElements = notebook.node.getElementsByClassName(
      DROP_TARGET_CLASS_BOTTOM
    );
    if (bottomElements.length) {
      const elem = bottomElements[0] as HTMLElement;
      elem.classList.remove(DROP_TARGET_CLASS_BOTTOM);
    }
    const target = event.target as HTMLElement;
    let index = this.findCell(target, notebook);
    let isBottom = false;
    if (index === -1) {
      index = notebook.widgets.length - 1;
      isBottom = true;
    } else {
      notebook.widgets[notebook.widgets.length - 1].node.classList.remove(
        DROP_TARGET_CLASS_BOTTOM
      );
    }
    const targetWidget = notebook.widgets[index];
    // const sourceElements =
    //   notebook.node.getElementsByClassName(DROP_SOURCE_CLASS);
    const toMove: Cell[] = event.mimeData.getData('internal:cells');

    // For collapsed markdown headings with hidden "child" cells, move all
    // child cells as well as the markdown heading.
    const cell = toMove[toMove.length - 1];
    if (cell instanceof MarkdownCell && cell.headingCollapsed) {
      const nextParent = NotebookActions.findNextParentHeading(
        cell,
        this._notebook
      );
      if (nextParent > 0) {
        const index = findIndex(
          this._notebook.widgets,
          (possibleCell: Cell) => {
            return cell.model.id === possibleCell.model.id;
          }
        );
        toMove.push(...this._notebook.widgets.slice(index + 1, nextParent));
      }
    }
    console.log('toMove:', toMove);
    const isValid = this.isValidDrop(targetWidget, toMove, isBottom, notebook);
    if (isValid) {
      // console.log('IsBottom', isBottom);
      if (isBottom) {
        targetWidget.node.classList.add(DROP_TARGET_CLASS_BOTTOM);
      } else {
        targetWidget.node.classList.add(DROP_TARGET_CLASS);
      }
    }
  }

  isValidDrop(
    targetWidget: Cell,
    toMove: Cell[],
    isBottom: boolean,
    notebook: Notebook
  ): boolean {
    //isValid, isPagebreak
    //search for header and footer

    // let collapsedIndex = -1;
    // // for (let i = 0; i < sourceElements.length; i++) {
    // //   const elem = sourceElements.item(i);
    // //   if (elem?.classList.contains(MARKDOWN_COLLAPSED_CLASS)) {
    // //     collapsedIndex = this.findCell(elem as HTMLElement, notebook);
    // //   }
    // // }
    // const cell = toMove[toMove.length - 1];
    // if (cell instanceof MarkdownCell && cell.headingCollapsed) {
    //   collapsedIndex = findIndex(notebook.widgets, (searchCell: Cell) => {
    //     return cell.model.id === searchCell.model.id;
    //   });
    // }

    // let header = -1;
    // let footer = -1;

    // if (collapsedIndex !== -1) {
    //   const headerCell = notebook.widgets.at(collapsedIndex) as MarkdownCell;
    //   for (
    //     let ind = collapsedIndex;
    //     ind < collapsedIndex + headerCell.numberChildNodes + 1;
    //     ind++
    //   ) {
    //     const cell = notebook.widgets.at(ind);
    //     if (cell?.model.getMetadata('pagebreak') === true) {
    //       //if we find two headers in the collapse
    //       if (footer !== -1) {
    //         return [false, true];
    //       } else {
    //         footer = ind - collapsedIndex;
    //       }
    //     }
    //     if (cell?.model.getMetadata('pagebreakheader') === true) {
    //       if (header !== -1) {
    //         return [false, true];
    //       } else {
    //         header = ind - collapsedIndex;
    //       }
    //     }
    //   }
    // } else {
    //   // for (let i = 0; i < sourceElements.length; i++) {
    //   //   const elem = sourceElements.item(i);
    //   //   if (elem?.classList.contains(PAGEBREAK_HEADER_TAG)) {
    //   //     header = i;
    //   //   }
    //   //   if (elem?.classList.contains(PAGEBREAK_CELL_TAG)) {
    //   //     footer = i;
    //   //   }
    //   // }
    // }
    const header = toMove.findIndex(cell =>
      cell.hasClass(PAGEBREAK_HEADER_TAG)
    );
    const footer = toMove.findIndex(cell => cell.hasClass(PAGEBREAK_CELL_TAG));
    const selectionLength = toMove.length;
    console.log(
      'header, footer',
      'selectionlength',
      header,
      footer,
      selectionLength
    );

    const headerIsValid = header !== -1;
    const footerIsValid = footer !== -1;
    console.log(headerIsValid, footerIsValid);
    //if we're only dragging a header or footer without the other
    if ((headerIsValid || footerIsValid) && headerIsValid !== footerIsValid) {
      return false;
    }
    // //if we're dragging a header or footer with other cells (invalid!)
    // if (
    //   ((headerIsValid && !footerIsValid) ||
    //     (!headerIsValid && footerIsValid)) &&
    //   (selectionLength > 1 || collapsedIndex !== -1)
    // ) {
    //   return [false, false];
    // }
    //if we're dragging a full pagebreak (and ONLY a full pagebreak)
    if (header === 0 && footer === selectionLength - 1) {
      //only drop in valid locations (headers or bottom footer)
      if (
        targetWidget.hasClass(PAGEBREAK_HEADER_TAG) ||
        (isBottom && targetWidget.hasClass(PAGEBREAK_CELL_TAG))
      ) {
        console.log('valid drop', header, footer);
        return true;
      } else {
        return false;
      }
    }
    //if we're only dragging cells
    if (!headerIsValid && !footerIsValid) {
      return true;
      // if (targetWidget.node.classList.contains(PAGEBREAK_HEADER_TAG)) {
      //   // TODO: Check if the cells are md or raw, if so, allow them to be dragged between pbs
      //   return false;
      // } else {
      //   return true;
      // }
    }

    //we shouldn't reach this
    console.log(
      'Found INVALID Drag State!',
      'header = ',
      header,
      'footer = ',
      footer,
      selectionLength
    );
    return false;
  }

  // handleDrop(event: Drag.Event): void {
  //   const notebook = this._notebook;
  //   if (!event.mimeData.hasData(JUPYTER_CELL_MIME)) {
  //     return;
  //   }
  //   event.preventDefault();
  //   event.stopPropagation();
  //   if (event.proposedAction === 'none') {
  //     event.dropAction = 'none';
  //     return;
  //   }

  //   let target = event.target as HTMLElement;

  //   //PAGEBREAK CHANGE: check if the source and target are valid
  //   let index = this.findCell(target, notebook);
  //   let isBottom = false;
  //   if (index === -1) {
  //     index = notebook.widgets.length - 1;
  //     isBottom = true;
  //   }
  //   const targetWidget = notebook.widgets[index];
  //   const sourceElements =
  //     notebook.node.getElementsByClassName(DROP_SOURCE_CLASS);
  //   const [isValid, isPagebreak] = this.isValidDrop(
  //     targetWidget,
  //     sourceElements,
  //     isBottom,
  //     notebook
  //   );
  //   if (!isValid) {
  //     if (this._notebook.selectedCells.length > 1) {
  //       this._notebook.deselectAll();
  //       this._notebook.select(this._notebook.activeCell!);
  //     }
  //     return;
  //   }

  //   notebook.widgets.forEach(cell =>
  //     cell.node.classList.remove(DROP_TARGET_CLASS_BOTTOM)
  //   );
  //   //PAGEBREAK CHANGE: check if the source and target are valid

  //   while (target && target.parentElement) {
  //     if (target.classList.contains(DROP_TARGET_CLASS)) {
  //       target.classList.remove(DROP_TARGET_CLASS);
  //       target.classList.remove(DROP_TARGET_CLASS_BOTTOM);
  //       break;
  //     }
  //     target = target.parentElement;
  //   }

  //   // Model presence should be checked before calling event handlers
  //   const model = notebook.model!;

  //   const source: Notebook = event.source;
  //   if (source === notebook) {
  //     // Handle the case where we are moving cells within
  //     // the same notebook.
  //     event.dropAction = 'move';
  //     const toMove: Cell[] = event.mimeData.getData('internal:cells');

  //     // For collapsed markdown headings with hidden "child" cells, move all
  //     // child cells as well as the markdown heading.
  //     const cell = toMove[toMove.length - 1];
  //     let recollapse = false;
  //     if (cell instanceof MarkdownCell && cell.headingCollapsed) {
  //       const nextParent = NotebookActions.findNextParentHeading(cell, source);
  //       const index = findIndex(source.widgets, (possibleCell: Cell) => {
  //         return cell.model.id === possibleCell.model.id;
  //       });
  //       console.log('dropping', nextParent);
  //       if (nextParent > 0 && nextParent < source.widgets.length) {
  //         toMove.push(...source.widgets.slice(index + 1, nextParent));
  //       } else {
  //         //if this is the last header, make sure we don't move cells below the pb
  //         const scopeNum = Utils.findScopeNumber(
  //           cell,
  //           this._manager.previousSchema
  //         );
  //         const [, , , footerIndex] = Utils.findHeaderandFooter(
  //           scopeNum,
  //           notebook,
  //           this._manager.previousSchema
  //         );
  //         cell.headingCollapsed = false;
  //         console.log('found collapse to drag', index, footerIndex);
  //         toMove.push(...source.widgets.slice(index + 1, footerIndex + 1));
  //         recollapse = true;
  //       }
  //     }

  //     // Compute the to/from indices for the move.
  //     const fromIndex = ArrayExt.firstIndexOf(notebook.widgets, toMove[0]);
  //     let toIndex = this.findCell(target, notebook);
  //     // This check is needed for consistency with the view.
  //     if (toIndex !== -1 && toIndex > fromIndex) {
  //       toIndex -= 1;
  //     } else if (toIndex === -1) {
  //       // If the drop is within the notebook but not on any cell,
  //       // most often this means it is past the cell areas, so
  //       // set it to move the cells to the end of the notebook.
  //       toIndex = notebook.widgets.length - 1;
  //       // if (isPagebreak) {
  //       //   let lastPbIndex = -1;
  //       //   notebook.widgets.forEach((searchCell, index) => {
  //       //     if (searchCell?.model.getMetadata('pagebreak') === true) {
  //       //       if (lastPbIndex < index) {
  //       //         lastPbIndex = index;
  //       //       }
  //       //     }
  //       //   });
  //       //   if (lastPbIndex > -1) {
  //       //     toIndex = lastPbIndex;
  //       //   }
  //       // } else {
  //       //   toIndex = notebook.widgets.length - 1;
  //       // }
  //     }
  //     // Don't move if we are within the block of selected cells.
  //     if (toIndex >= fromIndex && toIndex < fromIndex + toMove.length) {
  //       return;
  //     }

  //     // Move the cells one by one
  //     notebook.moveCell(fromIndex, toIndex, toMove.length);
  //     if (recollapse) {
  //       (cell as MarkdownCell).headingCollapsed = true;
  //     }
  //   } else {
  //     // Handle the case where we are copying cells between
  //     // notebooks.
  //     event.dropAction = 'copy';
  //     // Find the target cell and insert the copied cells.
  //     let index = this.findCell(target, notebook);
  //     if (index === -1) {
  //       index = notebook.widgets.length;
  //     }
  //     const start = index;
  //     const values = event.mimeData.getData(JUPYTER_CELL_MIME);
  //     // Insert the copies of the original cells.
  //     // We preserve trust status of pasted cells by not modifying metadata.
  //     model.sharedModel.insertCells(index, values);
  //     // Select the inserted cells.
  //     notebook.deselectAll();
  //     notebook.activeCellIndex = start;
  //     notebook.extendContiguousSelectionTo(index - 1);
  //   }
  //   void NotebookActions.focusActiveCell(notebook);
  // }
  handleDrop(event: Drag.Event): void {
    const notebook = this._notebook;
    console.log('handle Drop');
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

    //PB CHANGE
    notebook.widgets.forEach(cell =>
      cell.node.classList.remove(DROP_TARGET_CLASS_BOTTOM)
    );
    //PB Change

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
      let toIndex = this.findCell(target, notebook);
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
      console.log(
        'dropping :',
        toMove.map(cell => cell.model.sharedModel.getSource()).toString(),
        'to: ',
        toIndex,
        'from:',
        fromIndex
      );
      const isValid = this.isValidDrop(
        notebook.widgets[toIndex],
        toMove,
        false,
        notebook
      );
      if (!isValid) {
        console.log('drop invalid');
        return;
      }
      // console.log('moving cells', notebook.widgets);
      // notebook.widgets.forEach(cell => console.log(cell.model.id));
      // Move the cells one by one
      notebook.moveCell(fromIndex, toIndex, toMove.length);
      // console.log('after move', notebook.widgets);
      // notebook.widgets.forEach(cell => console.log(cell.model.id));
    } else {
      // Handle the case where we are copying cells between
      // notebooks.
      event.dropAction = 'copy';
      // Find the target cell and insert the copied cells.
      let index = this.findCell(target, notebook);
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
  findEventTargetAndCell(
    event: MouseEvent,
    notebook: Notebook
  ): [HTMLElement, number] {
    let target = event.target as HTMLElement;
    let index = this.findCell(target, notebook);
    if (index === -1) {
      // `event.target` sometimes gives an orphaned node in Firefox 57, which
      // can have `null` anywhere in its parent line. If we fail to find a cell
      // using `event.target`, try again using a target reconstructed from the
      // position of the click event.
      target = document.elementFromPoint(
        event.clientX,
        event.clientY
      ) as HTMLElement;
      index = this.findCell(target, notebook);
    }
    return [target, index];
  }

  findCell(node: HTMLElement, notebook: Notebook): number {
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
  startDrag(index: number, clientX: number, clientY: number): void {
    // console.log('START DRAG');
    const cells = this._notebook.model!.cells;
    const selected: nbformat.ICell[] = [];
    const toMove: Cell[] = [];
    let i = -1;
    for (const widget of this._notebook.widgets) {
      const cell = cells.get(++i);
      if (this._notebook.isSelectedOrActive(widget)) {
        widget.addClass(DROP_SOURCE_CLASS);
        selected.push(cell.toJSON());
        toMove.push(widget);
      }
    }
    const activeCell = this._notebook.activeCell;
    let dragImage: HTMLElement | null = null;
    let countString: string;
    if (activeCell?.model.type === 'code') {
      const executionCount = (activeCell.model as ICodeCellModel)
        .executionCount;
      countString = ' ';
      if (executionCount) {
        countString = executionCount.toString();
      }
    } else {
      countString = '';
    }

    // Create the drag image.
    dragImage = this.createDragImage(
      selected.length,
      countString,
      activeCell?.model.sharedModel.getSource().split('\n')[0].slice(0, 26) ??
        ''
    );

    // Set up the drag event.
    this._drag = new Drag({
      mimeData: new MimeData(),
      dragImage,
      supportedActions: 'copy-move',
      proposedAction: 'copy',
      source: this._notebook
    });
    this._drag.mimeData.setData(JUPYTER_CELL_MIME, selected);
    // Add mimeData for the fully reified cell widgets, for the
    // case where the target is in the same notebook and we
    // can just move the cells.
    this._drag.mimeData.setData('internal:cells', toMove);
    // Add mimeData for the text content of the selected cells,
    // allowing for drag/drop into plain text fields.
    const textContent = toMove
      .map(cell => cell.model.sharedModel.getSource())
      .join('\n');
    this._drag.mimeData.setData('text/plain', textContent);

    // Remove mousemove and mouseup listeners and start the drag.
    document.removeEventListener('mousemove', this, true);
    document.removeEventListener('mouseup', this, true);
    this._mouseMode = null;
    void this._drag.start(clientX, clientY).then(action => {
      if (this._notebook.isDisposed) {
        return;
      }
      this._drag = null;
      for (const widget of toMove) {
        widget.removeClass(DROP_SOURCE_CLASS);
      }
    });
  }
  createDragImage(
    count: number,
    promptNumber: string,
    cellContent: string
  ): HTMLElement {
    if (count > 1) {
      if (promptNumber !== '') {
        return VirtualDOM.realize(
          h.div(
            h.div(
              { className: DRAG_IMAGE_CLASS },
              h.span(
                { className: CELL_DRAG_PROMPT_CLASS },
                '[' + promptNumber + ']:'
              ),
              h.span({ className: CELL_DRAG_CONTENT_CLASS }, cellContent)
            ),
            h.div({ className: CELL_DRAG_MULTIPLE_BACK }, '')
          )
        );
      } else {
        return VirtualDOM.realize(
          h.div(
            h.div(
              { className: DRAG_IMAGE_CLASS },
              h.span({ className: CELL_DRAG_PROMPT_CLASS }),
              h.span({ className: CELL_DRAG_CONTENT_CLASS }, cellContent)
            ),
            h.div({ className: CELL_DRAG_MULTIPLE_BACK }, '')
          )
        );
      }
    } else {
      if (promptNumber !== '') {
        return VirtualDOM.realize(
          h.div(
            h.div(
              { className: `${DRAG_IMAGE_CLASS} ${SINGLE_DRAG_IMAGE_CLASS}` },
              h.span(
                { className: CELL_DRAG_PROMPT_CLASS },
                '[' + promptNumber + ']:'
              ),
              h.span({ className: CELL_DRAG_CONTENT_CLASS }, cellContent)
            )
          )
        );
      } else {
        return VirtualDOM.realize(
          h.div(
            h.div(
              { className: `${DRAG_IMAGE_CLASS} ${SINGLE_DRAG_IMAGE_CLASS}` },
              h.span({ className: CELL_DRAG_PROMPT_CLASS }),
              h.span({ className: CELL_DRAG_CONTENT_CLASS }, cellContent)
            )
          )
        );
      }
    }
  }
}
