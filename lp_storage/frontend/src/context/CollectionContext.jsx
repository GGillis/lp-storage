import { createContext, useContext, useState, useEffect } from 'react'

const CollectionContext = createContext(null)

export function CollectionProvider({ children }) {
  const [collection, setCollectionRaw] = useState(
    () => localStorage.getItem('collection') ?? 'records'
  )

  function setCollection(c) {
    localStorage.setItem('collection', c)
    setCollectionRaw(c)
  }

  return (
    <CollectionContext.Provider value={{ collection, setCollection }}>
      {children}
    </CollectionContext.Provider>
  )
}

export function useCollection() {
  return useContext(CollectionContext)
}
