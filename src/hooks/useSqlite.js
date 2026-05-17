import { useState, useCallback } from 'react';
import { db } from '../services/db';

export const useSqlite = () => {
  const [error, setError] = useState(null);

  const execute = useCallback(async (query) => {
    try {
      const result = await db.sql(query);
      return result; // sqlocal returns array of row objects
    } catch (err) {
      console.error("SQL Execution Error:", err, query);
      setError(err);
      throw err;
    }
  }, []);

  return { isReady: true, error, execute };
};
