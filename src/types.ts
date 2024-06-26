interface IPagebreakCell {
  index: number;
  id: string;
  type: string;
  variables: Array<string>;
}
interface IPagebreakScope {
  index: number; //index in the list of cells
  pbNum: number; //index in the list of pagebreak scopes
  exportedVariables: Array<string>; //variables this scope exports
  id: string;
}
type PagebreakSchema = Array<IPagebreakCell>;
type PagebreakScopeList = Array<IPagebreakScope>;
type PagebreakInternalSchema = {
  cellsToScopes:
    | {
        [x: string]: number;
      }
    | undefined;
  scopeList: {
    [x: number]: string[];
  };
  scopes: PagebreakScopeList;
  cellList: PagebreakSchema;
};
type pluginStatus = 'active' | 'inactive' | 'unset';
export {
  IPagebreakCell,
  IPagebreakScope,
  PagebreakInternalSchema,
  PagebreakSchema,
  PagebreakScopeList,
  pluginStatus
};
