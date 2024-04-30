import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  LabShell
} from '@jupyterlab/application';
// import { IEditorServices } from '@jupyterlab/codeeditor';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import '../style/index.css';
import _ from 'lodash';

class schemaManager {
  previousSchema: Map<number, IPagebreakCell> | null;
  constructor() {
    this.previousSchema = null;
  }
}
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
    console.log('JupyterLab extension Pagebreaks is activated!!!!');

    const notebook = app.shell.currentWidget as NotebookPanel;

    const manager = new schemaManager();
    if (notebook) {
      notebook.revealed.then(() => {
        updatePagebreak(app, manager);
      });
    }

    notebookTracker.activeCellChanged.connect(() => {
      console.log('activecell updated!');
      // const registry = app.docRegistry;
      // const factory = registry.getWidgetFactory('Notebook');
      // console.log('found factory', factory?.name);
      // (factory as NotebookWidgetFactory).contentFactory.createCodeCell = lambda;
      if (app.shell.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell.currentWidget as NotebookPanel;
        if (notebook) {
          notebook.revealed.then(() => {
            console.log('notebook revealed');
            console.log('nb id', notebook.id);
            updatePagebreak(app, manager);
            // console.log('current selection is:');
            // console.log(notebook.content.activeCellIndex);
          });
        }
      }
    });

    (app.shell as LabShell).activeChanged.connect(() => {
      if (app.shell.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell.currentWidget as NotebookPanel;
        if (notebook) {
          notebook.revealed.then(() => {
            console.log('notebook revealed');
            updatePagebreak(app, manager);
            // console.log('current selection is:');
            // console.log(notebook.content.activeCellIndex);
          });
        }
      }
    });

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
interface IPagebreakCell {
  index: number;
  id: string;
  type: string;
  variables?: Array<string>;
}
function tagNotebookCells(notebook: NotebookPanel) {
  notebook?.content?.widgets.forEach((cell, index) => {
    if (cell.model.type === 'code') {
      cell.addClass('jp-pb-pagebreakCodeCell');
    } else {
      cell.removeClass('jp-pb-pagebreakCodeCell');
    }

    if (
      cell.model.type === 'raw' &&
      cell.model.sharedModel.getSource().startsWith('pb')
    ) {
      cell.addClass('jp-pb-pagebreakCell');
    } else {
      cell.removeClass('jp-pb-pagebreakCell');
    }
  });
}
function buildNotebookSchema(notebook: NotebookPanel) {
  const schema: Map<number, IPagebreakCell> = new Map();
  notebook?.content?.widgets.forEach((cell, index) => {
    if (cell.model.type === 'code') {
      const newCell: IPagebreakCell = {
        index: index,
        id: cell.model.id,
        type: cell.model.type
      };
      schema.set(index, newCell);
    } else if (cell.model.type === 'raw') {
      const content = cell.model.sharedModel.getSource();
      if (content.startsWith('pb')) {
        const names = content.split(' ').filter(name => name !== 'pb');
        // console.log('found pb names', names);
        const newCell: IPagebreakCell = {
          index: index,
          id: cell.model.id,
          type: 'pagebreak',
          variables: names
        };
        schema.set(index, newCell);
      }
    }
  });
  return schema;
}
function updatePagebreak(app: JupyterFrontEnd, manager: schemaManager) {
  const notebook = app.shell.currentWidget as NotebookPanel;
  const schema = buildNotebookSchema(notebook);
  console.log('schema check');
  if (!_.isEqual(manager.previousSchema, schema)) {
    console.log('previous schema', manager.previousSchema);
    manager.previousSchema = schema;
    tagNotebookCells(notebook);

    console.log('schema changed', schema);
  }
}
export default plugin;
