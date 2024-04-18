import { Analyser, databaseStructureObject } from './Analyser';

export class PostgresAnalyser extends Analyser {

  public readonly queryString = `
    WITH foreign_keys AS (
      SELECT
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        kcuref.table_name  referenced_table,
        kcuref.column_name referenced_column,
        'FOREIGN KEY'      type
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = kcu.constraint_name AND rc.constraint_schema = kcu.constraint_schema
      JOIN information_schema.key_column_usage kcuref
        ON kcuref.constraint_name = rc.unique_constraint_name AND kcuref.constraint_schema = kcu.constraint_schema
      WHERE kcu.table_schema = '${this._schema}'
    ),
    referential_constraints AS (
      SELECT
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        array_agg(tc.constraint_type) referential_constraints
      FROM information_schema.key_column_usage kcu
      LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      WHERE kcu.table_schema = '${this._schema}' AND (tc.constraint_type = 'FOREIGN KEY' OR tc.constraint_type = 'PRIMARY KEY')
      GROUP BY kcu.table_schema, kcu.table_name, kcu.column_name
    )
    SELECT
      t.table_name,
      t.table_type,
      json_agg(
        json_build_object(
          'column_name',             c.column_name,
          'is_virtual',              FALSE,
          'type',                    c.udt_name,
          'default',                 c.column_default,
          'is_nullable',             c.is_nullable,
          'is_updatable',            c.is_updatable,
          'referential_constraints', referential_constraints.referential_constraints,
          'referenced_table_name',   foreign_keys.referenced_table,
          'referenced_column_name',  foreign_keys.referenced_column
        ) ORDER BY c.ordinal_position
      ) AS structure
    FROM information_schema.tables t
    JOIN information_schema.columns c
        ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    LEFT JOIN foreign_keys
        ON foreign_keys.table_name = t.table_name AND foreign_keys.column_name = c.column_name
    LEFT JOIN referential_constraints
        ON t.table_name = referential_constraints.table_name AND c.column_name = referential_constraints.column_name
    WHERE t.table_schema = '${this._schema}'
    GROUP BY t.table_name, t.table_type;
  `;

  constructor(schemaName: string, clientCallBack: (query: string) => Promise<databaseStructureObject>) {
    super(schemaName, clientCallBack);
  }

}