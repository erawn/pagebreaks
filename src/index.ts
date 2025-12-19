import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
// import { IEditorServices } from '@jupyterlab/codeeditor';
import { ICommandPalette, ISessionContextDialogs } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import {
  INotebookTracker,
  Notebook,
  NotebookActions,
  NotebookPanel
} from '@jupyterlab/notebook';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import _ from 'lodash';
import '../style/index.css';
import { addCommands, updateCommands } from './commands';
import { pagebreakEventHandlers } from './events';
import { buildNotebookSchema, sendSchema } from './schema';
import { tagNotebookCells } from './styling';
// import { settingsInit } from './settings'
import {
  checkNbTypes,
  ensurePBCellsAreUndeleteable,
  lookForNewCells
} from './utils';
import { pagebreaksState } from './state';
import { PluginStatusHeader } from './statusHeader';
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
    // const { commands } = app;

    // const schemaManager = new SchemaManager();
    // const isActiveManager = new activeManager();

    const state = new pagebreaksState();
    //   // settingsInit(settingRegistry, plugin, isActiveManager, this)
    settingRegistry
      .load(plugin.id)
      .then(settings => {
        console.log('pagebreaks settings loaded:', settings.composite);

        // settings.composite.

        // .forEach((name: string) => {
        //   settings
        //     .get('enableLogging')
        //     .composite?.toString()
        //     .toLowerCase() === 'true' ? true : false
        // });
      })
      .catch(reason => {
        console.error('Failed to load settings for pagebreaks.', reason);
      });
    settingRegistry.pluginChanged.connect(name => {
      settingRegistry
        .load(plugin.id)
        .then(settings => {
          // console.log('pagebreaks settings changed:', settings.composite);
          // isActiveManager.setLoggingSetting(
          //   settings
          //     .get('enableLogging')
          //     .composite?.toString()
          //     .toLowerCase() === 'true' ? true : false
          // );
          // isActiveManager.setActiveSetting(
          //   settings
          //     .get('enablePlugin')
          //     .composite?.toString()
          //     .toLowerCase() === 'true' ? true : false
          // );
        })
        .catch(reason => {
          console.error('Failed to load settings for pagebreaks.', reason);
        });
    }, this);

    console.log('JupyterLab extension pagebreaks is activated!');

    const notebook = notebookTracker.currentWidget!;

    notebookTracker.currentWidget?.revealed.then(() => {
      updatePagebreak(app, notebookTracker, state);
      addCommands(
        app,
        notebookTracker,
        updatePagebreak,
        state,
        sessionDialogs,
        docManager
      );
    });
    const startupFrontEndThrottled = _.throttle(startupFrontend, 100);
    function startupFrontend() {
      state.checkIPPlugin(notebookTracker).then(status => {
        if (status === 'unset' || status === 'inactive') {
          startupFrontEndThrottled();
        } else {
          console.log('found IP!');
        }
      });
    }
    startupFrontEndThrottled();

    // const startupInterval = setInterval(async () => {
    //   console.log('Waiting To Reveal...');

    //   const isActive =
    //     notebookTracker.currentWidget?.content.isVisible &&
    //     notebookTracker.currentWidget?.isRevealed
    //   if (isActive) {
    //     console.log('Visible and Revealed');
    //     updatePagebreak(app, notebookTracker, state, true);
    //

    //     addCommands(app, notebookTracker, updatePagebreak, state, sessionDialogs, docManager)
    //     clearInterval(startupInterval);
    //   }
    //   updatePagebreak(app, notebookTracker, state);
    //   state.checkIPPlugin(notebook)
    // }, 10);

    notebookTracker.restored.then(() => {
      console.log('restored');
      notebookTracker.currentWidget?.revealed.then(() => {
        console.log('current widget');
        updatePagebreak(app, notebookTracker, state);
      });
    });

    notebookTracker.activeCellChanged.connect(() => {
      updatePagebreak(app, notebookTracker, state);
    });

    NotebookActions.executionScheduled.connect(
      (notebook: Notebook, cell: any) => {
        updatePagebreak(app, notebookTracker, state, true);
      }
    );

    notebookTracker.currentChanged.connect(() => {
      state.eventHandlers?.switchNotebooks(notebookTracker.currentWidget!);
      updatePagebreak(app, notebookTracker, state);

      const kernel = notebook?.sessionContext?.session?.kernel;
      kernel?.connectionStatusChanged.connect(slot => {
        state.setPluginStatus('unset');
        updatePagebreak(app, notebookTracker, state, true);
      });
      notebook?.sessionContext?.connectionStatusChanged.connect(() => {
        state.setPluginStatus('unset');
        updatePagebreak(app, notebookTracker, state);
      });
    });

    notebookTracker.widgetUpdated.connect(() => {
      notebookTracker.currentWidget?.revealed.then(() => {
        state.eventHandlers?.switchNotebooks(notebookTracker.currentWidget!);
        updatePagebreak(app, notebookTracker, state);
      });
      if (
        notebookTracker.currentWidget?.isAttached &&
        notebookTracker.currentWidget instanceof NotebookPanel
      ) {
        updatePagebreak(app, notebookTracker, state);
        state.eventHandlers?.switchNotebooks(notebookTracker.currentWidget!);
      }
    });
  }
};

function updatePagebreak(
  app: JupyterFrontEnd,
  notebookTracker: INotebookTracker,
  state: pagebreaksState,
  force: boolean = false
) {
  console.log('update Pagebreak');
  const notebook = notebookTracker.currentWidget;
  if (notebook === undefined || notebook === null) {
    console.log('ERROR: notebook was undefined or null!!!');
    return;
  }
  if (state.eventHandlers!) {
    state.eventHandlers = new pagebreakEventHandlers(notebook, state);
  }

  state.checkIPPlugin(notebookTracker);
  state.eventHandlers?.update(notebook);
  updateCommands(app);
  const isActive =
    state.getPluginStatus() === 'active' &&
    notebookTracker.currentWidget?.content.isVisible &&
    notebookTracker.currentWidget?.isRevealed;
  const schema = isActive ? buildNotebookSchema(notebook) : null;

  if (notebookTracker.currentWidget) {
    console.log('applying style');
    ensurePBCellsAreUndeleteable(notebook?.content);
    // addVariableListWidget(notebookTracker,schemaManager);
    lookForNewCells(notebook.content);
    const schema = buildNotebookSchema(notebook);
    checkNbTypes(notebook.content, schema);
    updateCommands(app);
    tagNotebookCells(notebook, schema);
    if (state.headerWidget === null) {
      state.headerWidget = new PluginStatusHeader();
    }
    if (!notebook.contentHeader.contains(state.headerWidget)) {
      notebook.contentHeader.addWidget(state.headerWidget);
    }
  }

  if (!isActive) {
    console.log('Pagebreaks is Inactive!');
    console.log(state.getPluginStatus());
    // console.log(state.checkisActive(notebookTracker.currentWidget!), notebookTracker.currentWidget?.content.isVisible,
    //   notebookTracker.currentWidget?.isRevealed)
  } else {
    console.log('activated');
    if (!_.isEqual(state.previousSchema, schema) || force) {
      state.previousSchema = schema;
      const jsonSchema =
        schema === null
          ? JSON.stringify({ inactive: true })
          : JSON.stringify(schema);
      // console.log('sendSchema', jsonSchema);
      sendSchema(notebook, jsonSchema, state);
      // notebook.update();
    }
    console.log('updateLoop!');
  }
}
export default plugin;
