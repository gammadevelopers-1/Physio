"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface FavouriteCourse {
  id: string;
  title: string;
  thumbnail: string;
  progress: number;
  status: "in_progress" | "completed" | "not_started";
  /** Optional metadata captured at the time of favouriting — used by the favorites page UI. */
  price?: number;
  cmeHours?: number;
  isCmeAccredited?: boolean;
  deliveryType?: string;
  /** ISO timestamp when the course was favourited */
  addedAt?: string;
}

interface FavouritesContextType {
  favourites: FavouriteCourse[];
  addFavourite: (course: FavouriteCourse) => void;
  removeFavourite: (courseId: string) => void;
  isFavourite: (courseId: string) => boolean;
  toggleFavourite: (course: FavouriteCourse) => void;
}

const FavouritesContext = createContext<FavouritesContextType | undefined>(
  undefined
);

const STORAGE_KEY = "physioguidance_favourites";

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [favourites, setFavourites] = useState<FavouriteCourse[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load favourites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setFavourites(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading favourites from localStorage:", error);
    }
    setIsInitialized(true);
  }, []);

  // Save favourites to localStorage whenever they change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favourites));
      } catch (error) {
        console.error("Error saving favourites to localStorage:", error);
      }
    }
  }, [favourites, isInitialized]);

  const addFavourite = (course: FavouriteCourse) => {
    setFavourites((prev) => {
      if (prev.some((fav) => fav.id === course.id)) {
        return prev;
      }
      return [...prev, { ...course, addedAt: course.addedAt ?? new Date().toISOString() }];
    });
  };

  const removeFavourite = (courseId: string) => {
    setFavourites((prev) => prev.filter((fav) => fav.id !== courseId));
  };

  const isFavourite = (courseId: string) => {
    return favourites.some((fav) => fav.id === courseId);
  };

  const toggleFavourite = (course: FavouriteCourse) => {
    if (isFavourite(course.id)) {
      removeFavourite(course.id);
    } else {
      addFavourite(course);
    }
  };

  return (
    <FavouritesContext.Provider
      value={{
        favourites,
        addFavourite,
        removeFavourite,
        isFavourite,
        toggleFavourite,
      }}
    >
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavourites() {
  const context = useContext(FavouritesContext);
  if (context === undefined) {
    throw new Error("useFavourites must be used within a FavouritesProvider");
  }
  return context;
}
