/**
 * Example of [Jest](https://jestjs.io/docs/getting-started) unit tests
 */

// see galata/test/benchmark/notebook.spec.ts
// import { generate, simulate } from 'simulate-event';

// import {
//   Cell,
//   CodeCell,
//   CodeCellModel,
//   MarkdownCell,
//   MarkdownCellModel,
//   RawCell,
//   RawCellModel
// } from '@jupyterlab/cells';
// import {
//   INotebookModel,
//   Notebook,
//   NotebookModel,
//   StaticNotebook
// } from '@jupyterlab/notebook';
// import {
//   framePromise,
//   JupyterServer,
//   signalToPromise,
//   sleep
// } from '@jupyterlab/testing';

// const server = new JupyterServer();

// beforeAll(async () => {
//   await server.start();
// }, 30000);

// afterAll(async () => {
//   await server.shutdown();
// });
import { parseExport } from '../schema';
describe('pagebreaks', () => {
  it('should be tested', () => {
    expect(1 + 1).toEqual(2);
  });
});

describe('parseExport', () => {
  it('shouldn not include spaces', () => {
    expect(parseExport('export { x   d  fjs }')).toEqual(['x', 'd', 'fjs']);
  });
});
