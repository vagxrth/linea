import { combineReducers, configureStore, Middleware, ReducersMapObject  } from '@reduxjs/toolkit'
import { slices } from './slice';
import { apis } from './api';
import { TypedUseSelectorHook, useSelector, useDispatch } from 'react-redux';

export type RootState = ReturnType<typeof rootReducer>;

const rootReducer = combineReducers({
    ...slices,
    ...apis.reduce((acc, api) => {
        acc[api.reducerPath] = api.reducer
        return acc;
    }, {} as ReducersMapObject)
});

const makeStore = (preloadedState?: Partial<RootState>) => {
    return configureStore({
        reducer: rootReducer,
        middleware: (getDM) => getDM().concat(...apis.map((api) => api.middleware as Middleware)),
        preloadedState,
        devTools: process.env.NODE_ENV !== 'production',
     })
}

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
export const useAppDispatch = () => useDispatch<AppDispatch>()