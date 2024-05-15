import { Cell } from '@jupyterlab/cells';
import { PagebreakInternalSchema } from './types';

function findScopeNumber(cell: Cell, schema: PagebreakInternalSchema): number {
  switch (cell.model.type) {
    case 'markdown':
    case 'code': {
      return schema?.cellsToScopes?.[cell.model.id] ?? -1;
    }
    case 'raw': {
      return (
        schema.scopes.find(searchCell => searchCell.id === cell.model.id)
          ?.pbNum ?? -1
      );
    }
  }
  return -1;
}

export { findScopeNumber };
