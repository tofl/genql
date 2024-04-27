type column = {
  column_name: string
  is_virtual: boolean
  column_type?: string
  default?: string | number // TODO check what the possible values might be
  is_nullable?: string
  referential_constraints?: ('PRIMARY KEY' | 'FOREIGN KEY')[] | null
  referenced_table_name?: string
  referenced_column_name?: string
  junction_table?: table
  junction_corresponding_column?: column
  junction_opposing_column?: column
};

type table = {
  table_name: string
  table_type: string
  structure: Array<column>
}

export type databaseStructureObject = Array<table> | null;

export abstract class Analyser {
  abstract readonly queryString: string;
  protected _schema: string;
  protected _databaseStructure: databaseStructureObject;
  protected _clientCallBack: (query: string) => Promise<databaseStructureObject>;
  private _relations: { [key: string]: Array<column> };

  protected constructor(schemaName: string, clientCallBack: (query: string) => Promise<databaseStructureObject>) {
    this._schema = schemaName;
    this._clientCallBack = clientCallBack;
    this._databaseStructure = null;
    this._relations = {};
  }

  async setup() {
    this._databaseStructure = await this._clientCallBack(this.queryString);

    this._databaseStructure!.forEach((table: table) => {
      if (this.isJunctionTable(table)) {
        this.handleManyToManyRelation(table);
      }

      this.handleForeignKeys(table);
    });

    this.applyRelations();
  }

  isJunctionTable(table: table) {
    let fkCount = 0;
    let otherCount = 0;

    table.structure.forEach((column) => {
      if (!column.referential_constraints) {
        otherCount += 1;
      } else if (column.referential_constraints.includes('FOREIGN KEY')) {
        fkCount += 1;
      }
    });

    return fkCount === 2 && otherCount === 0;
  }

  makeVirtualColumn(columnName: string, referencedTableName: string, referencedColumnName: string): column {
    return {
      column_name: columnName,
      is_virtual: true,
      referenced_table_name: referencedTableName,
      referenced_column_name: referencedColumnName,
    };
  }

  pushVirtualColumn(tableName: string, column: column) {
    if (!this._relations[tableName]) {
      this._relations[tableName] = [];
    }

    this._relations[tableName].push(column);
  }

  handleManyToManyRelation(table: table) {
    const columns: Array<column> = [];

    table.structure.forEach((column) => {
      if (column.referential_constraints?.includes('FOREIGN KEY')) {
        columns.push(column);
      }
    });

    if (columns.length !== 2) {
      throw new Error('array `columns` is expected to be of length 2');
    }

    const columnA = this.makeVirtualColumn(columns[1].referenced_table_name!, columns[1].referenced_table_name!, columns[1].referenced_column_name!);
    const columnB = this.makeVirtualColumn(columns[0].referenced_table_name!, columns[0].referenced_table_name!, columns[0].referenced_column_name!);

    columnA.junction_table = table;
    columnA.junction_corresponding_column = columns[0];
    columnA.junction_opposing_column = columns[1];

    columnB.junction_table = table;
    columnB.junction_corresponding_column = columns[1];
    columnB.junction_opposing_column = columns[0];

    this.pushVirtualColumn(columnB.referenced_table_name!, columnA);
    this.pushVirtualColumn(columnA.referenced_table_name!, columnB);
  }

  private applyRelations() {
    if (!this._databaseStructure) {
      return;
    }

    this._databaseStructure.forEach((table: table) => {
      if (this._relations[table.table_name]) {
        table.structure.push(...this._relations[table.table_name]);
      }
    })
  }

  private handleForeignKeys(table: table) {
    table.structure.forEach((column) => {
      if (column.referential_constraints?.includes('FOREIGN KEY')) {
        if (!column.referenced_table_name || !column.referenced_column_name) {
          throw new Error('a `referenced_column_name` field is expected');
        }

        const fkAssociatedVirtualColumn = this.makeVirtualColumn(column.referenced_table_name, column.referenced_table_name, column.referenced_column_name);
        this.pushVirtualColumn(table.table_name, fkAssociatedVirtualColumn);

        const reflectedColumn = this.makeVirtualColumn(table.table_name, table.table_name, column.column_name);
        this.pushVirtualColumn(column.referenced_table_name, reflectedColumn);
      }
    });
  }
}