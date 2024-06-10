// import { IEditorServices } from '@jupyterlab/codeeditor';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { ISessionContextDialogs } from '@jupyterlab/apputils';
import {
  INotebookTracker,
  NotebookActions,
  NotebookPanel
} from '@jupyterlab/notebook';
import { LabIcon, deleteIcon } from '@jupyterlab/ui-components';
import addPagebreakIconStr from '../style/create-icon.svg';
import '../style/index.css';
import runPagebreakIconStr from '../style/run-pagebreak-icon.svg';
import { schemaManager } from './schemaManager';
import { findHeaderandFooter, findScopeNumber } from './utils';
function addCommands(
  app: JupyterFrontEnd,
  notebookTracker: INotebookTracker,
  updateCallback: CallableFunction,
  schemaManager: schemaManager,
  sessionDialogs: ISessionContextDialogs
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

  // {
  //   "name": "delete-pagebreak",
  //   "command": "toolbar-button:delete-pagebreak"
  // },
  commands.addCommand('toolbar-button:merge-pagebreak', {
    icon: deleteIcon,
    caption: 'Merge with Pagebreak Above',
    execute: () => {
      console.log('merge pagebreak');
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
        notebookTracker.activeCell?.model.getMetadata('pagebreak') ||
        notebookTracker.activeCell?.model.getMetadata('pagebreakheader')
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
      console.log('start');
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
      console.log('finish');
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
      if (headerIndex !== -1 && footerIndex !== -1) {
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
    isVisible: () =>
      notebookTracker.activeCell?.model.getMetadata('pagebreak') ||
      (app.shell.currentWidget as NotebookPanel)?.content?.widgets?.find(cell =>
        cell.model.getMetadata('pagebreak')
      ) === undefined
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

export { addCommands };
