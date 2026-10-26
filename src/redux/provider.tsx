'use client'

import React, { useRef } from 'react'
import { AppStore, makeStore, RootState } from './store'
import { Provider } from 'react-redux';

const ReduxProvider = ({ children, preloadedState }: { children: React.ReactNode, preloadedState?: Partial<RootState> }) => {

  // Made on the first render only. useRef(makeStore(...)) would build a new store on every render,
  // such as each router.refresh(), and throw it away.
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = makeStore(preloadedState);
  }

  return (
    <Provider store={storeRef.current}>
      {children}
    </Provider>
  )
}

export default ReduxProvider