import { INotebookTracker } from '@jupyterlab/notebook';
import {
  ReactWidget,
  ToolbarButtonComponent,
  UseSignal
} from '@jupyterlab/ui-components';
import { find } from '@lumino/algorithm';
import { Widget } from '@lumino/widgets';
import * as React from 'react';
import { schemaManager } from './schemaManager';
const TOOLBAR_VARIABLE_LIST_CLASS = 'jp-pb-variableList';

interface IVariableListProps {
  tracker: INotebookTracker;
  manager: schemaManager;
}
export function addVariableListWidget(
  tracker: INotebookTracker,
  manager: schemaManager
) {
  // console.log('printing names');
  // for (const name of tracker?.currentWidget?.toolbar?.names() ?? '') {
  //   console.log(name);
  // }
  const namesIterator = tracker?.currentWidget?.toolbar.names();
  const existing = namesIterator
    ? find(namesIterator, value => value === 'variableList')
    : false;
  if (existing) {
    return false;
  }

  tracker?.currentWidget?.toolbar.insertAfter(
    'spacer',
    'variableList',
    createVariableList(tracker, manager)
  );
}
function createVariableList(
  notebookTracker: INotebookTracker,
  manager: schemaManager
): Widget {
  const el = ReactWidget.create(
    <VariableListComponent tracker={notebookTracker} manager={manager} />
  );
  return el;
}

function getVariableList(props: IVariableListProps): string {
  const schema = props.manager.previousSchema;
  const id = props.tracker.activeCell?.model?.id;

  const scopeNum = id
    ? // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      schema?.cellsToScopes?.[props.tracker.activeCell?.model?.id!]
    : 0;

  const vars: string[] = [];
  if (scopeNum) {
    for (let i = 0; i < scopeNum; i++) {
      vars.push(...(schema?.scopeList[i] ?? []));
    }
  }
  const formattedVars = vars.filter(name => name !== '').join(', ');
  return formattedVars;
}
function getFormattedVariableList(props: IVariableListProps): string {
  const varList = getVariableList(props);
  if (varList !== '') {
    return 'Exported: ' + varList;
  } else {
    return '';
  }
}
function VariableListComponent(props: IVariableListProps): JSX.Element {
  // const translator = props.translator || nullTranslator;
  // const trans = translator.load('jupyterlab');
  const callback = () => {
    // void props.dialogs.selectKernel(props.sessionContext);
  };

  return (
    <UseSignal signal={props.tracker.activeCellChanged}>
      {() => (
        <ToolbarButtonComponent
          className={TOOLBAR_VARIABLE_LIST_CLASS}
          onClick={callback}
          // tooltip={trans.__('Switch kernel')}
          label={getFormattedVariableList(props)}
        />
      )}
    </UseSignal>
  );
}
