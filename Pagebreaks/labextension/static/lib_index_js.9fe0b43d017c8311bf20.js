"use strict";
(self["webpackChunkPagebreaks"] = self["webpackChunkPagebreaks"] || []).push([["lib_index_js"],{

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/settingregistry */ "webpack/sharing/consume/default/@jupyterlab/settingregistry");
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _style_index_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../style/index.css */ "./style/index.css");
/* harmony import */ var lodash__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! lodash */ "webpack/sharing/consume/default/lodash/lodash");
/* harmony import */ var lodash__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(lodash__WEBPACK_IMPORTED_MODULE_3__);
// import { IEditorServices } from '@jupyterlab/codeeditor';




class schemaManager {
    constructor() {
        this.previousSchema = null;
        this.future = null;
    }
}
const plugin = {
    id: 'Pagebreaks:plugin',
    description: 'A JupyterLab extension.',
    autoStart: true,
    requires: [_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.INotebookTracker],
    optional: [_jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_0__.ISettingRegistry],
    activate: (app, notebookTracker, settingRegistry) => {
        var _a;
        console.log('JupyterLab extension Pagebreaks is activated!!!!');
        const notebook = (_a = app.shell) === null || _a === void 0 ? void 0 : _a.currentWidget;
        const manager = new schemaManager();
        if (notebook) {
            notebook.revealed.then(() => {
                console.log('top level CALL');
                updatePagebreak(app, manager);
            });
        }
        else {
            // setTimeout(() => {
            //   console.log('timeout CALL');
            //   updatePagebreak(app, manager);
            // }, 1000);
        }
        notebookTracker.currentChanged.connect(() => {
            var _a;
            if (notebookTracker.currentWidget instanceof _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookPanel) {
                const notebook = (_a = app.shell) === null || _a === void 0 ? void 0 : _a.currentWidget;
                if (notebook) {
                    notebook.content.cellInViewportChanged.connect(() => {
                        var _a;
                        if (notebookTracker.currentWidget instanceof _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookPanel) {
                            const notebook = (_a = app.shell) === null || _a === void 0 ? void 0 : _a.currentWidget;
                            if (notebook) {
                                notebook.revealed.then(() => {
                                    console.log('cellinviewport CALL');
                                    updatePagebreak(app, manager);
                                });
                            }
                        }
                    });
                    notebook.revealed.then(() => {
                        console.log('currentChanged CALL');
                        updatePagebreak(app, manager);
                    });
                }
            }
        });
        notebookTracker.activeCellChanged.connect(() => {
            var _a, _b;
            // console.log('activecell updated!');
            // const registry = app.docRegistry;
            // const factory = registry.getWidgetFactory('Notebook');
            // console.log('found factory', factory?.name);
            // (factory as NotebookWidgetFactory).contentFactory.createCodeCell = lambda;
            if (((_a = app.shell) === null || _a === void 0 ? void 0 : _a.currentWidget) instanceof _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookPanel) {
                const notebook = (_b = app.shell) === null || _b === void 0 ? void 0 : _b.currentWidget;
                if (notebook) {
                    notebook.revealed.then(() => {
                        // console.log('notebook revealed');
                        // console.log('nb id', notebook.id);
                        console.log('activeCellChanged CALL');
                        updatePagebreak(app, manager);
                        // console.log('current selection is:');
                        // console.log(notebook.content.activeCellIndex);
                    });
                }
            }
        });
        notebookTracker.widgetUpdated.connect(() => {
            console.log('widget updated');
        });
        if (app.shell.currentWidget instanceof _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookPanel) {
            console.log('found shell');
            const notebook = app.shell.currentWidget;
            Promise.all([notebook.sessionContext.ready]).then(async () => {
                console.log('context CALL');
                updatePagebreak(app, manager);
            });
        }
        app.shell.activeChanged.connect(() => {
            if (app.shell.currentWidget instanceof _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.NotebookPanel) {
                const notebook = app.shell.currentWidget;
                if (notebook) {
                    notebook.revealed.then(() => {
                        console.log('LabShell activeChanged CALL');
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
function tagNotebookCells(notebook, schema) {
    var _a;
    // if we have a notebook with no real pagebreak cells, dont change the formatting
    if (schema.scopeList[0].find(v => v === 'pagebreaks_simulated')) {
        return;
    }
    console.log('schema', schema.cellsToScopes);
    (_a = notebook === null || notebook === void 0 ? void 0 : notebook.content) === null || _a === void 0 ? void 0 : _a.widgets.forEach((cell, index) => {
        // add styling for code cells
        if (cell.model.type === 'code') {
            cell.addClass('jp-pb-pagebreakCodeCell');
            if (schema.cellsToScopes && schema.cellsToScopes[cell.model.id] !== undefined) {
                const scopeNum = schema.cellsToScopes[cell.model.id];
                if (scopeNum !== undefined) {
                    console.log('scopenum', scopeNum);
                    if (scopeNum % 2 === 0) {
                        cell.addClass('jp-pb-pagebreakEven');
                    }
                    else {
                        cell.addClass('jp-pb-pagebreakOdd');
                    }
                }
            }
        }
        else {
            cell.removeClass('jp-pb-pagebreakCodeCell');
        }
        //add styling for pagebreak cells
        if (cell.model.type === 'raw' &&
            cell.model.sharedModel.getSource().startsWith('pb')) {
            cell.addClass('jp-pb-pagebreakCell');
            const scope = schema.scopes.find(cell => (cell.index === index));
            if (scope !== undefined) {
                if (scope.pbNum % 2 === 0) {
                    console.log('scopeeven', scope);
                    cell.addClass('jp-pb-pagebreakEven');
                }
                else {
                    console.log('scopeodd', scope);
                    cell.addClass('jp-pb-pagebreakOdd');
                }
            }
        }
        else {
            cell.removeClass('jp-pb-pagebreakCell');
        }
    });
}
function buildNotebookSchema(notebook) {
    var _a;
    const cellList = [];
    (_a = notebook === null || notebook === void 0 ? void 0 : notebook.content) === null || _a === void 0 ? void 0 : _a.widgets.forEach((cell, index) => {
        if (cell.model.type === 'code') {
            const newCell = {
                index: index,
                id: cell.model.id,
                type: cell.model.type,
                variables: []
            };
            cellList.push(newCell);
        }
        else if (cell.model.type === 'raw') {
            const content = cell.model.sharedModel.getSource();
            if (content.startsWith('pb')) {
                const names = content.split(' ').filter(name => name !== 'pb');
                // console.log('found pb names', names);
                const newCell = {
                    index: index,
                    id: cell.model.id,
                    type: 'pagebreak',
                    variables: names
                };
                cellList.push(newCell);
            }
        }
    });
    cellList.sort((cellA, cellB) => cellA.index - cellB.index);
    const scopeList = cellList
        .filter(cell => cell.type === 'pagebreak')
        .map((cell, index) => ({
        index: cell.index,
        pbNum: index,
        exportedVariables: cell.variables //variables this scope exports
    }));
    if (scopeList.length === 0) {
        scopeList.push({
            index: cellList.length,
            pbNum: 0,
            exportedVariables: ['pagebreaks_simulated']
        });
    }
    //Builds an Object with structure [cell.id]: matching pagebreak scope
    const cellsToScopes = cellList
        .filter(cell => cell.type === 'code')
        .map(cell => {
        var _a, _b;
        const currentScope = (_b = (_a = scopeList
            .filter(pbCell => pbCell.index > cell.index)) === null || _a === void 0 ? void 0 : _a.sort((cellA, cellB) => cellA.index - cellB.index)) === null || _b === void 0 ? void 0 : _b.at(0);
        if (!currentScope) {
            const lastScope = scopeList
                .sort((cellA, cellB) => cellA.index - cellB.index)
                .at(-1);
            if (lastScope) {
                return {
                    [cell.id]: lastScope.pbNum + 1
                };
            }
            else if (scopeList.length === 0) {
                //if we have a nb without any pagebreaks
                return { [cell.id]: 0 };
            }
            else {
                console.error("Can't find matching scope for cell", cell);
            }
        }
        else {
            return {
                [cell.id]: currentScope.pbNum
            };
        }
    })
        .reduce((prev, current) => ({
        ...prev,
        ...current
    }));
    return {
        cellsToScopes: cellsToScopes,
        scopeList: scopeList
            .map(cell => ({
            [cell.pbNum]: cell.exportedVariables,
        }))
            .reduce((prev, cur) => ({
            ...prev,
            ...cur
        })),
        scopes: scopeList
    };
}
function sendSchema(notebook, schema, manager) {
    // console.log('send Schema');
    var _a, _b;
    const content = {
        code: '%pb_update ' + schema,
        silent: true,
        store_history: false
    };
    // const stringSchema = { pagebreakSchema: schema };
    // console.log('schema string:', JSON.stringify(stringSchema));
    const kernel = (_b = (_a = notebook === null || notebook === void 0 ? void 0 : notebook.sessionContext) === null || _a === void 0 ? void 0 : _a.session) === null || _b === void 0 ? void 0 : _b.kernel;
    if (!kernel) {
        throw new Error('Session has no kernel.');
    }
    if (manager.future === null || manager.future.isDisposed) {
        console.log('sending content', schema);
        const future = kernel.requestExecute(content);
        // Handle iopub messages
        future.onIOPub = msg => {
            if (msg.header.msg_type !== 'status') {
                // console.log(msg.content);
            }
        };
        manager.future = future;
    }
    // kernelModel.execute();
}
function updatePagebreak(app, manager) {
    var _a, _b;
    const notebook = (_a = app.shell) === null || _a === void 0 ? void 0 : _a.currentWidget;
    const schema = buildNotebookSchema(notebook);
    console.log('schema check');
    // eslint-disable-next-line no-constant-condition
    if (!lodash__WEBPACK_IMPORTED_MODULE_3___default().isEqual(manager.previousSchema, schema) || true) {
        // console.log('previous schema', manager.previousSchema);
        if (!notebook.sessionContext || !((_b = notebook.sessionContext.session) === null || _b === void 0 ? void 0 : _b.kernel)) {
            return;
        }
        manager.previousSchema = schema;
        tagNotebookCells(notebook, schema);
        const jsonSchema = JSON.stringify(schema);
        // notebook?.content?.widgets?.map(cell => {
        //   cell.model.setMetadata('pagebreak_schema', jsonSchema);
        // });
        sendSchema(notebook, jsonSchema, manager);
        // console.log('schema changed', jsonSchema);
    }
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (plugin);


/***/ }),

/***/ "./node_modules/css-loader/dist/cjs.js!./style/index.css":
/*!***************************************************************!*\
  !*** ./node_modules/css-loader/dist/cjs.js!./style/index.css ***!
  \***************************************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/sourceMaps.js */ "./node_modules/css-loader/dist/runtime/sourceMaps.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../node_modules/css-loader/dist/runtime/api.js */ "./node_modules/css-loader/dist/runtime/api.js");
/* harmony import */ var _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_base_css__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! -!../node_modules/css-loader/dist/cjs.js!./base.css */ "./node_modules/css-loader/dist/cjs.js!./style/base.css");
// Imports



var ___CSS_LOADER_EXPORT___ = _node_modules_css_loader_dist_runtime_api_js__WEBPACK_IMPORTED_MODULE_1___default()((_node_modules_css_loader_dist_runtime_sourceMaps_js__WEBPACK_IMPORTED_MODULE_0___default()));
___CSS_LOADER_EXPORT___.i(_node_modules_css_loader_dist_cjs_js_base_css__WEBPACK_IMPORTED_MODULE_2__["default"]);
// Module
___CSS_LOADER_EXPORT___.push([module.id, `
`, "",{"version":3,"sources":[],"names":[],"mappings":"","sourceRoot":""}]);
// Exports
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (___CSS_LOADER_EXPORT___);


/***/ }),

/***/ "./style/index.css":
/*!*************************!*\
  !*** ./style/index.css ***!
  \*************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js */ "./node_modules/style-loader/dist/runtime/injectStylesIntoStyleTag.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleDomAPI.js */ "./node_modules/style-loader/dist/runtime/styleDomAPI.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertBySelector.js */ "./node_modules/style-loader/dist/runtime/insertBySelector.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js */ "./node_modules/style-loader/dist/runtime/setAttributesWithoutAttributes.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/insertStyleElement.js */ "./node_modules/style-loader/dist/runtime/insertStyleElement.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! !../node_modules/style-loader/dist/runtime/styleTagTransform.js */ "./node_modules/style-loader/dist/runtime/styleTagTransform.js");
/* harmony import */ var _node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! !!../node_modules/css-loader/dist/cjs.js!./index.css */ "./node_modules/css-loader/dist/cjs.js!./style/index.css");

      
      
      
      
      
      
      
      
      

var options = {};

options.styleTagTransform = (_node_modules_style_loader_dist_runtime_styleTagTransform_js__WEBPACK_IMPORTED_MODULE_5___default());
options.setAttributes = (_node_modules_style_loader_dist_runtime_setAttributesWithoutAttributes_js__WEBPACK_IMPORTED_MODULE_3___default());

      options.insert = _node_modules_style_loader_dist_runtime_insertBySelector_js__WEBPACK_IMPORTED_MODULE_2___default().bind(null, "head");
    
options.domAPI = (_node_modules_style_loader_dist_runtime_styleDomAPI_js__WEBPACK_IMPORTED_MODULE_1___default());
options.insertStyleElement = (_node_modules_style_loader_dist_runtime_insertStyleElement_js__WEBPACK_IMPORTED_MODULE_4___default());

var update = _node_modules_style_loader_dist_runtime_injectStylesIntoStyleTag_js__WEBPACK_IMPORTED_MODULE_0___default()(_node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"], options);




       /* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (_node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"] && _node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals ? _node_modules_css_loader_dist_cjs_js_index_css__WEBPACK_IMPORTED_MODULE_6__["default"].locals : undefined);


/***/ })

}]);
//# sourceMappingURL=lib_index_js.9fe0b43d017c8311bf20.js.map