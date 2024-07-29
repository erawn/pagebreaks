// import { IEditorServices } from '@jupyterlab/codeeditor';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { ISessionContextDialogs } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IDocumentWidget } from '@jupyterlab/docregistry';
import * as nbformat from '@jupyterlab/nbformat';
import {
  INotebookTracker,
  Notebook,
  NotebookActions,
  NotebookPanel
} from '@jupyterlab/notebook';
import { Contents, KernelMessage } from '@jupyterlab/services';
import { LabIcon } from '@jupyterlab/ui-components';
import addPagebreakIconStr from '../style/create-icon.svg';
import '../style/index.css';
import mergeUpIconStr from '../style/merge-up-icon.svg';
import runPagebreakIconStr from '../style/run-pagebreak-icon.svg';
import { activeManager } from './activeManager';
import { buildNotebookSchema, sendTransform } from './schema';
import { schemaManager } from './schemaManager';
import { findHeaderandFooter, findScopeNumber } from './utils';
function addCommands(
  app: JupyterFrontEnd,
  notebookTracker: INotebookTracker,
  updateCallback: CallableFunction,
  schemaManager: schemaManager,
  sessionDialogs: ISessionContextDialogs,
  activeManager: activeManager,
  docManager: IDocumentManager
) {
  const { commands } = app;

  const runPagebreakIcon = new LabIcon({
    name: 'ui-components:run-pagebreak',
    svgstr: runPagebreakIconStr
  });
  const addPagebreakIcon = new LabIcon({
    name: 'ui-components:add-pagebreak',
    svgstr: addPagebreakIconStr
  });
  const mergeUpIcon = new LabIcon({
    name: 'ui-components:merge-pagebreak',
    svgstr: mergeUpIconStr
  });

  // {
  //   "name": "delete-pagebreak",
  //   "command": "toolbar-button:delete-pagebreak"
  // },
  commands.addCommand('docmanager:convert-pagebreak', {
    label: () => 'Convert Pagebreak To Regular Notebook',
    caption: 'Convert Pagebreak To Regular Notebook',
    execute: () => {
      if (notebookTracker.currentWidget === null) {
        return;
      }
      const notebookPanel = notebookTracker.currentWidget;
      if (notebookPanel === null) {
        return;
      }
      const schema = buildNotebookSchema(notebookPanel);
      const notebook = notebookPanel.content;

      const transformlist = schema.cellList
        .filter(cell => cell.type === 'pagebreak' || cell.type === 'code')
        .map(cell => {
          if (cell.type === 'pagebreak') {
            return {
              index: cell.index,
              id: cell.id,
              type: cell.type,
              variables: [cell.variables],
              pbNum: schema.scopes.find(searchCell => cell.id === searchCell.id)
                ?.pbNum
            };
          }
          if (cell.type === 'code') {
            return {
              index: cell.index,
              id: cell.id,
              type: cell.type,
              variables: [],
              source: notebook
                ._findCellById(cell.id)
                ?.cell.model.sharedModel.getSource()
            };
          }
        });
      console.log('transform list', transformlist);

      const future = sendTransform(
        notebookTracker,
        '%%pb_transform \n' + JSON.stringify(transformlist)
      );
      if (future === undefined) {
        return;
      }

      future.onIOPub = async msg => {
        // console.log('Send Transform', msg);
        // eslint-disable-next-line no-constant-condition
        if (msg.header.msg_type === 'stream') {
          console.log('Send Transform', msg);
          const result = msg as KernelMessage.IStreamMsg;
          if (result.content.name === 'stdout') {
            // console.log(result.content.text);
            const parsed = JSON.parse(result.content.text) as {
              index: number;
              id: string;
              type: string;
              variables: string[][];
              pbNum?: number | undefined;
              source?: string | undefined;
              newText?: string | undefined;
            }[];
            console.log(parsed);
            if (notebookTracker.currentWidget === null) {
              return;
            }

            const newDocDup = (await commands.execute('docmanager:duplicate', {
              path: notebookTracker.currentWidget.context.path
            })) as Contents.IModel;
            const path = newDocDup.path;
            console.log(path);
            const newDoc = (await commands.execute('docmanager:open', {
              path: path
            })) as unknown as IDocumentWidget;
            if (!(newDoc?.content instanceof Notebook)) {
              return;
            }
            const panel = newDoc.content.parent;
            if (panel instanceof NotebookPanel) {
              console.log('saving');
              panel.context.save();
            }
            console.log(notebookTracker.currentWidget?.title);

            const newNotebook = newDoc.content;
            if (newNotebook === undefined) {
              return;
            }
            const cellList = notebook.widgets.map(cell => cell.model.toJSON());
            if (cellList === undefined) {
              return;
            }

            //iterate through the notebook, matching ids
            const newCells = cellList.map(cell => {
              const match = parsed.find(
                searchCell => searchCell.id === cell?.id
              );
              if (
                match !== undefined &&
                cell?.cell_type === 'code' &&
                match.newText !== undefined
              ) {
                console.log(cell.source.toString().split('\n'));
                cell.source = cell.source
                  .toString()
                  .split('\n')
                  .map(line => '# '.concat(line).concat('\n'))
                  .reduce((prev, cur) => {
                    return prev.concat(cur);
                  })
                  .concat('\n', match.newText);
                console.log('setting source', cell.source);
                return cell;
              } else if (
                match !== undefined &&
                cell?.cell_type === 'raw' &&
                match.newText !== undefined
              ) {
                cell.metadata['deleteable'] = true;
                cell.metadata['pagebreak'] = false;
                cell.cell_type = 'code';
                cell.source = match.newText;
                return cell;
              }
              if (cell.metadata['pagebreakheader']) {
                cell.metadata['pagebreakheader'] = false;
                cell.metadata['deleteable'] = true;
                return cell;
              }
              return cell;
            });
            console.log('NEW CELLS', newCells);
            (await commands.execute('docmanager:reload', {
              path: path
            })) as unknown as IDocumentWidget;
            const context = docManager.contextForWidget(newNotebook);
            await context?.save();

            newNotebook.model?.sharedModel.insertCells(
              0,
              newCells as nbformat.ICell[]
            );
            newNotebook.model?.sharedModel.deleteCellRange(
              newCells.length,
              newNotebook.model?.sharedModel.cells.length
            );
            newNotebook.update();
            void NotebookActions.focusActiveCell(newNotebook);
            // parsed.forEach(update => {
            //   if (update.type === 'code') {
            //     console.log(update.id);
            //     const cell = newNotebook.widgets.find(
            //       searchCell => searchCell.model.id === update?.id
            //     );
            //     console.log('cell', cell?.model.id);
            //     if (update.newText !== undefined) {
            //       const newCellText = cell?.model.sharedModel
            //         .getSource()
            //         .split('/n')
            //         .map(line => '# '.concat(line))
            //         .reduce((prev, cur) => {
            //           return prev.concat(cur);
            //         })
            //         .concat('/n', update.newText);
            //       console.log('updating cell:', newCellText);
            //       newCellText
            //         ? cell?.model.sharedModel.setSource(newCellText)
            //         : {};
            //     }
            //   }
            // });
            // console.log(newNotebook.widgets);
            // console.log(notebookTracker.currentWidget?.content.widgets);
            // //comment out current code and add new below
            // //replace footer cells with code cells
          }
        }
      };

      // cell.model.sharedModel.setSource('');
      // }
    }
  });
  //force update
  //iterate cells
  commands.addCommand('toolbar-button:merge-pagebreak', {
    icon: mergeUpIcon,
    caption: 'Merge with Pagebreak Above',
    execute: () => {
      const notebookPanel = notebookTracker.currentWidget;
      const notebook = notebookPanel?.content;
      if (!notebook?.model) {
        return;
      }
      const scopeNum = findScopeNumber(
        notebookTracker.activeCell,
        schemaManager.previousSchema
      );
      if (scopeNum <= 0) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [srcHeader, srcFooter, srcHeaderIndex, srcFooterIndex] =
        findHeaderandFooter(
          scopeNum,
          notebookTracker?.currentWidget?.content,
          schemaManager?.previousSchema
        );
      const [, , , destFooterIndex] = findHeaderandFooter(
        scopeNum - 1,
        notebookTracker?.currentWidget?.content,
        schemaManager?.previousSchema
      );
      const numCellsToMove = srcFooterIndex - srcHeaderIndex - 1;

      notebook.model.sharedModel.transact(() => {
        notebook.moveCell(srcHeaderIndex + 1, destFooterIndex, numCellsToMove);
        for (const source of [srcHeader, srcFooter]) {
          source ? notebook.model?.deletedCells.push(source.model.id) : {};
          const index = destFooterIndex + numCellsToMove + 1;
          notebook.model?.sharedModel.deleteCell(index);
        }
        notebook.deselectAll();
      });
    },
    isVisible: () => {
      if (
        activeManager.checkisActive(notebookTracker) &&
        (notebookTracker.activeCell?.model.getMetadata('pagebreak') ||
          notebookTracker.activeCell?.model.getMetadata('pagebreakheader'))
      ) {
        const scopeNum = findScopeNumber(
          notebookTracker.activeCell,
          schemaManager.previousSchema
        );
        if (scopeNum > 0) {
          return true;
        }
      }
      return false;
    }
  });

  commands.addCommand('toolbar-button:run-pagebreak', {
    icon: runPagebreakIcon,
    caption: 'Run Entire Pagebreak',
    execute: () => {
      console.log('run pagebreak');
      const notebookPanel = notebookTracker.currentWidget;
      const notebook = notebookPanel?.content;
      if (!notebook?.model) {
        return;
      }
      const activeCell = notebook.activeCell;
      const scopeNum = findScopeNumber(
        activeCell,
        schemaManager.previousSchema
      );
      const cellsToRun = notebook.widgets.filter(
        cell => findScopeNumber(cell, schemaManager.previousSchema) === scopeNum
      );
      console.log(cellsToRun);
      NotebookActions.runCells(
        notebook,
        cellsToRun,
        notebookPanel?.sessionContext,
        sessionDialogs
      );

      // notebook.update();
      // updateCallback();
    },
    isVisible: () => {
      const scopeNum = findScopeNumber(
        notebookTracker.activeCell,
        schemaManager.previousSchema
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [, , headerIndex, footerIndex] = findHeaderandFooter(
        scopeNum,
        notebookTracker?.currentWidget?.content,
        schemaManager?.previousSchema
      );

      const activeCellIndex =
        notebookTracker.currentWidget?.content.activeCellIndex ?? -1;
      if (
        activeManager.checkisActive(notebookTracker) &&
        headerIndex <= activeCellIndex &&
        footerIndex >= activeCellIndex
      ) {
        return true;
      }
      return false;
    }
  });

  commands.addCommand('toolbar-button:add-pagebreak', {
    icon: addPagebreakIcon,
    caption: 'Make a new Pagebreak',
    execute: () => {
      const notebookPanel = app.shell.currentWidget as NotebookPanel;
      const notebook = notebookPanel.content;
      if (!notebook.model) {
        return;
      }

      const model = notebook.model;

      //if we insert the first pagebreak, it should be inserted at the top
      const headerIndex =
        notebookTracker.activeCell?.model.getMetadata('pagebreak') === true
          ? notebook.activeCellIndex + 1
          : 0;
      model.sharedModel.insertCell(headerIndex, {
        cell_type: 'markdown',
        metadata: {
          // This is an empty cell created by user, thus is trusted
          trusted: true,
          pagebreakheader: true
        }
      });
      notebook.activeCellIndex = headerIndex;
      notebook.activeCell?.model.sharedModel.setSource('# New Pagebreak ');

      commands
        .execute('notebook:run-cell', { origin: 'init' })
        .catch(reason => {
          console.error(
            `An error occurred during the execution of Running pagebreaks Command.\n${reason}`
          );
        });
      const newCodeIndex = notebook.activeCellIndex + 1;
      model.sharedModel.insertCell(newCodeIndex, {
        cell_type: 'code',
        metadata: {
          // This is an empty cell created by user, thus is trusted
          trusted: true
        }
      });
      notebook.activeCellIndex = newCodeIndex;
      const footerIndex = notebook.activeCellIndex + 1;
      model.sharedModel.insertCell(footerIndex, {
        cell_type: 'raw',
        metadata: {
          // This is an empty cell created by user, thus is trusted
          trusted: true,
          pagebreak: true
        }
      });

      // Make the newly inserted cell active.
      notebook.activeCellIndex = footerIndex;
      notebook.activeCell?.model.sharedModel.setSource('export {  }');
      notebook.activeCell ? notebook.select(notebook.activeCell) : {};
      notebook.update();
      notebook.activeCell?.update();
      updateCallback();
    },
    isVisible: () => {
      const isActive = activeManager.checkisActive(notebookTracker);
      const currentCellIsPB =
        notebookTracker.activeCell?.model.getMetadata('pagebreak') ?? false;
      const noPBsExist =
        (app.shell.currentWidget as NotebookPanel)?.content?.widgets?.find(
          cell => cell?.model?.getMetadata('pagebreak')
        ) === undefined;
      // console.log(isActive, currentCellIsPB, noPBsExist);
      if (isActive) {
        if (currentCellIsPB || noPBsExist) {
          return true;
        }
      }
      return false;
    }
  });
  // commands.addCommand('notebook-cells:run-and-advance', {
  //   label: args => (args.toolbar ? '' : 'Run and Advance'),
  //   caption: 'Run the selected cells and advance.',
  //   icon: args => (args.toolbar ? runIcon : undefined),
  //   execute: () => {
  //     const nbWidget = app.shell.currentWidget as NotebookPanel;
  //     return NotebookActions.runAndAdvance(
  //       nbWidget.content,
  //       nbWidget.context.sessionContext,
  //       nbWidget.toolbar.
  //       sessionContextDialogs
  //     );
  //   }
  // });
}

function updateCommands(app: JupyterFrontEnd) {
  const { commands } = app;
  commands.notifyCommandChanged();
}
export { addCommands, updateCommands };
