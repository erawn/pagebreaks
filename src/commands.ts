// import { IEditorServices } from '@jupyterlab/codeeditor';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { LabIcon } from '@jupyterlab/ui-components';
import '../style/index.css';
// export interface VariableListProps {
//   notebookTracker: INotebookTracker,
// }
// const notificationStatus = ReactWidget.create(
//   <UseSignal signal={model.stateChanged}>
//     {() => {
//       if (model.highlight || (popup && !popup.isDisposed)) {
//         notificationStatus.addClass('jp-mod-selected');
//       } else {
//         notificationStatus.removeClass('jp-mod-selected');
//       return (
//         <NotificationStatus
//           count={model.count}
//           highlight={model.highlight}
//           trans={trans}
//           onClick={displayNotifications}
//         />
//       );
//     }}
//   </UseSignal>
// );
// function LiveButton(isActiveSignal: ISignal<any, boolean>) {
//   return (
//     <UseSignal
//       signal={isActiveSignal}
//       initialArgs={true}
//       children={(_, isActive) => <Button isActive={isActive}>}
//     />
//   )
//  }
// function KernelNameComponent(
//   props: VariableListProps
// ): JSX.Element {
//   // const callback = () => {
//   //   ;
//   // };
//   const { notebookTracker } = props;

//   return (
//     <UseSignal signal={isActiveSignal} initialArgs={true}>
//     {(_, isActive) => <Button isActive={isActive}>}
//    </UseSignal>
//   );
// <UseSignal signal={}>

// </UseSignal>
//   <UseSignal signal={isActiveSignal}>
//   {(_, isActive) => <Button isActive={isActive}>}
//  </UseSignal>
//   <UseSignal signal={props.notebookTracker} initialArgs={true}>
//     {sessionContext => (
//       <ToolbarButtonComponent
//         className={TOOLBAR_KERNEL_NAME_CLASS}
//         onClick={callback}
//         tooltip={trans.__('Switch kernel')}
//         label={sessionContext?.kernelDisplayName}
//       />
//     )}
//   </UseSignal>
// }
// function createKernelNameItem(
//   sessionContext: ISessionContext,
//   dialogs?: ISessionContext.IDialogs,
//   translator?: ITranslator
// ): Widget {
//   const el = ReactWidget.create(
//     <KernelNameComponent
//       sessionContext={sessionContext}
//       dialogs={dialogs ?? new SessionContextDialogs({ translator })}
//       translator={translator}
//     />
//   );
//   el.addClass('jp-KernelName');
//   return el;
// }
function addCommands(
  app: JupyterFrontEnd,
  notebookTracker: INotebookTracker,
  updateCallback: CallableFunction
) {
  // notebookTracker.currentWidget?.toolbar.addItem(
  //   'toolbar:list-variables',
  //   toolbar.createKernelNameItem(sessionContext, dialogs)
  // );

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
