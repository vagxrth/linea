'use client'

import React, { useRef } from 'react'
import { makeStore, RootState } from './store'
import { Provider } from 'react-redux';

const ReduxProvider = ({ children, preloadedState }: { children: React.ReactNode, preloadedState?: Partial<RootState> }) => {

  const storeRef = useRef(makeStore(preloadedState));

  return (
    <Provider store={storeRef.current}>
      {children}
    </Provider>
  )
}

export default ReduxProvider