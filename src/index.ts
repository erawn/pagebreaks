import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  LabShell
} from '@jupyterlab/application';
// import { IEditorServices } from '@jupyterlab/codeeditor';
import { ICommandPalette, ISessionContextDialogs } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import {
  INotebookTracker,
  NotebookActions,
  NotebookPanel
} from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import _ from 'lodash';
import '../style/index.css';
import { activeManager } from './activeManager';
import { addCommands } from './commands';
import { pagebreakEventHandlers } from './events';
import { buildNotebookSchema, sendSchema } from './schema';
import { schemaManager } from './schemaManager';
import { tagNotebookCells } from './styling';
import {
  checkNbTypes,
  ensurePBCellsAreUndeleteable,
  lookForNewCells
} from './utils';
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'pagebreaks:plugin',
  description: 'A JupyterLab extension.',
  autoStart: true,
  requires: [
    INotebookTracker,
    ISettingRegistry,
    ISessionContextDialogs,
    ICommandPalette,
    IDocumentManager
  ],
  optional: [],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry,
    sessionDialogs: ISessionContextDialogs,
    palette: ICommandPalette,
    docManager: IDocumentManager,
    paths: JupyterFrontEnd.IPaths
  ) => {
    const { commands } = app;
    console.log('JupyterLab extension pagebreaks is activated!');
    commands.commandExecuted.connect((registry, args) => {
      // console.log('command fired', registry, args);
      const notebook = notebookTracker.currentWidget;
      notebook?.content.isVisible && notebook.isRevealed;
      updatePagebreak(app, notebookTracker, manager, isActiveManager);
    }, this);
    // const command = 'widgets:open-tab';
    // docManager.stateChanged.connect((slot, args) => {
    //   console.log('Doc manager', args);
    // });
    // commands.addCommand(command, {
    //   label: 'Open a Tab Widget',
    //   caption: 'Open the Widgets Example Tab',
    //   execute: () => {
    //     const widget = new pagebreakNotebook();
    //     shell.add(widget, 'main');
    //   }
    // });
    // palette.addItem({ command, category: 'Extension Examples' });

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
        settingRegistry
          .load(plugin.id)
          .then(settings => {
            // console.log('pagebreaks settings changed:', settings.composite);
            isActiveManager.setLoggingSetting(
              settings
                .get('enableLogging')
                .composite?.toString()
                .toLowerCase() === 'true' ?? false
            );
            isActiveManager.setActiveSetting(
              settings
                .get('enablePlugin')
                .composite?.toString()
                .toLowerCase() === 'true' ?? false
            );
          })
          .catch(reason => {
            console.error('Failed to load settings for pagebreaks.', reason);
          });
      }, this);
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
      isActiveManager,
      docManager
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
      for (const widget of app.shell.widgets()) {
        if (widget.isVisible) {
          if (widget instanceof NotebookPanel) {
            updatePagebreak(
              app,
              notebookTracker,
              manager,
              isActiveManager,
              true
            );
            widget.activate();
            widget.content.activate();
            widget.node.click();
            widget.content.node.click();
            widget.content.widgets.at(0)?.node.click();
          }
        }
      }
      console.log('Waiting To Reveal...');
      // const elements = document.getElementsByClassName('jp-pb-pagebreakCell');
      const notebook = notebookTracker.currentWidget;
      if (notebook?.content.isVisible && notebook.isRevealed) {
        console.log('Visible and Revealed');
        updatePagebreak(app, notebookTracker, manager, isActiveManager, true);

        // notebook?.sessionContext.statusChanged.connect(
        //   (sender, connectionStatus) => {
        //     console.log('statuschanged', connectionStatus);
        //     if (connectionStatus) {
        //       updatePagebreak(
        //         app,
        //         notebookTracker,
        //         manager,
        //         isActiveManager,
        //         true
        //       );
        //     }
        //   }
        // );
        notebook?.sessionContext.connectionStatusChanged.connect(
          (sender, connectionStatus) => {
            console.log('Notebook Connection status:', connectionStatus);
            if (connectionStatus === 'connected') {
              updatePagebreak(
                app,
                notebookTracker,
                manager,
                isActiveManager,
                true
              );
            }
          }
        );
        const kernel = notebook?.sessionContext?.session?.kernel;
        kernel?.connectionStatusChanged.connect(slot => {
          isActiveManager.setPluginStatus('unset', notebook);
          updatePagebreak(app, notebookTracker, manager, isActiveManager, true);
        });
        notebook?.sessionContext?.connectionStatusChanged.connect(() => {
          isActiveManager.setPluginStatus('unset', notebook);
          updatePagebreak(app, notebookTracker, manager, isActiveManager);
        });
        // console.log('ADDING HOOKS');
        manager.addCommandHooks(app, notebookTracker, isActiveManager);
        manager.addCellChangeHooks(notebookTracker, isActiveManager);

        clearInterval(startupInterval);
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

    // notebookTracker.activeCellChanged.connect(() => {
    //   if (app.shell?.currentWidget instanceof NotebookPanel) {
    //     const notebook = app.shell?.currentWidget as NotebookPanel;
    //     if (notebook && notebook.isRevealed) {
    //       console.log('activeCellChanged CALL');

    //       updatePagebreak(app, notebookTracker, manager, isActiveManager);
    //     }
    //   }
    // });
    notebookTracker.currentChanged.connect(() => {
      // console.log('current widget CHANGED');
      if (
        notebookTracker.currentWidget?.isAttached &&
        notebookTracker.currentWidget instanceof NotebookPanel &&
        notebookTracker.currentWidget.content.isVisible &&
        notebookTracker.currentWidget.isRevealed
      ) {
        updatePagebreak(app, notebookTracker, manager, isActiveManager);
        // console.log('CHANGING NOTEBOOKS NOTEBOOKS');
        const notebook = notebookTracker.currentWidget;
        manager.eventHandlers?.switchNotebooks(notebook);
        manager.switchNotebooks(notebookTracker, app, isActiveManager);
      }
    });
    notebookTracker.widgetUpdated.connect(() => {
      notebookTracker.currentWidget?.revealed.then(() => {
        updatePagebreak(app, notebookTracker, manager, isActiveManager);
        console.log('SWITCH NOTEBOOKS');
        const notebookPanel = notebookTracker.currentWidget;
        if (notebookPanel === null) {
          return;
        }
        manager.eventHandlers?.switchNotebooks(notebookPanel);
        manager.switchNotebooks(notebookTracker, app, isActiveManager);
      });
      if (
        notebookTracker.currentWidget?.isAttached &&
        notebookTracker.currentWidget instanceof NotebookPanel
      ) {
        updatePagebreak(app, notebookTracker, manager, isActiveManager);
        console.log('SWITCH NOTEBOOKS');
        const notebookPanel = notebookTracker.currentWidget;
        manager.eventHandlers?.switchNotebooks(notebookPanel);
        manager.switchNotebooks(notebookTracker, app, isActiveManager);
      }
    });

    (app.shell as LabShell).activeChanged.connect(() => {
      if (app.shell.currentWidget instanceof NotebookPanel) {
        const notebook = app.shell.currentWidget as NotebookPanel;
        if (notebook && notebook.isRevealed) {
          // console.log('LabShell activeChanged CALL');

          updatePagebreak(app, notebookTracker, manager, isActiveManager);
        }
      }
    });
    NotebookActions.executionScheduled.connect(() => {
      updatePagebreakFunc(app, notebookTracker, manager, isActiveManager, true);
    });
  }
};

