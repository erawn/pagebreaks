/* eslint-disable prettier/prettier */
// import { IEditorServices } from '@jupyterlab/codeeditor';
import { NotebookPanel } from '@jupyterlab/notebook';

import { JupyterFrontEnd } from '@jupyterlab/application';
import { Cell } from '@jupyterlab/cells';
import '../style/index.css';
import { schemaManager } from './schemaManager';
//select whole pagebreak on select header or footer, so users drag whole pagebreaks

function pgEventHandlers(app: JupyterFrontEnd, manager: schemaManager) {
    const notebook = app.shell.currentWidget as NotebookPanel;

    notebook.content.widgets.forEach((cell, index) => {
        if (cell?.model.getMetadata('pagebreakheader')) {
            cell.node.onclick = (ev: MouseEvent) => onHeaderCellClick(ev, cell)
        }
        else if (cell?.model.getMetadata('pagebreak')) {
            cell.node.onclick = (ev: MouseEvent) => onPagebreakCellClick(ev, cell)
        }
    })
    function onPagebreakCellClick(ev: MouseEvent, cell: Cell) {
        const pbNum = manager?.previousSchema?.scopes.find(
            searchCell => searchCell.id === cell.model.id)?.pbNum ?? -1;
        const matchingPbHeader = notebook?.content?.widgets?.find(
            searchCell => (searchCell.model.getMetadata('pagebreakheader') &&
                manager?.previousSchema?.cellsToScopes?.[searchCell.model.id] === pbNum)) ?? undefined
        console.log(matchingPbHeader)
        const matchingPbHeaderIndex = notebook?.content?.widgets?.findIndex(searchCell => searchCell.model.id === matchingPbHeader?.model.id)
        if (matchingPbHeader !== undefined) {
            const pbIndex = notebook.content.activeCellIndex
            console.log('active cell index', pbIndex)
            console.log('matchingpbindex', matchingPbHeaderIndex)
            const { head, anchor } = notebook.content.getContiguousSelection()
            if ((head === matchingPbHeaderIndex && anchor === pbIndex)
                || (head === pbIndex && anchor === matchingPbHeaderIndex)) {
                return
            }
            // notebook.content.activeCellIndex = matchingPbHeaderIndex
            // notebook.content.select(matchingPbHeader)
            // notebook.update()
            // notebook.content.update()
            // notebook.content.activeCell?.update()
            // console.log('selectedcellind', notebook.content.activeCellIndex)
            notebook.content.extendContiguousSelectionTo(matchingPbHeaderIndex)
            notebook.content.update()
            notebook.update()
        }
    }
    function onHeaderCellClick(ev: MouseEvent, cell: Cell) {
        console.log('clicked!')
        ev.stopPropagation();
        ev.preventDefault();
        ev.stopImmediatePropagation();
        const scopeNum =
            manager?.previousSchema?.cellsToScopes?.[cell.model.id] ?? -1;
        const matchingPbIndex =
            manager?.previousSchema?.scopes.find(scope => scope.pbNum === scopeNum)
                ?.index ?? -1;

        if (matchingPbIndex >= 0) {
            const overlappingHeaders = notebook.content.widgets.filter(
                (searchCell, index) =>
                    searchCell.model.getMetadata('pagebreakheader') &&
                    index < matchingPbIndex &&
                    index > notebook.content.activeCellIndex
            );

            if (overlappingHeaders.length === 0) {
                //this should always be true when the order is correct, but if its messed up, we need to be able to select the individual headers to fix it
                notebook.content.extendContiguousSelectionTo(matchingPbIndex);
                notebook.content.update();
            }
        }
    }
}
// } else if (cell?.model.getMetadata('pagebreak')) {
// const notebook = (app.shell.currentWidget as NotebookPanel)
// const pbNum = manager?.previousSchema?.scopes.find(
//   searchCell => searchCell.id === cell.model.id)?.pbNum ?? -1;
// const matchingPbHeader = notebook?.content?.widgets?.find(
//   searchCell => (searchCell.model.getMetadata('pagebreakheader') &&
//     manager?.previousSchema?.cellsToScopes?.[searchCell.model.id] === pbNum)) ?? undefined
// console.log(matchingPbHeader)
// const matchingPbHeaderIndex = notebook?.content?.widgets?.findIndex(searchCell => searchCell.model.id === matchingPbHeader?.model.id)
// if (matchingPbHeader !== undefined) {
//   // const pbIndex = notebook.content.activeCellIndex
//   // console.log('active cell index', pbIndex)
//   // console.log('matchingpbindex', matchingPbHeaderIndex)
//   // const { head, anchor } = notebook.content.getContiguousSelection()
//   // if ((head === matchingPbHeaderIndex && anchor === pbIndex)
//   //   || (head === pbIndex && anchor === matchingPbHeaderIndex)) {
//   //   return
//   // }
//   // notebook.content.activeCellIndex = matchingPbHeaderIndex
//   // notebook.content.select(matchingPbHeader)
//   // notebook.update()
//   // notebook.content.update()
//   // notebook.content.activeCell?.update()
//   // console.log('selectedcellind', notebook.content.activeCellIndex)
//   // notebook.content.extendContiguousSelectionTo(matchingPbHeaderIndex)
//   // notebook.content.update()
//   // notebook.update()
// }

export { pgEventHandlers };
