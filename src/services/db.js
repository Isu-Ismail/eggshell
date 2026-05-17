import { SQLocal } from 'sqlocal';

// Initializes an OPFS-backed SQLite database inside a Web Worker.
export const db = new SQLocal('stitcher.sqlite3');
