import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  LabShell
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import '../style/index.css';
/**
 * Initialization data for the Pagebreaks extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'Pagebreaks:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker],
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log('JupyterLab extension Pagebreaks is activated!');
    // if (notebook) {
    //   notebook.revealed.then(() => {})
    // }
    notebookTracker.activeCellChanged.connect(() => {
      console.log('activeCell updated!');
      const notebook = app.shell.currentWidget as NotebookPanel;
      if (notebook) {
        notebook.revealed.then(() => {
          console.log('notebook revealed');
          console.log('current selection is:');
          console.log(notebook.content.activeCellIndex);
        });
      }
      notebook?.content?.widgets.map((cell, index) => {
        if (index === notebook.content.activeCellIndex) {
          cell.addClass('jp-pb-pagebreakCell');
          console.log('applying tag');
          console.log(cell.id);
        } else {
          console.log('removing tag');
          cell.removeClass('jp-pb-pagebreakCell');
        }
      });

      // notebookTracker.activeCell?.addClass('.jp-pb-pagebreakCell')
      // const cellList = notebook?.content.model?.cells;
      // const widgetList = notebook?.children
      // if (cellList) {
      //   for (let cell of cellList) {
      //     console.log("Found cell:")
      //     console.log(cell.sharedModel.getSource)
      //     if (cell.id === notebookTracker.activeCell?.model.id) {
      //       cell.sharedModel.
      //     }
      //   }
      // }
      // for (let widget of notebook.children) {

      // }

      updatePagebreak(app);
      // let widget = app.shell.currentWidget
      // if (widget instanceof NotebookPanel) {
      //   let nb = widget as NotebookPanel
      //   let cells = nb.content.model?.cells
      //   for (let cell of cells ?) {

      //   }
      // }
    });

    (app.shell as LabShell).activeChanged.connect(() =>
      // updatePagebreak(app)
      console.log('shell changed!')
    );

    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('Pagebreaks settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for Pagebreaks.', reason);
        });
    }
  }
};

function updatePagebreak(app: JupyterFrontEnd) {
  //   let widget = app.shell.currentWidget;
  //   if (widget instanceof NotebookPanel) {
  //     let nb = widget as NotebookPanel;
  //     // nb.sessionContext
  //     // this._model = new KernelModel(this._sessionContext);
  //   }
}
export default plugin;
