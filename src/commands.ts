// import { IEditorServices } from '@jupyterlab/codeeditor';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { LabIcon } from '@jupyterlab/ui-components';
import '../style/index.css';
function addCommands(app: JupyterFrontEnd, notebookTracker: INotebookTracker) {
  const { commands } = app;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const addPagebreakIconStr = require('../style/create-icon.svg') as string;
  const addPagebreakIcon = new LabIcon({
    name: 'ui-components:add-pagebreak',
    svgstr: addPagebreakIconStr
  });

  commands.addCommand('toolbar-button:add-pagebreak', {
    icon: addPagebreakIcon,
    caption: 'Make a new Pagebreak',
    execute: () => {
      console.log('Pagebreak Add Call!');
      const notebookPanel = app.shell.currentWidget as NotebookPanel;
      const notebook = notebookPanel.content;
      if (!notebook.model) {
        return;
      }

      const model = notebook.model;

      const headerIndex = notebook.activeCell
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
            `An error occurred during the execution of Running Pagebreaks Command.\n${reason}`
          );
        });
      const newCodeIndex = notebook.activeCell
        ? notebook.activeCellIndex + 1
        : 0;
      model.sharedModel.insertCell(newCodeIndex, {
        cell_type: 'code',
        metadata: {
          // This is an empty cell created by user, thus is trusted
          trusted: true
        }
      });
      notebook.activeCellIndex = newCodeIndex;
      const footerIndex = notebook.activeCell
        ? notebook.activeCellIndex + 1
        : 0;
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
    },
    isVisible: () =>
      notebookTracker.activeCell?.model.getMetadata('pagebreak') ||
      (app.shell.currentWidget as NotebookPanel)?.content?.widgets?.find(cell =>
        cell.model.getMetadata('pagebreak')
      ) === undefined
  });
}

export { addCommands };
