"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "physio_recent_searches";
const MAX_RECENT_SEARCHES = 8;

export const useRecentSearches = () => {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading recent searches:", error);
    }
  }, []);

  // Save to localStorage
  const saveToStorage = useCallback((searches: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (error) {
      console.error("Error saving recent searches:", error);
    }
  }, []);

  // Add a search term
  const addSearch = useCallback((query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setRecentSearches(prev => {
      // Remove if already exists, then add to front
      const filtered = prev.filter(s => s.toLowerCase() !== trimmedQuery.toLowerCase());
      const updated = [trimmedQuery, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Remove a search term
  const removeSearch = useCallback((query: string) => {
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== query);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  // Clear all searches
  const clearAll = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Error clearing recent searches:", error);
    }
  }, []);

  return {
    recentSearches,
    addSearch,
    removeSearch,
    clearAll,
  };
};

export default useRecentSearches;
