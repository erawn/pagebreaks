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
}
type PagebreakSchema = Array<IPagebreakCell>;
type PagebreakScopeList = Array<IPagebreakScope>;

export { IPagebreakCell, IPagebreakScope, PagebreakSchema, PagebreakScopeList };
