declare module 'node:sqlite' {
  export type SQLInputValue = string | number | bigint | Buffer | null;

  export type StatementResultingChanges = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  export class StatementSync {
    all(...anonymousParameters: SQLInputValue[]): unknown[];
    get(...anonymousParameters: SQLInputValue[]): unknown | undefined;
    run(...anonymousParameters: SQLInputValue[]): StatementResultingChanges;
  }

  export class DatabaseSync {
    constructor(location?: string);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
