import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  LabShell
} from '@jupyterlab/application';
// import { IEditorServices } from '@jupyterlab/codeeditor';
import { ISessionContextDialogs } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import _ from 'lodash';
import '../style/index.css';
import { activeManager } from './activeManager';
import { addCommands } from './commands';
import { pagebreakEventHandlers } from './events';
import { buildNotebookSchema, sendSchema } from './schema';
import { schemaManager } from './schemaManager';
import { tagNotebookCells } from './styling';
import { cleanNbTypes, ensurePBCellsAreUndeleteable } from './utils';
import { addVariableListWidget } from './variableListToolbar';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'pagebreaks:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [INotebookTracker, ISettingRegistry, ISessionContextDialogs],
  optional: [],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    sessionDialogs: ISessionContextDialogs,
    paths: JupyterFrontEnd.IPaths
  ) => {
    console.log('JupyterLab extension pagebreaks is activated!');
    const manager = new schemaManager();
    const isActiveManager = new activeManager();
    if (settingRegistry) {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('pagebreaks settings loaded:', settings.composite);
          isActiveManager.setLoggingSetting(
            settings
              .get('enableLogging')
              .composite?.toString()
              .toLowerCase() === 'true' ?? false
          );
          isActiveManager.setActiveSetting(
            settings.get('enablePlugin').composite?.toString().toLowerCase() ===
              'true' ?? false
          );
        })
        .catch(reason => {
          console.error('Failed to load settings for pagebreaks.', reason);
        });
      settingRegistry.pluginChanged.connect(name => {
        console.log('settings changed', name);
      });
    }

    // const active = true;
    notebookTracker.currentChanged.connect(() => {
      notebookTracker.currentWidget?.sessionContext.kernelChanged.connect(
        () => {
          if (isActiveManager) {
            isActiveManager.findLanguageSetting(notebookTracker);
          }
        }
      );
      if (isActiveManager) {
        isActiveManager.findLanguageSetting(notebookTracker);
      }
    });

    addCommands(
      app,
      notebookTracker,
      () => {
        updatePagebreak(app, notebookTracker, manager, isActiveManager);
      },
      manager,
      sessionDialogs,
      isActiveManager
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setInterval(async () => {
      // console.log('checking notebook....');
      // console.log(
      //   'IsNOtebookActive?',
      //   isActiveManager.checkisActive(notebookTracker)
      // );
      const notebook = notebookTracker.currentWidget;
      if (notebook?.content.isVisible && notebook.isRevealed) {
        updatePagebreak(app, notebookTracker, manager, isActiveManager);
        //need to update this so that add pb button appears on reload for empty cell
        const { commands } = app;
        commands.notifyCommandChanged('toolbar-button:add-pagebreak');
      }
    }, 1000);

    const startupInterval = setInterval(async () => {
      console.log('Waiting To Reveal...');
      // const elements = document.getElementsByClassName('jp-pb-pagebreakCell');
      const notebook = notebookTracker.currentWidget;
      if (notebook?.content.isVisible && notebook.isRevealed) {
        console.log('Visible and Revealed');
        updatePagebreak(app, notebookTracker, manager, isActiveManager, true);
        clearInterval(startupInterval);

        const kernel = notebook?.sessionContext?.session?.kernel;
        kernel?.connectionStatusChanged.connect(slot => {
          isActiveManager.setPluginStatus('unset', notebook);
          updatePagebreak(app, notebookTracker, manager, isActiveManager, true);
        });
        notebook?.sessionContext?.connectionStatusChanged.connect(() => {
          isActiveManager.setPluginStatus('unset', notebook);
          updatePagebreak(app, notebookTracker, manager, isActiveManager);
        });
      }
    }, 100);
    // notebookTracker.restored.then(() => {
    //   notebookTracker.currentWidget?.revealed.then(() => {
    //     console.log('current widget');
    //      updatePagebreak(app, notebookTracker, manager, isActiveManager);
    //   });
    //   notebookTracker.activeCell?.ready.then(() => {
    //      updatePagebreak(app, notebookTracker, manager, isActiveManager);
    //   });
    // });

    notebookTracker.activeCellChanged.connect(() => {
      if (app.shell?.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell?.currentWidget as NotebookPanel;
        if (notebook && notebook.isRevealed) {
          console.log('activeCellChanged CALL');

          updatePagebreak(app, notebookTracker, manager, isActiveManager);
        }
      }
    });
    notebookTracker.widgetUpdated.connect(() => {
      updatePagebreak(app, notebookTracker, manager, isActiveManager);
      if (
        notebookTracker.currentWidget?.isAttached &&
        notebookTracker.currentWidget instanceof NotebookPanel
      ) {
        const notebook = notebookTracker.currentWidget;
        manager.eventHandlers?.switchNotebooks(notebook.content);
      }
    });

    (app.shell as LabShell).activeChanged.connect(() => {
      if (app.shell.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell.currentWidget as NotebookPanel;
        if (notebook && notebook.isRevealed) {
          console.log('LabShell activeChanged CALL');

          updatePagebreak(app, notebookTracker, manager, isActiveManager);
        }
      }
    });
  }
};

const updatePagebreak = _.throttle(updatePagebreakFunc, 100);

function updatePagebreakFunc(
  app: JupyterFrontEnd,
  notebookTracker: INotebookTracker,
  manager: schemaManager,
  isActiveManager: activeManager,
  force: boolean = false
) {
  // console.log('update Pagebreak');
  // console.log(
  //   'updating pagebreak',
  //   notebookTracker.currentWidget?.content.widgets
  // );
  if (!isActiveManager.checkisActive(notebookTracker)) {
    console.log('Pagebreaks is Inactive!');
    return;
  }
  const notebook = notebookTracker.currentWidget;
  if (notebook === undefined || notebook === null) {
    console.error('ERROR: notebook was undefined or null!!!');
    return;
  }

  if (!manager.eventHandlers) {
    if (notebook.content.isAttached) {
      manager.eventHandlers = new pagebreakEventHandlers(
        notebook.content,
        manager
      );
    }
  }

  // maintainence tasks:
  // if (manager.getPluginStatus() === 'unset') {
  //   checkIPPlugin(notebook, manager);
  // }
  isActiveManager.updatePlugin(notebook);

  isActiveManager.updatePluginStatusHeader(notebook);
  cleanNbTypes(notebook?.content);
  ensurePBCellsAreUndeleteable(notebook?.content);
  manager.eventHandlers?.update();
  addVariableListWidget(notebookTracker, manager);

  // updateCommands(app);
  const schema = buildNotebookSchema(notebook);
  // if (orderCells(notebook, schema)) {
  //   schema = buildNotebookSchema(notebook);
  // }
  // console.log('tagging', schema);
  tagNotebookCells(notebook, schema);
  const now = new Date();
  // eslint-disable-next-line no-constant-condition
  if (
    !_.isEqual(manager.previousSchema, schema) ||
    now.getTime() - manager.lastSend.getTime() > 100 ||
    force
  ) {
    if (
      !notebook?.sessionContext ||
      !notebook?.sessionContext?.session?.kernel
    ) {
      console.log("PB: Not sending schema because kernel isn't connected");
      return;
    }
    // console.log('sending schema', schema);
    manager.lastSend = now;
    manager.previousSchema = schema;
    const jsonSchema = JSON.stringify(schema);
    sendSchema(notebook, jsonSchema, manager);
    // notebook.update();
  }
}
export default plugin;