const updatePagebreak = _.throttle(updatePagebreakFunc, 200);
// const updatePagebreakCallback = (
//   app,
//   notebookTracker,
//   manager,
//   isActiveManager
// ) => {
//   updatePagebreak(app, notebookTracker, manager, isActiveManager);
// };

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
  const notebook = notebookTracker.currentWidget;
  if (notebook === undefined || notebook === null) {
    console.log('ERROR: notebook was undefined or null!!!');
    return;
  }

  if (!manager.eventHandlers) {
    if (notebook.content.isAttached) {
      manager.eventHandlers = new pagebreakEventHandlers(
        notebook,
        manager,
        isActiveManager
      );
    }
  }
  isActiveManager.updatePlugin(notebook);

  isActiveManager.updatePluginStatusHeader(notebook);
  manager.eventHandlers?.update(notebook);

  const isActive =
    isActiveManager.checkisActive(notebookTracker) &&
    notebookTracker.currentWidget?.content.isVisible &&
    notebookTracker.currentWidget?.isRevealed;
  const schema = isActive ? buildNotebookSchema(notebook) : null;
  if (!isActive) {
    console.log('Pagebreaks is Inactive!');
  } else {
    ensurePBCellsAreUndeleteable(notebook?.content);

    // addVariableListWidget(notebookTracker, manager);
    lookForNewCells(notebook.content);
    const schema = buildNotebookSchema(notebook);
    checkNbTypes(notebook.content, schema);
    tagNotebookCells(notebook, schema);
  }

  // maintainence tasks:
  // if (manager.getPluginStatus() === 'unset') {
  //   checkIPPlugin(notebook, manager);
  // }

  // cleanNbTypes(notebook?.content);

  // notebook.context.fileChanged.connect((slot, args));
  // cleanInBetweenCells(notebook?.content, schema);
  // if (orderCells(notebook, schema)) {
  //   schema = buildNotebookSchema(notebook);
  // }
  // console.log('tagging', schema);
  // sendJSONDiff(notebook, manager, isActiveManager);
  // sendLog(notebook, JSON.stringify(json) ?? '', isActiveManager);

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
    const jsonSchema =
      schema === null
        ? JSON.stringify({ inactive: true })
        : JSON.stringify(schema);
    // console.log('sendSchema', jsonSchema);
    sendSchema(notebook, jsonSchema, manager);
    // notebook.update();
  }
}
export default plugin;

// class pagebreakNotebook extends Notebook {}
