type column = {
  column_name: string
  is_virtual: boolean
  column_type?: string
  default?: string | number // TODO check what the possible values might be
  is_nullable?: string
  referential_constraints?: ('PRIMARY KEY' | 'FOREIGN KEY')[] | null
  referenced_table_name?: string
  referenced_column_name?: string
};

type table = {
  name: string
  type: string
  structure: Array<column>
}

export type databaseStructureObject = Array<table> | null;

export abstract class Analyser {
  abstract readonly queryString: string;
  protected _schema: string;
  protected _databaseStructure: databaseStructureObject;
  protected _clientCallBack: (query: string) => Promise<databaseStructureObject>;

  protected constructor(schemaName: string, clientCallBack: (query: string) => Promise<databaseStructureObject>) {
    this._schema = schemaName;
    this._clientCallBack = clientCallBack;
    this._databaseStructure = null;
  }

  async setup() {
    this._databaseStructure = await this._clientCallBack(this.queryString);
  }
}