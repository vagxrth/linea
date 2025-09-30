import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { slices } from './slice';

const rootReducer = combineReducers({
    ...slices,
});

export const makeStore = () => {
    return configureStore({
        reducer: rootReducer,
    })
}